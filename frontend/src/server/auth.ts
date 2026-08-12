import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/server/supabase/server'

/**
 * Session access for Server Components, Server Actions and Route Handlers.
 *
 * `cache()` dedupes the auth round-trip within a single render pass, so a
 * layout and three nested pages asking "who is this?" cost one call, not four.
 */

export interface SessionUser {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  planCode: string
  /** Null until the onboarding wizard is finished. The app shell gates on it. */
  onboardedAt: string | null
}

/** The signed-in user with their profile and plan, or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()

  // getUser() revalidates against the auth server; getSession() would trust the
  // cookie as-is, which is not good enough to gate anything on.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Two independent reads, so they go out together: the profile row does not
  // tell us anything the subscription lookup needs.
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, onboarded_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('subscriptions').select('plan_code').eq('user_id', user.id).maybeSingle(),
  ])

  return {
    id: user.id,
    email: user.email ?? '',
    username: profile?.username ?? '',
    displayName: profile?.display_name || profile?.username || 'Traveller',
    avatarUrl: profile?.avatar_url ?? null,
    onboardedAt: profile?.onboarded_at ?? null,
    planCode: subscription?.plan_code ?? 'explorer',
  }
})

/**
 * Same, but redirects to /login instead of returning null.
 *
 * Use in any page under the authenticated shell. The proxy already redirects
 * unauthenticated requests; this is the belt to its braces, and it narrows the
 * type so callers do not have to null-check.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}
