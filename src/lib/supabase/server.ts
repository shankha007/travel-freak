import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serviceRoleKey } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Acts as the signed-in user, so RLS applies. Prefer this everywhere; reach for
 * `createAdminClient` only when there is genuinely no user context.
 */
export async function createClient() {
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
}

/**
 * Service-role client. **Bypasses Row Level Security entirely.**
 *
 * Legitimate uses are narrow: payment webhook handlers (no user session),
 * scheduled jobs, and admin tooling that has already performed its own
 * authorization check. Never pass user-supplied filters to it without
 * validating ownership yourself first — RLS is not there to catch you.
 */
export function createAdminClient() {
  const env = publicEnv()
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
