import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/shared/env'
import { HANDOFF_HEADER } from '@/shared/auth-handoff'
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
 *
 * The response also carries the forwarded request headers, which is how the
 * verified user reaches the render without a second trip to the auth server —
 * see `shared/auth-handoff.ts`. Whatever the client sent under that header name
 * is deleted here, before anything else runs and whether or not this request
 * turns out to be signed in: the deletion is unconditional so there is no path
 * where an inbound value survives.
 */
export function createProxyClient(request: NextRequest) {
  const env = publicEnv()

  const headers = new Headers(request.headers)
  headers.delete(HANDOFF_HEADER)

  /**
   * Refreshed auth cookies, held until the response is built.
   *
   * Accumulated rather than written onto a response as they arrive: the
   * response has to be constructed from the final request headers, and the
   * handoff token is not known until after `getUser()` has run — which is the
   * same call that produces these. Building the response once, at the end, is
   * what stops one of the two overwriting the other.
   */
  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = []

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            pendingCookies.push({ name, value, options })
          }
        },
      },
    }
  )

  return {
    supabase,
    /** Attaches the signed handoff token. Called once the user is known. */
    setVerifiedUser(token: string) {
      headers.set(HANDOFF_HEADER, token)
    },
    getResponse() {
      const response = NextResponse.next({ request: { headers } })
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options)
      }
      return response
    },
  }
}
