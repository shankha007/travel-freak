import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { getEntitlements } from '@/server/entitlements'
import type { VisibilityOption } from '@/shared/validation/settings'

/**
 * Everything `/settings` renders — screens 39, 40 and 41.
 *
 * One row and one plan lookup. The email comes from `auth.users` rather than
 * from `profiles`, because that is where it actually lives and where a pending
 * change would show up: `profiles` never holds a copy, so there is nothing to
 * keep in sync.
 */

export interface SettingsData {
  email: string
  /** Set while a change of address is waiting on the new one being confirmed. */
  pendingEmail: string | null
  username: string
  displayName: string
  bio: string
  countryCode: string | null
  city: string
  interests: string[]
  isPublic: boolean
  defaultTripVisibility: VisibilityOption
  /** True once publication strips metadata. Always true today — see the page. */
  stripExifOnPublish: boolean
  memberSince: string
  planCode: string
  planName: string
}

export async function getSettings(): Promise<SettingsData> {
  const supabase = await createClient()
  const user = await requireUser()

  const [{ data: authUser }, { data: profile }, entitlements] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('profiles')
      .select(
        'username, display_name, bio, country_code, city, travel_interests, is_public, default_trip_visibility, strip_exif_on_publish, created_at'
      )
      .eq('id', user.id)
      .maybeSingle(),
    getEntitlements(),
  ])

  return {
    email: authUser.user?.email ?? user.email,
    // Supabase parks the requested address here until the link in it is
    // clicked. Showing it is what stops "I changed my email and nothing
    // happened" — the change is real, it is just not finished.
    pendingEmail: authUser.user?.new_email ?? null,
    username: profile?.username ?? '',
    displayName: profile?.display_name ?? '',
    bio: profile?.bio ?? '',
    countryCode: profile?.country_code ?? null,
    city: profile?.city ?? '',
    interests: profile?.travel_interests ?? [],
    isPublic: profile?.is_public ?? false,
    defaultTripVisibility: (profile?.default_trip_visibility ?? 'private') as VisibilityOption,
    stripExifOnPublish: profile?.strip_exif_on_publish ?? true,
    memberSince: profile?.created_at ?? new Date().toISOString(),
    planCode: entitlements.planCode,
    planName: entitlements.planName,
  }
}

/**
 * The visibility a new trip should start on.
 *
 * Read by `/trips/new` so the setting on this screen is a setting rather than a
 * stored preference nothing consults. Falls back to `private` on any failure:
 * the default for "we could not find out" has to be the closed one.
 */
export async function getDefaultTripVisibility(): Promise<VisibilityOption> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data } = await supabase
    .from('profiles')
    .select('default_trip_visibility')
    .eq('id', user.id)
    .maybeSingle()

  return (data?.default_trip_visibility ?? 'private') as VisibilityOption
}
