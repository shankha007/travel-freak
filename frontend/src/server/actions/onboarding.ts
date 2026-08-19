'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { captureFunnelEvent } from '@/server/funnel'
import {
  onboardingProfileSchema,
  visitedCountriesSchema,
  type OnboardingProfileInput,
} from '@/shared/validation/onboarding'

/**
 * Onboarding — screen 10.
 *
 * Three writes, each its own action, because the wizard saves as it goes: a
 * browser closed on step two should not lose step one. The steps are also
 * genuinely independent — a username, a home country and a list of countries
 * visited have nothing to do with each other beyond happening in sequence.
 *
 * Only `finish` sets `onboarded_at`, which is what the app shell checks. So an
 * abandoned wizard is resumed rather than skipped, and nothing is lost.
 */

export interface OnboardingResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** Step one: who you are. */
export async function saveOnboardingProfile(
  input: OnboardingProfileInput
): Promise<OnboardingResult> {
  const user = await requireUser()

  const parsed = onboardingProfileSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const { username, displayName, countryCode, city } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: displayName,
      country_code: countryCode,
      city: city || null,
    })
    .eq('id', user.id)

  if (error) {
    // 23505 is the unique index on username. Everyone starts with one derived
    // from their email, so a collision here is someone choosing a taken name —
    // a field error, not a failure.
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'Please fix the highlighted fields.',
        fieldErrors: { username: 'That username is taken' },
      }
    }
    return { ok: false, error: `Could not save that: ${error.message}` }
  }

  return { ok: true }
}

/**
 * Step two: the countries you have already been to.
 *
 * Replaces the whole set rather than diffing it. The wizard holds the complete
 * selection in state, so sending it whole means the server never has to trust a
 * sequence of toggles to have arrived in order, or at all.
 *
 * Marks are not trips: they cost no quota and appear in no list. They exist to
 * paint the globe, and the aggregate prefers a real trip wherever one exists —
 * see migration 20260813000600.
 */
export async function saveVisitedCountries(codes: string[]): Promise<OnboardingResult> {
  const user = await requireUser()

  const parsed = visitedCountriesSchema.safeParse(codes)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Those countries look wrong.' }
  }

  const supabase = await createClient()

  const { error: clearError } = await supabase
    .from('visited_countries')
    .delete()
    .eq('user_id', user.id)

  if (clearError) {
    return { ok: false, error: `Could not save your countries: ${clearError.message}` }
  }

  if (parsed.data.length > 0) {
    const { error } = await supabase
      .from('visited_countries')
      .insert(parsed.data.map((code) => ({ user_id: user.id, country_code: code })))

    if (error) {
      return { ok: false, error: `Could not save your countries: ${error.message}` }
    }
  }

  // Every insert fired the aggregate trigger, so the globe is already stale.
  revalidatePath('/globe')
  revalidatePath('/dashboard')
  revalidatePath('/maps/world')
  return { ok: true }
}

/**
 * Step three: done.
 *
 * Sets `onboarded_at`, which is the flag that stops the app shell sending them
 * back here, and lands on the globe — the thing they just filled in. Sending
 * them to the dashboard would show counters; the globe shows the payoff.
 */
export async function finishOnboarding(): Promise<void> {
  const user = await requireUser()
  const supabase = await createClient()

  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id)
    // Re-running the wizard later must not rewrite the original date.
    .is('onboarded_at', null)

  // Step two. Unconditional, unlike the update above: the `is null` guard is
  // there so a second run cannot rewrite the original date, and an account that
  // walks back through the wizard has still completed onboarding once. PostHog
  // funnels count the first occurrence per person, so a repeat costs nothing.
  captureFunnelEvent(user.id, 'onboarding_completed')

  revalidatePath('/globe')
  revalidatePath('/dashboard')
  redirect('/globe?welcome=1')
}
