/**
 * The arithmetic behind rate limiting, with no request and no network in it.
 *
 * Split from `server/rate-limit.ts` so the part that decides can be tested
 * without a Redis, and so the part that talks to one has nothing to decide.
 *
 * ## The policies, in one place
 *
 * The plan asks for limits on auth, on upload-URL issuance and on public
 * endpoints. Each entry below is a pair — how many, and over how long — chosen
 * so that a person who mistypes a password four times is never affected and a
 * script working through a wordlist is stopped within seconds.
 *
 * Note what a limit here is *for*. Sign-in is limited to slow credential
 * stuffing, not to protect the password check. The reset and resend forms are
 * limited because they send mail to an address the requester does not have to
 * own — the auth server has its own `email_sent` limit, and this one is in front
 * of it so a flood never reaches it. Upload signing is limited because it is the
 * one authenticated endpoint that costs money downstream.
 */

export interface RateLimitPolicy {
  /** Requests allowed inside the window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export const POLICIES = {
  /**
   * Ten attempts per ten minutes, per address and per IP.
   *
   * Both, because either alone is easy to walk around: per-IP only lets a
   * botnet try one password each against one account, and per-address only lets
   * one machine work through every account it knows of.
   */
  signIn: { limit: 10, windowSeconds: 600 },
  /** Accounts are cheap to make and expensive to moderate. */
  signUp: { limit: 5, windowSeconds: 3600 },
  /**
   * The two forms that send an email to an address the sender need not own.
   * Deliberately the same bucket for both — they are the same abuse.
   */
  emailRecovery: { limit: 5, windowSeconds: 3600 },
  /** Enough for a large drag-and-drop batch, per signed-in account. */
  uploadSign: { limit: 120, windowSeconds: 600 },
  /**
   * Share tokens are the one guessable secret in the product. A token is long
   * enough that this is not what makes guessing infeasible — it is what stops
   * anyone trying at a rate worth measuring.
   *
   * Counted per IP and **forgiven when the token resolves**, which is what makes
   * an IP key safe here: a shared link opened by forty people behind one office
   * NAT is forty successes and costs nothing, while forty misses from one address
   * is somebody working through the space. Twenty is generous for typos and
   * ungenerous for a script.
   */
  shareToken: { limit: 20, windowSeconds: 600 },
  /** In front of the per-address limit `submit_contact_message()` already holds. */
  contact: { limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitPolicy>

export type PolicyName = keyof typeof POLICIES

export interface RateLimitResult {
  allowed: boolean
  /** Requests left in this window. Zero on the request that was refused. */
  remaining: number
  /** Seconds until the caller may retry. Zero when allowed. */
  retryAfterSeconds: number
}

/**
 * A sliding-window counter held in this process's memory.
 *
 * **What this is and is not.** On one long-lived server it is a real limit. On
 * serverless it is per instance and is lost on a cold start, so a determined
 * caller spread across enough instances gets more than the policy says. That is
 * why `server/rate-limit.ts` prefers Upstash when it is configured — this is the
 * floor, not the ceiling, and a floor is worth having: it is what a local
 * checkout and a preview deployment run with, and it turns an unbounded loop
 * into a bounded one everywhere.
 *
 * Sliding rather than fixed-window because a fixed window lets twice the limit
 * through across a boundary — five at 09:59 and five at 10:00 is ten in two
 * seconds under a policy of five an hour.
 */
export class MemoryRateLimiter {
  /** Hit timestamps per key, oldest first. */
  private readonly hits = new Map<string, number[]>()

  /**
   * Cap on distinct keys held at once. Without it an attacker varying the key —
   * one address per request — turns a limiter into a memory leak. When the cap
   * is reached the least recently touched keys go; a key that is evicted has its
   * count forgiven, which is the right direction to fail in for a limiter that
   * is already documented as a floor.
   */
  constructor(private readonly maxKeys = 10_000) {}

  check(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitResult {
    const windowMs = policy.windowSeconds * 1000
    const cutoff = now - windowMs

    const previous = this.hits.get(key) ?? []
    const live = previous.filter((t) => t > cutoff)

    if (live.length >= policy.limit) {
      // Deleted and re-set, not just set: a Map keeps its original insertion
      // order when an existing key is overwritten, so without the delete the key
      // being hammered stays the oldest and is the first one eviction forgives —
      // precisely backwards.
      this.touch(key, live)
      const oldest = live[0]
      return {
        allowed: false,
        remaining: 0,
        // Rounded up, so a caller told to wait one second never comes back to
        // the same answer because 400ms of the window remained.
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      }
    }

    live.push(now)
    this.touch(key, live)
    this.evictIfNeeded()

    return { allowed: true, remaining: policy.limit - live.length, retryAfterSeconds: 0 }
  }

  /** Writes a key's hits and moves it to the young end of the eviction order. */
  private touch(key: string, hits: number[]): void {
    this.hits.delete(key)
    this.hits.set(key, hits)
  }

  /**
   * Un-counts the most recent hit on a key.
   *
   * For the limits that only mean to count *failures* — a share token that
   * resolved was a legitimate visit and should not bring the next visitor
   * closer to a refusal. Removing one hit rather than the whole key is what
   * keeps a mixture of hits and misses from one address honest.
   */
  forgive(key: string): void {
    const live = this.hits.get(key)
    if (!live?.length) return
    live.pop()
    if (live.length === 0) this.hits.delete(key)
  }

  /** Drops a key entirely. */
  reset(key: string): void {
    this.hits.delete(key)
  }

  private evictIfNeeded(): void {
    if (this.hits.size <= this.maxKeys) return
    // Map iterates in insertion order, and `touch` re-inserts, so the front of
    // the iteration is the least recently seen key.
    const excess = this.hits.size - this.maxKeys
    let dropped = 0
    for (const key of this.hits.keys()) {
      this.hits.delete(key)
      if (++dropped >= excess) break
    }
  }
}

/**
 * The key a policy counts against.
 *
 * Namespaced by policy so two limits never share a counter, and lower-cased on
 * the identifier because `Ada@example.com` and `ada@example.com` are one address
 * to the auth server and would otherwise be two buckets.
 */
export function rateLimitKey(policy: PolicyName, identifier: string): string {
  return `rl:${policy}:${identifier.toLowerCase()}`
}
