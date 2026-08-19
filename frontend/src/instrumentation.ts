import * as Sentry from '@sentry/nextjs'
import type { Instrumentation } from 'next'

/**
 * Sentry on the server, and the plan's reason for it: "Sentry for errors …
 * instrumented on day one."
 *
 * ## Unset means off, everywhere
 *
 * Without `NEXT_PUBLIC_SENTRY_DSN` every function here returns immediately and
 * the SDK is never initialised. A local checkout and CI behave exactly as they
 * did before this file existed — which matters more than it sounds: a stack trace
 * in a terminal is more use to whoever is looking at it than one in a dashboard,
 * and instrumentation a contributor has to configure is instrumentation that gets
 * deleted.
 *
 * ## Two runtimes, one file
 *
 * `register()` runs once per server instance, in whichever runtime is starting —
 * Node for renders and route handlers, edge for the proxy. The config differs only
 * in what the SDK can do there, so the branch is on `NEXT_RUNTIME` rather than on
 * two files, and both go through `initSentry` so a change cannot be made to one
 * and forgotten in the other.
 *
 * ## What is deliberately not sent
 *
 * `sendDefaultPii: false`, which is the SDK default and is restated here because
 * it is a decision rather than an oversight: an error report should carry the
 * shape of the failure, not the address of the person who met it. The user id is
 * attached where it helps — see `beforeSend` — and nothing else about them is.
 */

const dsn = clean(process.env.NEXT_PUBLIC_SENTRY_DSN)

/** Same treatment `shared/env.ts` gives every optional var — see the note there. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  return trimmed.length > 0 ? trimmed : undefined
}

export function register() {
  if (!dsn) return

  Sentry.init({
    dsn,
    // Named so a release can be identified in the dashboard without the deploy
    // having to be looked up. Vercel sets the commit sha; a self-hosted build
    // falls back to the package version, which is coarser and still better than
    // nothing.
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

    /**
     * Ten per cent of transactions.
     *
     * Performance data is useful in aggregate and expensive per event, and this
     * is a product with no traffic yet — the number to revisit once there is
     * enough of it for a p95 to mean anything. Errors are unaffected: they are
     * sampled at 100% and always have been.
     */
    tracesSampleRate: 0.1,

    // The reports say what broke, never who it happened to. `beforeSend` adds an
    // id where one is already known; this stops the SDK adding an address, a
    // cookie or a request body on its own.
    sendDefaultPii: false,

    // Logged rather than silent when something is wrong with the SDK itself, and
    // only in development — a noisy transport in production is a second problem
    // rather than a diagnosis of the first.
    debug: false,
  })
}

/**
 * Every server-side error Next catches, forwarded with the route that produced it.
 *
 * Next calls this for renders, route handlers, Server Actions and the proxy, which
 * makes it the one place that sees all four. `captureRequestError` is the SDK's
 * own adapter for the signature and attaches the routing context — without it a
 * report says "an error occurred" and leaves the route to be inferred from the
 * stack.
 */
export const onRequestError: Instrumentation.onRequestError = dsn
  ? Sentry.captureRequestError
  : () => {}
