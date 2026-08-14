'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { SITE_URL } from '@/shared/brand'
import {
  changeEmailSchema,
  changePasswordSchema,
  parseInterests,
  privacySettingsSchema,
  profileSettingsSchema,
} from '@/shared/validation/settings'

/**
 * Settings writes — screens 39, 40 and 41.
 *
 * Every one of these validates with the same schema the form used, so a
 * hand-crafted POST faces the checks the UI performs. The profile writes are
 * scoped by `id` as well as being protected by RLS: the policy would refuse
 * someone else's row anyway, and a silent no-op is a worse answer than never
 * having tried.
 */

export interface SettingsState {
  error: string | null
  fieldErrors?: Record<string, string>
  /** A sentence to show on success, since these forms stay on the page. */
  message?: string
  saved?: boolean
  /**
   * The rejected submission, echoed back verbatim.
   *
   * React resets an uncontrolled form once its action returns, so without this
   * a rewritten bio is thrown away to be told the username was taken — the
   * failure costs the user the work they did on the fields that were fine.
   * Only the profile form needs it; the others have one field each, or none
   * worth keeping.
   */
  values?: Record<string, string>
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.')
    fieldErrors[key] ??= issue.message
  }
  return fieldErrors
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

/** Everything that changes what a public profile looks like. */
function repaintProfile(username: string) {
  revalidatePath('/settings')
  revalidatePath('/resume')
  revalidatePath('/dashboard')
  if (username) revalidatePath(`/u/${username}`)
}

// ---------------------------------------------------------------------------
// Profile — screen 39
// ---------------------------------------------------------------------------

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const values = {
    username: text(formData, 'username'),
    displayName: text(formData, 'displayName'),
    bio: text(formData, 'bio'),
    countryCode: text(formData, 'countryCode'),
    city: text(formData, 'city'),
    interests: text(formData, 'interests'),
  }

  const parsed = profileSettingsSchema.safeParse({
    ...values,
    interests: parseInterests(values.interests),
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error.issues),
      values,
    }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio,
      country_code: parsed.data.countryCode,
      city: parsed.data.city,
      travel_interests: parsed.data.interests,
    })
    .eq('id', user.id)
    .select('username')
    .maybeSingle()

  if (error) {
    // `profiles_username_key`. Taken is a normal answer to a rename, not a
    // failure — and saying so is not a leak: the profile at that name is
    // already public or already 404s, whichever it was before.
    if (error.code === '23505') {
      return {
        error: 'That username is taken.',
        fieldErrors: { username: 'Someone already has this one' },
        values,
      }
    }
    return { error: 'Could not save that. Please try again.', values }
  }

  if (!data) return { error: 'Your profile could not be found.', values }

  repaintProfile(data.username)
  return { error: null, saved: true, message: 'Profile saved.' }
}

// ---------------------------------------------------------------------------
// Privacy — screen 41
// ---------------------------------------------------------------------------

export async function updatePrivacy(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const parsed = privacySettingsSchema.safeParse({
    // An unchecked checkbox sends nothing at all, which is the difference
    // between "off" and "absent" — both mean off here.
    isPublic: formData.get('isPublic') === 'on',
    defaultTripVisibility: text(formData, 'defaultTripVisibility'),
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_public: parsed.data.isPublic,
      default_trip_visibility: parsed.data.defaultTripVisibility,
    })
    .eq('id', user.id)
    .select('username')
    .maybeSingle()

  if (error) return { error: 'Could not save that. Please try again.' }
  if (!data) return { error: 'Your profile could not be found.' }

  repaintProfile(data.username)
  return { error: null, saved: true, message: 'Privacy settings saved.' }
}

// ---------------------------------------------------------------------------
// Account & security — screen 40
// ---------------------------------------------------------------------------

/**
 * Changes the password, after proving the current one.
 *
 * Supabase can be configured to demand a recent sign-in for this
 * (`secure_password_change`), and locally it is not. Verifying by hand rather
 * than relying on the setting means the behaviour is the same on both, and it
 * closes the case a settings screen otherwise opens: a borrowed unlocked laptop
 * being enough to lock its owner out of their own account.
 */
export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, 'currentPassword'),
    newPassword: text(formData, 'newPassword'),
    confirmPassword: text(formData, 'confirmPassword'),
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { error: wrongPassword } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  })

  if (wrongPassword) {
    return {
      error: 'That current password is not right.',
      fieldErrors: { currentPassword: 'This does not match your password' },
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })

  if (error) {
    // Supabase refuses a password it finds in a breach corpus, which is worth
    // passing on verbatim — it is the one message here the user can act on.
    return { error: error.message || 'Could not change your password. Please try again.' }
  }

  return {
    error: null,
    saved: true,
    message: 'Password changed. Other devices stay signed in until their session expires.',
  }
}

/**
 * Starts a change of email address.
 *
 * Nothing changes until the link is clicked, so the message says so. The
 * confirmation goes to `/auth/confirm`, the same route the reset and sign-up
 * links use, because it takes a token hash and therefore works on a different
 * device from the one that asked.
 */
export async function changeEmail(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const parsed = changeEmailSchema.safeParse({ email: text(formData, 'email') })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    }
  }

  const user = await requireUser()

  if (parsed.data.email.toLowerCase() === user.email.toLowerCase()) {
    return {
      error: 'That is already your address.',
      fieldErrors: { email: 'This is the address you have' },
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${SITE_URL}/auth/confirm?next=/settings` }
  )

  if (error) {
    return { error: 'Could not start that change. Please try again.' }
  }

  revalidatePath('/settings')
  return {
    error: null,
    saved: true,
    message: `Check ${parsed.data.email} for a confirmation link. Your address does not change until you open it.`,
  }
}
