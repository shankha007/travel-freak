import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/shared/env'
import type { Database } from '@/shared/types/database'

/**
 * Creates a Supabase client bound to the proxy request/response pair, and
 * returns it alongside the response carrying any refreshed auth cookies.
 *
 * (In Next.js 16 "middleware" is called "proxy". Same execution model.)
 *
 * Callers must return the `response` object — or copy its cookies onto whatever
 * they return instead — otherwise refreshed sessions are dropped and users get
 * logged out at random.
 */
export function createProxyClient(request: NextRequest) {
  const env = publicEnv()

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  return { supabase, getResponse: () => response }
}
