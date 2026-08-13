import { z } from 'zod'

/**
 * Credential schemas, shared by the auth forms and the Server Actions.
 *
 * One definition means a hand-crafted POST faces exactly the checks the UI
 * performs. The client parse is for error messages; the server parse is the
 * one that matters.
 */

/** Matches `auth.minimum_password_length` in supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 8

export const signInSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
  // Deliberately laxer than sign-up: existing accounts predate the current
  // minimum, and rejecting their password here would only tell an attacker how
  // short it is.
  password: z.string().min(6, { error: 'Password must be at least 6 characters' }),
})

export const signUpSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters — this is the key to your memories`,
    })
    .max(72, { error: 'Passwords are limited to 72 characters' }),
  /**
   * Optional: `handle_new_user()` derives a username from the email and seeds
   * the profile, so a name is a nicety rather than a requirement. Asking for
   * less at the door is worth more than a filled-in field.
   */
  displayName: z.string().trim().max(80, { error: 'Keep it under 80 characters' }).default(''),
})

export type SignUpValues = z.output<typeof signUpSchema>

/** Asking for a reset link. The address is all that is needed, and all that is asked. */
export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
})

/**
 * Choosing a new password.
 *
 * Held to the sign-up minimum rather than the sign-in one: this is a password
 * being created, so there is no existing account whose shorter password would
 * be locked out by the rule.
 *
 * The confirmation field is not security — someone who has the recovery link
 * can set whatever they like either way. It is there because a typo in a
 * password you cannot see locks you out of your own account, and the reset
 * link that would fix it has just been spent.
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, {
        error: `Use at least ${MIN_PASSWORD_LENGTH} characters — this is the key to your memories`,
      })
      .max(72, { error: 'Passwords are limited to 72 characters' }),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: 'The two passwords do not match',
    path: ['confirmPassword'],
  })
