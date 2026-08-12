import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/server/supabase/proxy'

/**
 * Refreshes the Supabase session on every request and guards the app shell.
 *
 * (In Next.js 16 "middleware" is called "proxy". Same execution model.)
 *
 * Two jobs, in this order:
 *
 *  1. Call `getUser()` so the auth cookies are refreshed. Server Components
 *     cannot write cookies, so if this does not happen here the access token
 *     silently expires and users get logged out mid-session.
 *  2. Redirect unauthenticated visitors away from the authenticated shell, and
 *     signed-in users away from the auth pages.
 *
 * This is a convenience redirect, never the security boundary — Row Level
 * Security is. A request that slips past this still cannot read another user's
 * rows.
 */

/** Route prefixes that require a session. */
const PROTECTED = [
  '/dashboard',
  '/globe',
  '/maps',
  '/trips',
  '/vault',
  '/blogs',
  '/wishlist',
  '/timeline',
  '/analytics',
  '/resume',
  '/settings',
  '/trash',
  // Onboarding is behind a login but outside the app shell, so it needs its own
  // entry here. Whether it has been *completed* is decided by the shell, which
  // already has the profile row in hand — this only decides who may see it.
  '/welcome',
]

/** Auth pages a signed-in user has no reason to see. */
const AUTH_ROUTES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createProxyClient(request)

  // Must be getUser(), not getSession(): only getUser() revalidates the token
  // against the auth server. getSession() trusts whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve where they were heading so login can send them back.
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Carries the refreshed auth cookies. Returning anything else drops them.
  return getResponse()
}

export const config = {
  // Everything except static assets and image optimization. Without this the
  // proxy runs on every CSS and image request too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|geo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
