import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/server/supabase/server'
import { HANDOFF_HEADER, verifyHandoff } from '@/shared/auth-handoff'

/**
 * Session access for Server Components, Server Actions and Route Handlers.
 *
 * `cache()` dedupes the auth round-trip within a single render pass, so a
 * layout and three nested pages asking "who is this?" cost one call, not four.
 *
 * The proxy has usually verified the session already, a pass earlier, and
 * `cache()` cannot reach across that boundary. `shared/auth-handoff.ts` is how
 * its answer gets here: a signed header this reads in place of a second call to
 * the auth server. When there is no valid token — a prerender, a deployment
 * without the proxy, anything forged — it asks the auth server itself, exactly
 * as it always did.
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
  // cookie as-is, which is not good enough to gate anything on. It is skipped
  // only when the proxy has already done it, a pass earlier, and signed for the
  // answer.
  const user = (await handedOffUser()) ?? (await fetchUser(supabase))

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

/** Identity as the two paths below produce it. */
interface VerifiedUser {
  id: string
  email: string | null
}

/**
 * The user the proxy verified this request for, if it said so and can prove it.
 *
 * Returns null on every doubt: no header, no secret to check it against, a
 * signature that does not match, an expiry that has passed. Null simply costs
 * the call this exists to skip.
 *
 * `headers()` throws outside a request — during static generation, for
 * instance — and that is another perfectly good null.
 */
async function handedOffUser(): Promise<VerifiedUser | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null

  let token: string | null = null
  try {
    token = (await headers()).get(HANDOFF_HEADER)
  } catch {
    return null
  }

  const claims = await verifyHandoff(token, secret)
  return claims ? { id: claims.sub, email: claims.email } : null
}

/** The original path: ask the auth server. */
async function fetchUser(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<VerifiedUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user ? { id: user.id, email: user.email ?? null } : null
}

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
