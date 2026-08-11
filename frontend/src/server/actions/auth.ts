'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { signInSchema, signUpSchema } from '@/shared/validation/auth'

/**
 * Auth Server Actions.
 *
 * Credentials are validated with the same Zod schema the form uses, so a
 * hand-crafted POST cannot skip the checks the UI performs.
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
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details and try again.' }
  }

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
    // Read by handle_new_user() for the profile's display name.
    options: { data: displayName ? { full_name: displayName } : {} },
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

  // Confirmations on → no session until the emailed link is clicked.
  if (!data.session) {
    return { error: null, confirmationRequired: true }
  }

  revalidatePath('/', 'layout')
  redirect(safeNext(formData.get('next')))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
