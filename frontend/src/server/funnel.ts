import 'server-only'

import { after } from 'next/server'
import { DEFAULT_POSTHOG_HOST, type FunnelEvent, type FunnelProperties } from '@/shared/funnel'

/**
 * Sending the funnel to PostHog.
 *
 * ## Over `fetch`, not through an SDK
 *
 * `posthog-node` exists and would work. It is also a dependency, a batching queue
 * and a shutdown handler for something that is one POST to a documented endpoint
 * — and a queue that flushes on an interval is exactly the wrong shape for
 * serverless, where the instance may be frozen before the interval arrives.
 * `fetch` inside `after()` is the same guarantee with none of the machinery, and
 * it works unchanged on the edge runtime.
 *
 * ## Never in front of the user
 *
 * Every call goes through `after()`, so the work happens once the response has
 * been sent. Analytics must not be able to slow a save down, and — more to the
 * point — must not be able to *fail* one: a `capture()` that throws inside a
 * Server Action would turn a PostHog outage into a product outage. Errors are
 * caught and logged, and nothing above ever sees them.
 *
 * ## Unset means off
 *
 * With no `NEXT_PUBLIC_POSTHOG_KEY` every function here returns immediately. A
 * local checkout and CI behave exactly as they did before this file existed,
 * which is the only way to make instrumentation something a contributor never has
 * to think about.
 *
 * ## What identifies a person
 *
 * The Supabase user id, and nothing else — no email, no name, no IP. A funnel
 * needs to know that six events came from one account; it does not need to know
 * whose. Anything more would put personal data in a third party's database for no
 * analytical gain, which the privacy page promises not to do.
 */

interface PostHogConfig {
  key: string
  host: string
}

function config(): PostHogConfig | null {
  const key = clean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
  if (!key) return null
  return {
    key,
    host: (clean(process.env.NEXT_PUBLIC_POSTHOG_HOST) ?? DEFAULT_POSTHOG_HOST).replace(/\/$/, ''),
  }
}

/** Same treatment `shared/env.ts` gives every optional var — see the note there. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Records one funnel step for one account.
 *
 * Fire-and-forget by construction: it returns void rather than a promise, so no
 * caller can accidentally make a save wait on it, and there is no error to
 * handle because there is no failure worth propagating.
 */
export function captureFunnelEvent(
  userId: string,
  event: FunnelEvent,
  properties: FunnelProperties = {}
): void {
  const posthog = config()
  if (!posthog) return

  // Captured now rather than inside the callback: `after()` runs after the
  // response, and an event timed then would report when the server got round to
  // it rather than when the thing happened.
  const timestamp = new Date().toISOString()

  after(async () => {
    try {
      await fetch(`${posthog.host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: posthog.key,
          event,
          distinct_id: userId,
          timestamp,
          properties: {
            ...properties,
            // Tells PostHog this came from a server, so it does not try to infer a
            // browser, a device or a location from headers that are ours and not
            // the visitor's.
            $lib: 'travelfreak-server',
            // Explicitly opts out of IP-based geolocation. Without it PostHog
            // records the *server's* location, which is not a fact about anyone
            // and would put a fictional map in the dashboard.
            $ip: null,
          },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      })
    } catch (error) {
      // Logged rather than swallowed: an analytics pipeline that has been silently
      // broken for a month is worse than one that is visibly off.
      console.error(`[funnel] Could not record "${event}":`, error)
    }
  })
}
