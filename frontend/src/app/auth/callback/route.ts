import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/server/supabase/server'
import { captureFunnelEvent } from '@/server/funnel'

/**
 * Where Google sends the visitor back — the other half of `signInWithGoogle`.
 *
 * Separate from `/auth/confirm`, which handles emailed links, and the separation
 * is not tidiness: that route accepts a `token_hash` verified server-side
 * precisely so a link works in a different browser from the one that asked for
 * it. This is the opposite case. An OAuth `code` is PKCE, the verifier is in a
 * cookie this browser holds, and it *must* fail in any other browser. One route
 * with two contracts would eventually have the looser one applied to both.
 *
 * ## Signup and sign-in look identical here
 *
 * Google does not say which it was, and Supabase creates the user on first
 * arrival either way. `created_at` is what distinguishes them, so the funnel's
 * `signed_up` is fired below when the account is new — within a minute of now,
 * which is generous enough to survive a slow round trip and far short of a second
 * visit. Without it, everyone who signs up with Google would be missing from step
 * one and present at every step after, which is a funnel that reads as broken
 * product rather than broken instrumentation.
 */

/**
 * `next` came back from Google, which means it went out through a URL and is
 * treated as hostile: a relative path only, and never protocol-relative, which a
 * browser reads as another host.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

/** How recently a user must have been created to count as a signup. */
const NEW_ACCOUNT_WINDOW_MS = 60_000

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get('next'))
  const code = searchParams.get('code')

  // Google's own refusal — the visitor pressed Cancel, or the app is not
  // configured. Sent back to the form rather than to an error page: they were
  // trying to sign in, and the form is where they can.
  const error = searchParams.get('error')
  if (error) {
    const failed = new URL('/login', origin)
    failed.searchParams.set('error', 'oauth')
    return NextResponse.redirect(failed)
  }

  if (!code) {
    // No code and no error: somebody opened the route directly.
    return NextResponse.redirect(new URL('/login', origin))
  }

  const supabase = await createClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    const failed = new URL('/login', origin)
    failed.searchParams.set('error', 'oauth')
    return NextResponse.redirect(failed)
  }

  const user = data.user
  if (user) {
    const createdAt = Date.parse(user.created_at)
    const isNew = Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS
    if (isNew) captureFunnelEvent(user.id, 'signed_up')
  }

  return NextResponse.redirect(new URL(next, origin))
}
