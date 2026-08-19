'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { SITE_URL } from '@/shared/brand'
import { checkRateLimit, checkRateLimitByIp, rateLimitMessage } from '@/server/rate-limit'
import { captureFunnelEvent } from '@/server/funnel'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/shared/validation/auth'

/**
 * Auth Server Actions.
 *
 * Credentials are validated with the same Zod schema the form uses, so a
 * hand-crafted POST cannot skip the checks the UI performs.
 *
 * Every action here is rate limited, and the limit is checked **before** the
 * credentials are — a Server Action is a public POST endpoint whatever the form
 * in front of it looks like. `shared/rate-limit.ts` states what each policy is
 * for; `server/rate-limit.ts` explains the backend and why it fails open.
 */

export interface AuthFormState {
  error: string | null
}

export interface SignUpState extends AuthFormState {
  /** Field-level errors, keyed by input name, for inline display. */
  fieldErrors?: Record<string, string>
  /**
   * Set when the account was created but no session came back, which means the
   * project requires email confirmation. Locally confirmations are off and the
   * user is signed straight in, so both paths have to be handled.
   */
  confirmationRequired?: boolean
}

/** `next` must be a relative path — an open redirect would let a phishing link
 * bounce users to an attacker's domain post-login. */
function safeNext(raw: FormDataEntryValue | null): string {
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')
    ? raw
    : '/dashboard'
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  // Per IP first, and on the raw form value rather than the parsed one: a
  // request that fails validation still cost us the round trip, and counting
  // only well-formed attempts would leave the cheapest flood uncounted.
  const byIp = await checkRateLimitByIp('signIn')
  if (!byIp.allowed) return { error: rateLimitMessage(byIp) }

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details and try again.' }
  }

  // And per address, which is the half a botnet cannot spread around. Note this
  // reveals nothing: the same answer comes back whether or not the address has
  // an account, because the limit is counted before anything is looked up.
  const byEmail = await checkRateLimit('signIn', parsed.data.email)
  if (!byEmail.allowed) return { error: rateLimitMessage(byEmail) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells an attacker which emails are registered.
    return { error: 'Those credentials did not work. Please try again.' }
  }

  revalidatePath('/', 'layout')
  redirect(safeNext(formData.get('next')))
}

