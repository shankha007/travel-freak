import { describe, expect, it } from 'vitest'
import { signHandoff, verifyHandoff } from './auth-handoff'

/**
 * The token stands between the proxy and every authenticated render, so these
 * tests are about what it refuses rather than what it allows. Every rejection
 * costs one `getUser()` call, which is what the code did before this existed —
 * there is no failure here that is worse than not having it.
 */

const SECRET = 'a-service-role-key-or-something-like-one'
const USER = { sub: '11111111-2222-3333-4444-555555555555', email: 'traveller@example.com' }

describe('signHandoff / verifyHandoff', () => {
  it('round-trips the claims', async () => {
    const claims = await verifyHandoff(await signHandoff(USER, SECRET), SECRET)

    expect(claims?.sub).toBe(USER.sub)
    expect(claims?.email).toBe(USER.email)
  })

  it('refuses a token signed with a different secret', async () => {
    const token = await signHandoff(USER, 'the-wrong-secret')

    expect(await verifyHandoff(token, SECRET)).toBeNull()
  })

  it('refuses a token nobody signed', async () => {
    // What a forged header looks like: the payload an attacker wants, with
    // whatever they can put after the dot.
    const payload = btoa(JSON.stringify({ ...USER, exp: Date.now() + 60_000 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    expect(await verifyHandoff(`${payload}.anything`, SECRET)).toBeNull()
    expect(await verifyHandoff(payload, SECRET)).toBeNull()
  })

  it('refuses a token whose claims were edited after signing', async () => {
    const token = await signHandoff(USER, SECRET)
    const signature = token.slice(token.lastIndexOf('.') + 1)
    const forged = btoa(
      JSON.stringify({ sub: 'somebody-else', email: 'x@example.com', exp: Date.now() + 60_000 })
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    expect(await verifyHandoff(`${forged}.${signature}`, SECRET)).toBeNull()
  })

  it('refuses an expired token', async () => {
    const issued = 1_000_000
    const token = await signHandoff(USER, SECRET, issued)

    expect(await verifyHandoff(token, SECRET, issued + 1_000)).not.toBeNull()
    // A minute later, past the TTL.
    expect(await verifyHandoff(token, SECRET, issued + 120_000)).toBeNull()
  })

  it('refuses nothing at all', async () => {
    expect(await verifyHandoff(null, SECRET)).toBeNull()
    expect(await verifyHandoff(undefined, SECRET)).toBeNull()
    expect(await verifyHandoff('', SECRET)).toBeNull()
    expect(await verifyHandoff('.', SECRET)).toBeNull()
  })

  it('refuses a payload that is not the shape the caller will trust', async () => {
    // Reached through the public API only, so the signature is genuine and the
    // rejection is the claim check rather than the HMAC. `sub` is the field
    // everything downstream keys on, so an empty one is not a user.
    const token = await signHandoff({ sub: '', email: USER.email }, SECRET)

    expect(await verifyHandoff(token, SECRET)).toBeNull()
  })

  it('survives an email with characters a delimiter would have broken', async () => {
    // The reason the claims are encoded rather than concatenated: an email is
    // user-controlled text and must not be able to change the other fields.
    const awkward = { sub: USER.sub, email: 'a.b|c."x".y@example.com' }
    const claims = await verifyHandoff(await signHandoff(awkward, SECRET), SECRET)

    expect(claims?.email).toBe(awkward.email)
    expect(claims?.sub).toBe(awkward.sub)
  })

  it('carries an empty email rather than refusing one', async () => {
    // Supabase allows a user with no email address; the token says so plainly
    // instead of failing a render over it.
    const claims = await verifyHandoff(
      await signHandoff({ sub: USER.sub, email: '' }, SECRET),
      SECRET
    )

    expect(claims?.email).toBe('')
    expect(claims?.sub).toBe(USER.sub)
  })
})
