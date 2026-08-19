import { describe, expect, it } from 'vitest'
import { buildCsp } from '@/shared/security'

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

  describe('the script policy', () => {
    const d = directives(buildCsp())

    it('tolerates an inline script but never one from elsewhere', () => {
      // `'unsafe-inline'` is a stated concession — see the note at the top of
      // `security.ts` for the nonce that was tried and why it was reverted. The
      // half that still holds is `'self'`: a remote `<script src>` is refused,
      // and that is what an injected tag actually needs.
      expect(d['script-src']).toEqual(["'self'", "'unsafe-inline'"])
    })

    it('is one policy, whatever the route', () => {
      // The nonce split is gone. If it ever returns, it has to answer for
      // next-themes' no-flash script first.
      expect(buildCsp()).toBe(buildCsp())
      expect(directives(buildCsp())['script-src']).not.toContain("'strict-dynamic'")
    })

    it('allows inline styles, which are style attributes and unavoidable', () => {
      // Set by MapLibre, three.js and every progress bar here. Only
      // `style-src-attr` could narrow this.
      expect(d['style-src']).toContain("'unsafe-inline'")
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
