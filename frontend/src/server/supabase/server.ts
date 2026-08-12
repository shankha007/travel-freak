import 'server-only'

import { cookies } from 'next/headers'
import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/shared/env'
import { serviceRoleKey } from '@/server/env'
import type { Database } from '@/shared/types/database'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Acts as the signed-in user, so RLS applies. Prefer this everywhere; reach for
 * `createAdminClient` only when there is genuinely no user context.
 *
 * `cache()` makes this one client per request rather than one per caller. A
 * dashboard render asks four query modules for a client; each construction
 * awaits `cookies()` and builds a fresh auth/storage/postgrest stack, and the
 * result is identical every time because the cookie store is. The cache is
 * per-request, so two users never share a client.
 */
export const createClient = cache(async function createClient() {
  const env = publicEnv()
  // Async in Next.js 16 — synchronous access to cookies() was removed.
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot set cookies. This is safe to ignore as
            // long as the proxy refreshes the session, which it does — see
            // src/proxy.ts.
          }
        },
      },
    }
  )
})

type AdminClient = ReturnType<typeof createSupabaseClient<Database>>

let adminClient: AdminClient | null = null

/**
 * Service-role client. **Bypasses Row Level Security entirely.**
 *
 * Legitimate uses are narrow: payment webhook handlers (no user session),
 * scheduled jobs, and admin tooling that has already performed its own
 * authorization check. Never pass user-supplied filters to it without
 * validating ownership yourself first — RLS is not there to catch you.
 *
 * Built once for the process rather than once per call. Unlike the user client
 * it carries no request state at all — no cookies, no session, no refresh
 * timer — so there is nothing to leak between requests, and publishing a trip
 * with two dozen photos stops constructing two dozen identical clients.
 */
export function createAdminClient(): AdminClient {
  if (adminClient) return adminClient

  const env = publicEnv()
  adminClient = createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}
