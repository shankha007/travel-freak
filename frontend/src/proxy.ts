import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/server/supabase/proxy'
import { signHandoff } from '@/shared/auth-handoff'
import { buildCsp } from '@/shared/security'

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
 *  3. Pass the user it just verified to the render, as a signed request header,
 *     so `getSessionUser()` does not have to ask the auth server the same
 *     question a second time. See `shared/auth-handoff.ts` for why that header
 *     is signed and what happens when it is not there.
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

const CSP_HEADER = 'Content-Security-Policy'

export async function proxy(request: NextRequest) {
  const { supabase, getResponse, setVerifiedUser } = createProxyClient(request)

  // Must be getUser(), not getSession(): only getUser() revalidates the token
  // against the auth server. getSession() trusts whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  // One policy for every route. `shared/security.ts` explains why the shell no
  // longer gets a stricter, nonce-based one — it blocked next-themes' no-flash
  // script, and both ways of exempting that script cost more than the nonce was
  // worth.
  const csp = buildCsp({ dev: process.env.NODE_ENV === 'development' })

  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve where they were heading so login can send them back.
    url.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(url)
    // A redirect renders nothing, but a response without the header is a
    // response an audit has to explain, and the cost is one string.
    redirect.headers.set(CSP_HEADER, csp)
    return redirect
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    const redirect = NextResponse.redirect(url)
    redirect.headers.set(CSP_HEADER, csp)
    return redirect
  }

  // Only on the way to a render. A redirect above returns before this, which is
  // correct — the response it returns is not the one being rendered, and a
  // token on it would go nowhere.
  //
  // Skipped silently when the secret is unavailable: the render then falls back
  // to `getUser()`, which is exactly what it did before this existed. An
  // unsigned token is never sent.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (user && secret) {
    setVerifiedUser(await signHandoff({ sub: user.id, email: user.email ?? '' }, secret))
  }

  // Carries the refreshed auth cookies. Returning anything else drops them.
  const response = getResponse()
  response.headers.set(CSP_HEADER, csp)
  return response
}

export const config = {
  // Everything except static assets and image optimization. Without this the
  // proxy runs on every CSS and image request too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|geo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
