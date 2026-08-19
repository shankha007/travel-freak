import { describe, expect, it } from 'vitest'
import { buildCsp, createNonce } from '@/shared/security'

/**
 * The policy is a string, so nothing about it fails a typecheck. These are the
 * directives whose absence is invisible until a browser refuses to draw
 * something — a map that never initialises, a photograph that never loads — and
 * the two that would silently weaken the strict half.
 *
 * The env these read is the one `vitest.setup.ts` installs, which points at the
 * local Supabase stack, so the host assertions are about the derivation rather
 * than about a hardcoded string.
 */

/** Splits a policy into `{ directive: sources }` so an assertion can be exact. */
function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split('; ').map((part) => {
      const [name, ...sources] = part.split(' ')
      return [name, sources]
    })
  )
}

describe('buildCsp', () => {
  it('allows a blob worker, which is how MapLibre starts', () => {
    // Not decoration: without this every 2D map fails to initialise, and the
    // console blames the worker rather than the policy.
    expect(directives(buildCsp())['worker-src']).toContain('blob:')
  })

  it('allows the Supabase host to serve images and be talked to', () => {
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
    const d = directives(buildCsp())

    expect(d['img-src']).toContain(supabase)
    expect(d['connect-src']).toContain(supabase)
    // Realtime is not subscribed to yet; the socket origin is allowed so that
    // the first subscription is not also a CSP bug.
    expect(d['connect-src']).toContain(supabase.replace(/^http/, 'ws'))
  })

  it('allows a data: image, because an upload is previewed before it is sent', () => {
    const d = directives(buildCsp())
    expect(d['img-src']).toContain('data:')
    expect(d['img-src']).toContain('blob:')
  })

  it('shuts the doors that have no legitimate use here', () => {
    const d = directives(buildCsp())
    expect(d['object-src']).toEqual(["'none'"])
    expect(d['frame-src']).toEqual(["'none'"])
    expect(d['frame-ancestors']).toEqual(["'none'"])
    expect(d['base-uri']).toEqual(["'self'"])
    expect(d['form-action']).toEqual(["'self'"])
  })

  describe('the strict policy, for the authenticated shell', () => {
    const strict = directives(buildCsp({ nonce: 'abc123' }))

    it('carries the nonce and strict-dynamic, and no inline escape hatch', () => {
      expect(strict['script-src']).toEqual(["'nonce-abc123'", "'strict-dynamic'"])
      expect(strict['script-src']).not.toContain("'unsafe-inline'")
    })

    it('still allows inline styles, which no nonce can cover', () => {
      // `style` attributes are set by MapLibre, three.js and every progress bar
      // here. A nonce applies to elements, not attributes.
      expect(strict['style-src']).toContain("'unsafe-inline'")
    })
  })

  describe('the public policy, for the pages that are prerendered', () => {
    const open = directives(buildCsp())

    it('tolerates inline scripts but never a script from elsewhere', () => {
      expect(open['script-src']).toContain("'unsafe-inline'")
      expect(open['script-src']).toEqual(["'self'", "'unsafe-inline'"])
    })
  })

  it('adds unsafe-eval in development only, and no upgrade there', () => {
    // React's dev overlay evaluates code to rebuild server stacks in the
    // browser. Production needs neither that nor an upgrade of a local http
    // Supabase URL that would then point at nothing.
    expect(buildCsp({ dev: true })).toContain("'unsafe-eval'")
    expect(buildCsp({ dev: true })).not.toContain('upgrade-insecure-requests')

    expect(buildCsp()).not.toContain("'unsafe-eval'")
    expect(buildCsp()).toContain('upgrade-insecure-requests')
  })

  it('allows no analytics origin while none is configured', () => {
    // The SDKs are no-ops without their keys, and an origin nothing talks to is
    // an origin an injection could talk to.
    const sources = directives(buildCsp())['connect-src'].join(' ')
    expect(sources).not.toContain('sentry')
    expect(sources).not.toContain('posthog')
  })
})

describe('createNonce', () => {
  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 100 }, () => createNonce()))
    expect(seen.size).toBe(100)
  })

  it('is long enough to be unguessable', () => {
    // 16 random bytes, base64 — anything shorter is a nonce in name only.
    expect(createNonce().length).toBeGreaterThanOrEqual(22)
  })
})
