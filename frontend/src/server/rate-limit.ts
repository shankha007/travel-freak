import 'server-only'

import { headers } from 'next/headers'
import {
  MemoryRateLimiter,
  POLICIES,
  rateLimitKey,
  type PolicyName,
  type RateLimitPolicy,
  type RateLimitResult,
} from '@/shared/rate-limit'

/**
 * Rate limiting, as the plan's security section asks for on auth, on upload-URL
 * issuance and on the endpoints a stranger can reach.
 *
 * ## Two backends, one interface
 *
 * Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are
 * set, and this process's memory otherwise. The interface is the same either
 * way, so no caller knows which one it got — which is the point: a local
 * checkout needs no Redis, and production gets a counter that survives a cold
 * start and is shared across instances.
 *
 * Upstash is reached over its REST API with `fetch` rather than through its SDK.
 * One `fetch` against a documented endpoint is less to keep current than a
 * dependency, and it works unchanged on the edge runtime the proxy uses.
 *
 * ## Failing open, deliberately
 *
 * If Redis is unreachable the request is **allowed**. A limiter that fails
 * closed turns a Redis blip into a total outage of sign-in and uploads, which is
 * a worse day than a few minutes of unlimited attempts — and the memory limiter
 * is not consulted as a fallback, because a per-instance count taking over
 * mid-incident would refuse legitimate callers unpredictably. The failure is
 * reported so it is not silent.
 */

/** One limiter per process, so the window survives between requests. */
const memory = new MemoryRateLimiter()

interface UpstashConfig {
  url: string
  token: string
}

function upstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/^['"]|['"]$/g, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim().replace(/^['"]|['"]$/g, '')
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

/**
 * A fixed window in Redis: increment, set the expiry only if it is not already
 * set, then read what is left of it.
 *
 * Fixed rather than sliding, unlike the memory limiter, and the reason is cost:
 * a sliding window needs a sorted set and three round trips, and the boundary
 * effect it avoids — up to twice the limit across the seam — is not worth that
 * on an endpoint whose job is to stop a script, not to be exact. `EXPIRE ... NX`
 * is what stops each request pushing the window out and the key living forever.
 */
async function checkUpstash(
  config: UpstashConfig,
  key: string,
  policy: RateLimitPolicy
): Promise<RateLimitResult | null> {
  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(policy.windowSeconds), 'NX'],
        ['TTL', key],
      ]),
      // Never cached, and never allowed to hang: a limiter that blocks is an
      // outage with extra steps.
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    })

    if (!response.ok) return null

    const results = (await response.json()) as Array<{ result?: unknown; error?: string }>
    const count = Number(results[0]?.result)
    if (!Number.isFinite(count)) return null

    const ttl = Number(results[2]?.result)
    // -1 means the key exists with no expiry, which EXPIRE NX should have
    // prevented; treat it as a full window rather than as forever.
    const retryAfterSeconds = ttl > 0 ? ttl : policy.windowSeconds

    return count > policy.limit
      ? { allowed: false, remaining: 0, retryAfterSeconds }
      : { allowed: true, remaining: policy.limit - count, retryAfterSeconds: 0 }
  } catch {
    return null
  }
}

/**
 * Applies a policy to one identifier.
 *
 * The identifier is whatever the policy counts against — an IP, an email
 * address, a user id. Callers that want two of them call this twice and refuse
 * on the first refusal; `shared/rate-limit.ts` explains why sign-in does exactly
 * that.
 */
export async function checkRateLimit(
  policyName: PolicyName,
  identifier: string
): Promise<RateLimitResult> {
  const policy = POLICIES[policyName]
  const key = rateLimitKey(policyName, identifier)

  const config = upstashConfig()
  if (config) {
    const result = await checkUpstash(config, key, policy)
    if (result) return result
    // Failing open — see the note at the top of this file.
    console.error(`[rate-limit] Upstash unreachable; allowing "${policyName}" through.`)
    return { allowed: true, remaining: policy.limit, retryAfterSeconds: 0 }
  }

  return memory.check(key, policy)
}

/**
 * Un-counts the attempt just made, for a limit that only means to count failures.
 *
 * `DECR` rather than dropping the key, so a caller mixing hits and misses is
 * still counted for the misses. It cannot take the counter below zero in
 * practice, because it is only ever called after the `INCR` that this undoes;
 * and if a lost race ever did, the next window's `EXPIRE` clears it.
 */
export async function forgiveRateLimit(policyName: PolicyName, identifier: string): Promise<void> {
  const key = rateLimitKey(policyName, identifier)
  const config = upstashConfig()

  if (!config) {
    memory.forgive(key)
    return
  }

  try {
    await fetch(`${config.url}/DECR/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    })
  } catch {
    // A forgiveness that does not land costs one count against a legitimate
    // caller, which is not worth failing a page render over.
  }
}

/**
 * The caller's IP, as a limiter key.
 *
 * `x-forwarded-for` is a client-supplied header everywhere except behind a proxy
 * that overwrites it, which Vercel does — it appends the real peer last on its
 * own `x-real-ip` and rewrites the chain, so the **first** entry is the one to
 * use there. Locally there is no proxy and no header, and every request shares
 * the one bucket named below, which is correct: a developer hitting their own
 * limit is the limiter working.
 */
export async function requestIp(): Promise<string> {
  const list = await headers()
  const forwarded = list.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return list.get('x-real-ip')?.trim() || 'unknown-ip'
}

/** Convenience for the common case: one policy, keyed on the caller's IP. */
export async function checkRateLimitByIp(policyName: PolicyName): Promise<RateLimitResult> {
  return checkRateLimit(policyName, await requestIp())
}

/**
 * The sentence a refused caller is shown.
 *
 * Says how long to wait, in units a person reads, and does not say what the
 * limit is — a number is a thing to tune a script against.
 */
export function rateLimitMessage(result: RateLimitResult): string {
  const seconds = result.retryAfterSeconds
  if (seconds <= 90) {
    return `Too many attempts. Try again in ${Math.max(1, Math.round(seconds))} seconds.`
  }
  const minutes = Math.ceil(seconds / 60)
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}
