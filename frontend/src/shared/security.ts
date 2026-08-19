import { publicEnv } from '@/shared/env'

/**
 * The Content Security Policy.
 *
 * Kept out of `proxy.ts` because a policy is read far more often than it is
 * changed, and because it is worth unit-testing: a directive lost in an edit is
 * invisible until a browser quietly refuses to draw a map.
 *
 * ## One policy, and why the nonce was taken back out
 *
 * This file briefly served two: a nonce with `'strict-dynamic'` for the
 * authenticated shell, and `'unsafe-inline'` for the prerendered public pages.
 * It was reverted because it broke something visible, and every way of fixing
 * that cost more than the nonce was worth.
 *
 * The casualty was **next-themes' no-flash script** — the inline script that
 * sets the theme class on `<html>` before the first paint. It is not one of
 * Next's own scripts, so Next does not nonce it, and the strict policy blocked
 * it outright: a flash of the wrong theme on every page behind the login, which
 * is exactly what `suppressHydrationWarning` in the root layout exists to
 * prevent. Two fixes were tried and measured:
 *
 *  - **`<ThemeProvider nonce>`** needs `headers()` in the root layout, and a
 *    dynamic API there opts *every* page into dynamic rendering. Measured in the
 *    build output rather than assumed: the landing page, `/about`, `/login` and
 *    the legal pages all went from `○` to `ƒ`. That is the prerendering the
 *    split existed to protect, so the fix defeated its own purpose.
 *  - **Allowing the script by `sha256-` hash** fails for a subtler reason: its
 *    text is not stable across builds. The same script hashes three different
 *    ways — unminified from `next dev`, again from a test renderer, and again
 *    from the production bundle, where the minifier renames its parameters from
 *    `(e, i, s, u, m, a, l, h)` to `(a,b,c,d,e,f,g,h)`. A hash pinned in source
 *    cannot be checked by anything short of the production bundler, and would be
 *    right in development while flashing in production.
 *
 * So: one policy, everywhere. `'unsafe-inline'` is a real concession on inline
 * injection and is stated plainly rather than dressed up. What it does **not**
 * concede is the rest — a script from another origin is still refused, which is
 * the directive a remote injection actually runs into, and `object-src`,
 * `base-uri`, `form-action` and `frame-ancestors` are unchanged. Stored post
 * markup is sanitised on read (`shared/content/sanitize.ts`), which remains the
 * primary control against injected script here.
 *
 * ## Directives that look wrong and are not
 *
 * - `worker-src blob:` — MapLibre compiles its own worker and instantiates it
 *   from a blob URL. Without this every 2D map fails to initialise, and the
 *   console message names the worker rather than the policy.
 * - `style-src 'unsafe-inline'` — unavoidable while any component sets a `style`
 *   attribute, which MapLibre, three.js and every progress bar here do. Only
 *   `style-src-attr` could narrow it, and dropping it would mean rewriting
 *   third-party libraries.
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
  /** `'unsafe-eval'` is required by React's dev overlay and by nothing in production. */
  dev?: boolean
}

/** Builds the policy string. Pure apart from env, so it can be asserted on. */
export function buildCsp({ dev = false }: CspOptions = {}): string {
  // `'self'` and `'unsafe-inline'` together: the first is what refuses a script
  // from another origin, and the second is the concession the note at the top of
  // this file sets out in full.
  const scriptSrc = ["'self'", "'unsafe-inline'"]
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
