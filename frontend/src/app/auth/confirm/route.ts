import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/server/supabase/server'

/**
 * Where every emailed auth link lands — screen 9.
 *
 * The link carries proof, not a session. This route trades that proof for one
 * and then forwards to the page that needs it: `/reset-password` for a recovery
 * link, `/verify` for a confirmation. Nothing downstream has to know which kind
 * of token it came from.
 *
 * Two forms are accepted, because two are in circulation:
 *
 *  - `token_hash` + `type`, which is what our own email templates send. It is
 *    verified here, so the link works in a different browser from the one that
 *    asked for it — someone requesting a reset on a laptop and opening the mail
 *    on their phone is the normal case, not the exception.
 *  - `code`, which is what Supabase's stock templates produce after their own
 *    `/verify` redirect. This is the PKCE path: the exchange needs the verifier
 *    cookie, so it only works in the browser that made the request. Supported so
 *    that a project running the default templates still functions, but it is
 *    the reason ours exist.
 *
 * On failure it redirects to `/verify?error=…` rather than rendering anything.
 * An expired link is a normal event — they expire in an hour by design — and it
 * deserves a page with a way forward rather than a stack trace.
 */

/** The `type` values worth honouring here. Anything else is not one of our links. */
const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email_change',
  'email',
])

/**
 * `next` comes from a URL in an email, so it is treated as hostile: a relative
 * path only, and never protocol-relative, which browsers read as another host.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get('next'))
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const code = searchParams.get('code')

  const type = EMAIL_OTP_TYPES.has(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null

  const supabase = await createClient()

  // The kind of link is carried through to the failure page, which otherwise
  // offers to resend a confirmation to someone whose *reset* link went stale.
  const failed = new URL('/verify', origin)
  failed.searchParams.set('error', 'expired')
  if (type) failed.searchParams.set('type', type)

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
    return NextResponse.redirect(failed)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
    return NextResponse.redirect(failed)
  }

  // No proof at all: somebody opened the route directly.
  return NextResponse.redirect(new URL('/verify?error=missing', origin))
}
