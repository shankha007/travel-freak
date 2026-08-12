import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { suggestUsername } from '@/shared/validation/onboarding'
import { WelcomeWizard, type WelcomeInitial } from '@/client/components/onboarding/welcome-wizard'

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Set up your globe.',
  // Nothing about a half-finished account belongs in an index.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Onboarding — screen 10.
 *
 * Resumable: the wizard is loaded with whatever the account already has, so
 * someone who closed the tab on step two comes back to step two's answers rather
 * than a blank form. Someone who has already finished is sent on — the wizard is
 * a first-run experience, and re-running it would imply their globe was not set
 * up when it is.
 */
export default async function WelcomePage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [profileResult, markResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, country_code, city, onboarded_at')
      .eq('id', user.id)
      .single(),
    supabase.from('visited_countries').select('country_code').eq('user_id', user.id),
  ])

  const profile = profileResult.data
  if (profile?.onboarded_at) redirect('/dashboard')

  const initial: WelcomeInitial = {
    // handle_new_user() already derived one from the email; this is the same
    // derivation, for the case where a profile row somehow has none.
    username: profile?.username || suggestUsername(user.email),
    displayName: profile?.display_name || '',
    countryCode: profile?.country_code ?? '',
    city: profile?.city ?? '',
    visitedCountries: (markResult.data ?? []).map((m) => m.country_code),
  }

  return <WelcomeWizard initial={initial} />
}
