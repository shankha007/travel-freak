import { z } from 'zod'
import { isKnownCountry } from '@/shared/geo/countries'
import { usernameSchema } from '@/shared/validation/onboarding'
import { MIN_PASSWORD_LENGTH } from '@/shared/validation/auth'

/**
 * Settings input — screens 39, 40 and 41.
 *
 * The username rules are imported from `onboarding.ts` rather than restated:
 * the reserved list and the character class are the same question asked twice,
 * and a settings screen that accepts `/u/admin` because it had its own copy of
 * the rules would be a hole nobody thought they had opened.
 */

/** How many interests a profile may list, and how long each may be. */
export const MAX_INTERESTS = 10
const MAX_INTEREST_LENGTH = 30

export const profileSettingsSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(80, { error: 'Keep it under 80 characters' }).default(''),
  bio: z.string().trim().max(300, { error: 'Keep the bio under 300 characters' }).default(''),
  /** Home country in ISO alpha-3, or null. Optional — not everyone wants to say. */
  countryCode: z
    .string()
    .trim()
    .refine((v) => v === '' || (v.length === 3 && isKnownCountry(v)), {
      error: 'Pick a country from the list',
    })
    .transform((v) => (v === '' ? null : v))
    .default(''),
  city: z.string().trim().max(120, { error: 'Keep the city under 120 characters' }).default(''),
  interests: z
    .array(z.string().trim().min(1).max(MAX_INTEREST_LENGTH))
    .max(MAX_INTERESTS, { error: `At most ${MAX_INTERESTS} interests` })
    .default([]),
})

export type ProfileSettingsValues = z.output<typeof profileSettingsSchema>

/**
 * Turns the comma-separated field into the array the column holds.
 *
 * Exported and tested because it is the only lossy step in the form: everything
 * a person types that is not an interest — a trailing comma, a double space, the
 * same word twice — has to disappear here or become a row of junk on a public
 * profile. Case is preserved, because "UNESCO" and "Unesco" are the writer's
 * business, but duplicates are matched case-insensitively.
 */
export function parseInterests(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const part of raw.split(',')) {
    const value = part.trim().replace(/\s+/g, ' ').slice(0, MAX_INTEREST_LENGTH)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length === MAX_INTERESTS) break
  }

  return out
}

/** The visibility a new trip starts on. Same three the `visibility` enum has. */
export const VISIBILITY_OPTIONS = [
  {
    value: 'private',
    label: 'Private',
    hint: 'Only you. The safest default, and the one the product ships with.',
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    hint: 'Reachable by anyone you give a link to, and by nobody else.',
  },
  {
    value: 'public',
    label: 'Public',
    hint: 'Listed on your profile and open to search engines once published.',
  },
] as const

export type VisibilityOption = (typeof VISIBILITY_OPTIONS)[number]['value']

export const privacySettingsSchema = z.object({
  isPublic: z.boolean(),
  defaultTripVisibility: z.enum(['private', 'unlisted', 'public'], {
    error: 'Pick one of the three',
  }),
})

export type PrivacySettingsValues = z.output<typeof privacySettingsSchema>

export const changePasswordSchema = z
  .object({
    // Held to the sign-in minimum, not the sign-up one: an older account's
    // password is allowed to be shorter than what we would issue today, and
    // rejecting it here would lock its owner out of changing it.
    currentPassword: z.string().min(1, { error: 'Enter your current password' }),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, {
        error: `At least ${MIN_PASSWORD_LENGTH} characters`,
      })
      // bcrypt silently ignores everything past 72 bytes, so a longer password
      // is not the password its owner thinks it is.
      .max(72, { error: 'At most 72 characters' }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: 'Those do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    error: 'That is the password you already have',
    path: ['newPassword'],
  })

export const changeEmailSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }).max(254),
})
