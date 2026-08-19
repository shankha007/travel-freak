import { publicEnv } from '@/shared/env'

/**
 * The Content Security Policy.
 *
 * Kept out of `proxy.ts` because a policy is read far more often than it is
 * changed, and because it is worth unit-testing: a directive lost in an edit is
 * invisible until a browser quietly refuses to draw a map.
 *
 * ## Two policies, and why
 *
 * A nonce is the only way to allow Next's own inline bootstrap script without
 * allowing every inline script, and a nonce **has to be generated per request** —
 * which means the page carrying it cannot be prerendered. That is free on the
 * authenticated shell, where every route is already `force-dynamic` because it
 * reads the signed-in user, and expensive everywhere else: the landing page,
 * pricing, the legal pages, the changelog and the three public readers are
 * static or ISR, and the plan asks for Lighthouse ≥ 90 on them.
 *
 * So the shell gets the strict policy and the public pages get the one that
 * tolerates inline scripts. Both refuse a script from another origin, which is
 * the directive an injected `<script src>` actually runs into — `'unsafe-inline'`
 * is a weaker answer to inline injection, not to remote loading. `object-src`,
 * `base-uri`, `form-action` and `frame-ancestors` are identical in both.
 *
 * ## Directives that look wrong and are not
 *
 * - `worker-src blob:` — MapLibre compiles its own worker and instantiates it
 *   from a blob URL. Without this every 2D map fails to initialise, and the
 *   console message names the worker rather than the policy.
 * - `style-src 'unsafe-inline'` in **both** — unavoidable while any component
 *   sets a `style` attribute, which MapLibre, three.js and every progress bar
 *   here do. A nonce does not cover attributes; only `style-src-attr` would, and
 *   dropping it would mean rewriting third-party libraries.
 * - `img-src` carries the Supabase host because photographs are served from
 *   Storage over signed URLs, and `data:`/`blob:` because an upload is previewed
 *   before it leaves the browser.
 * - `upgrade-insecure-requests` is production-only. The local stack is
 *   `http://127.0.0.1:54321`, and upgrading that to https points at nothing.
 */

/** Origin of a URL-shaped env var, or nothing when it is unset or malformed. */
function origin(value: string | undefined): string[] {
  if (!value) return []
  try {
    return [new URL(value).origin]
  } catch {
    // A malformed value is the app's problem to report elsewhere, not a reason
    // to ship a policy with a hole in it.
    return []
  }
}

/** Hosts the app legitimately talks to, derived from env rather than hardcoded. */
function connectSources(): string[] {
  const env = publicEnv()
  const sources = new Set<string>(["'self'"])

  for (const o of origin(env.NEXT_PUBLIC_SUPABASE_URL)) {
    sources.add(o)
    // Realtime is not subscribed to today, but the client opens its socket
    // lazily and a future subscription should not have to come back here.
    sources.add(o.replace(/^http/, 'ws'))
  }

  // Vector tiles, only when a key is configured — the maps draw their own
  // basemap without one, so this is additive rather than required.
  if (env.NEXT_PUBLIC_MAPTILER_KEY) sources.add('https://api.maptiler.com')

  // Error and product analytics, each only while its endpoint is configured. An
  // unset key means the SDK is a no-op, and an origin nothing talks to should
  // not be allowed.
  for (const o of origin(env.NEXT_PUBLIC_SENTRY_DSN)) sources.add(o)
  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    for (const o of origin(env.NEXT_PUBLIC_POSTHOG_HOST)) sources.add(o)
  }

  return [...sources]
}

export interface CspOptions {
  /**
   * Per-request nonce. Present for the authenticated shell, absent for the
   * public pages — see the note above.
   */
  nonce?: string
  /** `'unsafe-eval'` is required by React's dev overlay and by nothing in production. */
  dev?: boolean
}

/** Builds the policy string. Pure apart from env, so it can be asserted on. */
export function buildCsp({ nonce, dev = false }: CspOptions = {}): string {
  const scriptSrc = nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : ["'self'", "'unsafe-inline'"]
  if (dev) scriptSrc.push("'unsafe-eval'")

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSrc],
    // Next serves the compiled stylesheet from this origin; the inline half is
    // style attributes, which no nonce reaches.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', ...origin(publicEnv().NEXT_PUBLIC_SUPABASE_URL)]],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connectSources()],
    // MapLibre's worker, and three.js's when it uses one.
    ['worker-src', ["'self'", 'blob:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    // Nothing here embeds anything, and nothing may embed this.
    ['frame-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['manifest-src', ["'self'"]],
  ]

  const policy = directives.map(([name, values]) => `${name} ${values.join(' ')}`)
  if (!dev) policy.push('upgrade-insecure-requests')

  return policy.join('; ')
}

/** Fresh, unpredictable, and per request — a reused nonce is no nonce. */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
