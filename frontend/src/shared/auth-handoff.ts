/**
 * Handing the proxy's verified user to the render that follows it.
 *
 * Every authenticated navigation used to revalidate the session twice. The
 * proxy calls `getUser()` because it is the only place that can write refreshed
 * auth cookies back; the app shell then calls it again through
 * `getSessionUser()`, because trusting a cookie is not good enough to gate on.
 * `cache()` dedupes the second one within a render, but the proxy is a separate
 * pass — so both hit the Supabase auth server, two network round trips deep, in
 * front of every screen and before any of the page's own queries start.
 *
 * The proxy has already done the work. This is how the answer travels: a
 * request header the proxy sets, which `getSessionUser()` reads instead of
 * asking again.
 *
 * **Why it is signed.** A request header is client-supplied by default. The
 * proxy deletes any inbound copy before setting its own, and its matcher covers
 * every route that can render a page — so on a correct deployment a forged
 * header never arrives. That is one mistake away from an authentication bypass,
 * which is not a thing to leave resting on a matcher regex. The token is
 * therefore an HMAC over the user id and an expiry, keyed on a secret only the
 * server has: a forged header does not verify, and the fallback for anything
 * that does not verify is the `getUser()` call this exists to avoid. The worst
 * case is the behaviour we started with.
 *
 * Web Crypto rather than `node:crypto`, because the proxy may run on the Edge
 * runtime, where the Node module does not exist.
 */

/** The header the proxy sets and the render reads. */
export const HANDOFF_HEADER = 'x-verified-user'

/**
 * How long a token stays good for.
 *
 * It only has to survive one request, so this is generous. It is not the thing
 * keeping a session alive — that is still the auth cookie, and this token says
 * nothing a valid cookie did not already say a moment earlier.
 */
const TTL_MS = 60_000

/**
 * What the proxy already knows and the render would otherwise re-fetch.
 *
 * The email is in here because it is the one field `getSessionUser()` takes
 * from the auth row rather than from `profiles` — without it, skipping
 * `getUser()` would blank the address on the account screen. It never leaves
 * the server: this header travels from the proxy to the render and is not part
 * of the response.
 */
export interface HandoffClaims {
  sub: string
  email: string
  /** Epoch milliseconds. */
  exp: number
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

async function hmac(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return toBase64Url(new Uint8Array(signature))
}

/**
 * `<base64url(claims)>.<signature>`.
 *
 * The claims are encoded rather than concatenated so no field can be smuggled
 * across a delimiter — an email is user-controlled text, and a separator inside
 * one must not be able to change what the other half says.
 */
export async function signHandoff(
  claims: { sub: string; email: string },
  secret: string,
  now: number = Date.now()
): Promise<string> {
  const json = JSON.stringify({ ...claims, exp: now + TTL_MS } satisfies HandoffClaims)
  const payload = toBase64Url(new TextEncoder().encode(json))
  return `${payload}.${await hmac(payload, secret)}`
}

/**
 * The claims a token vouches for, or null.
 *
 * Null for anything at all suspect — malformed, expired, wrong signature — and
 * the caller's answer to null is to ask the auth server itself. There is no
 * failure mode here that is less safe than not having the token.
 */
export async function verifyHandoff(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now()
): Promise<HandoffClaims | null> {
  if (!token) return null

  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null

  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  // Verified before the payload is so much as parsed: an unsigned token's
  // contents are an attacker's text, and nothing should act on them.
  const expected = await hmac(payload, secret)

  // Constant-time over equal-length strings. Both are base64url of a SHA-256
  // digest, so a length mismatch is already a rejection.
  if (expected.length !== signature.length) return null
  let difference = 0
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  if (difference !== 0) return null

  const decoded = fromBase64Url(payload)
  if (!decoded) return null

  let claims: HandoffClaims
  try {
    claims = JSON.parse(new TextDecoder().decode(decoded)) as HandoffClaims
  } catch {
    return null
  }

  if (typeof claims?.sub !== 'string' || claims.sub === '') return null
  if (typeof claims.email !== 'string') return null
  if (!Number.isFinite(claims.exp) || claims.exp <= now) return null

  return claims
}