/**
 * Creates an account.
 *
 * No profile or subscription is written here: the `on_auth_user_created`
 * trigger seeds `profiles`, `subscriptions` (explorer) and `usage_counters` in
 * the same transaction as the auth user, so a client that dies mid-signup can
 * never leave a user without a plan.
 */
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const limit = await checkRateLimitByIp('signUp')
  if (!limit.allowed) return { error: rateLimitMessage(limit) }

  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName') ?? '',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const { email, password, displayName } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by handle_new_user() for the profile's display name.
      data: displayName ? { full_name: displayName } : {},
      // Where the confirmation link lands when the project requires one. Without
      // this it goes to `site_url`, which is the landing page — a signed-in
      // stranger to their own new account, with nothing saying it worked.
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=/verify`,
    },
  })

  if (error) {
    // Unlike sign-in, this cannot be made non-enumerable: with confirmations
    // off the auth server itself rejects a duplicate email. Say something
    // useful rather than something vague and equally revealing.
    const alreadyRegistered =
      error.code === 'user_already_exists' || /already registered/i.test(error.message)

    return {
      error: alreadyRegistered
        ? 'That email already has an account. Sign in instead.'
        : (error.message ?? 'Could not create the account. Please try again.'),
    }
  }

  // Step one of the funnel, and recorded here rather than on first sign-in
  // because both branches below are a successful signup — an account waiting on
  // a confirmation email is one that was created, and counting only the ones
  // that come back would hide the drop-off that email causes, which is precisely
  // what the funnel is for.
  if (data.user) captureFunnelEvent(data.user.id, 'signed_up')

  // Confirmations on → no session until the emailed link is clicked.
  if (!data.session) {
    return { error: null, confirmationRequired: true }
  }

  revalidatePath('/', 'layout')
  redirect(safeNext(formData.get('next')))
}

/**
 * Starts a Google sign-in — the second half of Phase 0's "Auth (email + Google)".
 *
 * A Server Action rather than a client call, and the difference matters: the
 * browser never holds a Supabase client that can begin an OAuth flow, so there is
 * one code path into a session and it is this file. `signInWithOAuth` here
 * returns a URL instead of navigating, and the redirect below is what sends the
 * visitor to Google.
 *
 * ## Where `next` goes
 *
 * Through Google and back. It cannot ride in a cookie — the return is a top-level
 * navigation from another origin, and a `Lax` cookie would survive it while a
 * `Strict` one would not, which is a distinction nobody should have to remember.
 * So it is a query parameter on the callback URL, and `/auth/callback` re-checks
 * it with the same `safeNext` rule this file applies: an attacker who can put a
 * URL in front of somebody can already choose the `next` on the login page, so
 * the guard belongs at the end of the journey rather than at the start.
 *
 * ## What this file cannot enforce
 *
 * Google has to be enabled as a provider in the Supabase project, with a client
 * id and secret, and this origin has to be in the redirect allow-list. None of
 * that lives in the repo. Locally it is `[auth.external.google]` in
 * `config.toml`; in a hosted project it is the dashboard. Until then the call
 * below returns an error and the form says so, which is a better failure than a
 * button that silently does nothing.
 */
export async function signInWithGoogle(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  // The same bucket as a password sign-in: both end in a session, and an
  // endpoint that starts an OAuth round trip is one somebody can loop on.
  const limit = await checkRateLimitByIp('signIn')
  if (!limit.allowed) return { error: rateLimitMessage(limit) }

  const supabase = await createClient()
  const next = safeNext(formData.get('next'))

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        // Asks Google to show the account chooser rather than silently reusing
        // whichever account the browser is already signed into. On a shared
        // computer that silence is how somebody logs into the wrong account and
        // cannot work out why.
        prompt: 'select_account',
      },
    },
  })

  if (error || !data.url) {
    return {
      error: 'Signing in with Google is not available right now. Use your email and password.',
    }
  }

  redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export interface RecoveryState extends AuthFormState {
  /** Set once the request has been accepted, whatever it found. */
  sent?: boolean
}

/**
 * Sends a password reset link — screen 9.
 *
 * Reports success whether or not the address has an account. The alternative
 * turns this form into a membership oracle: anyone could type an email and
 * learn from the response whether that person keeps their travel history here,
 * which is exactly the thing a private profile is meant not to say.
 *
 * Limited **per IP only**, deliberately, and this is the one place the obvious
 * second key would be a mistake: a per-address bucket would answer "too many
 * attempts" to a stranger who had sent nothing, which tells them somebody else
 * just asked for a reset on that address — the same kind of disclosure the vague
 * success message exists to prevent. The per-address protection is the auth
 * server's `auth.rate_limit.email_sent`, which cannot be probed from here.
 */
export async function requestPasswordReset(
  _prev: RecoveryState,
  formData: FormData
): Promise<RecoveryState> {
  const limit = await checkRateLimitByIp('emailRecovery')
  if (!limit.allowed) return { error: rateLimitMessage(limit) }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })

  // The one thing worth failing on: a malformed address is the user's typo,
  // not a stranger probing, and silently "sending" to it helps nobody.
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' }
  }

  const supabase = await createClient()

  // The link lands on the confirm route, which trades the token for a session
  // and then forwards to the form that sets the new password.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password`,
  })

  return { error: null, sent: true }
}

export interface ResetPasswordState extends AuthFormState {
  fieldErrors?: Record<string, string>
}

/**
 * Sets a new password for whoever holds the current session.
 *
 * The authorisation is the session itself: it exists only because the recovery
 * link was opened, and the auth server issued it. So there is no token to check
 * here — a caller without one has no session, and `updateUser` refuses.
 */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const supabase = await createClient()

  // getUser(), not getSession(): the session has to be one the auth server
  // still vouches for, and a recovery link that has already been spent leaves a
  // cookie that looks fine locally.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'That reset link has expired. Ask for a new one and try again.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    // Most often the auth server's own password rules, which the shared schema
    // already mirrors — so this is the case where the two have drifted, and
    // repeating the server's wording is more use than inventing our own.
    return { error: error.message || 'Could not set that password. Please try again.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Sends the confirmation email again.
 *
 * Same non-enumerable contract as the reset request: an address with no pending
 * confirmation gets the same answer as one that just received an email.
 */
export async function resendConfirmation(
  _prev: RecoveryState,
  formData: FormData
): Promise<RecoveryState> {
  // The same bucket as the reset request, and per IP for the same reason: the
  // two forms are one abuse, and a per-address count here would be an oracle.
  const limit = await checkRateLimitByIp('emailRecovery')
  if (!limit.allowed) return { error: rateLimitMessage(limit) }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' }
  }

  const supabase = await createClient()

  await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${SITE_URL}/auth/confirm?next=/verify` },
  })

  return { error: null, sent: true }
}
