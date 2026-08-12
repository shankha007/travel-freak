import { z } from 'zod'
import { isKnownCountry } from '@/shared/geo/countries'

/**
 * Onboarding input, shared by the wizard and its Server Actions.
 *
 * The username rules mirror the `profiles.username` check constraint exactly —
 * 3–30 characters of lowercase letters, digits and underscore — because a
 * mismatch here means the database rejects what the form accepted, and the user
 * sees a stack trace instead of "that one is taken".
 */

/** Matches the CHECK on profiles.username. */
export const USERNAME_RE = /^[a-z0-9_]+$/

/**
 * Names the product needs for itself, or that would be misleading on a public
 * profile URL. `/u/admin` should not be claimable.
 */
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'blog',
  'blogs',
  'changelog',
  'dashboard',
  'help',
  'login',
  'logout',
  'me',
  'onboarding',
  'privacy',
  'register',
  'root',
  'settings',
  'support',
  'system',
  'terms',
  'trash',
  'travelfreak',
  'trip',
  'trips',
  'u',
  'user',
  'welcome',
])

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: 'At least 3 characters' })
  .max(30, { error: 'At most 30 characters' })
  .refine((v) => USERNAME_RE.test(v), {
    error: 'Lowercase letters, numbers and underscores only',
  })
  .refine((v) => !RESERVED_USERNAMES.has(v), { error: 'That one is reserved' })

export const onboardingProfileSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(80, { error: 'Keep it under 80 characters' }),
  /** Home country, in ISO alpha-3. Optional — not everyone wants to say. */
  countryCode: z
    .string()
    .trim()
    .refine((v) => v === '' || (v.length === 3 && isKnownCountry(v)), {
      error: 'Pick a country from the list',
    })
    .transform((v) => (v === '' ? null : v)),
  city: z.string().trim().max(120).optional().default(''),
})

export type OnboardingProfileInput = z.input<typeof onboardingProfileSchema>

/**
 * The tapped countries.
 *
 * Capped at 300 — there are ~250 countries, so anything beyond that is a client
 * sending nonsense rather than a well-travelled user. Duplicates are collapsed
 * rather than rejected: the primary key would reject them anyway, and a repeated
 * code in a payload is a UI glitch, not something to fail the whole step over.
 */
export const visitedCountriesSchema = z
  .array(z.string().trim().length(3).refine(isKnownCountry, { error: 'Unknown country code' }))
  .max(300, { error: 'That is more countries than there are' })
  .transform((codes) => [...new Set(codes)])

/**
 * Suggests a username from an email address or display name.
 *
 * The same derivation `handle_new_user()` uses in SQL, so the field is
 * pre-filled with what the account already has rather than being empty.
 */
export function suggestUsername(source: string): string {
  const base = source
    .split('@')[0]
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24)

  return base.length >= 3 ? base : 'traveller'
}
