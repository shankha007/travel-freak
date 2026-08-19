import { describe, expect, it } from 'vitest'
import { MemoryRateLimiter, POLICIES, rateLimitKey } from '@/shared/rate-limit'

/**
 * The limiter is arithmetic over a clock, which is exactly the kind of code that
 * looks obviously right and is off by one. `now` is passed in rather than faked
 * globally, so every case here is a statement about the window rather than about
 * timer mocks.
 */

const policy = { limit: 3, windowSeconds: 60 }

describe('MemoryRateLimiter', () => {
  it('allows up to the limit and refuses the next', () => {
    const limiter = new MemoryRateLimiter()
    const t = 1_000_000

    expect(limiter.check('k', policy, t).allowed).toBe(true)
    expect(limiter.check('k', policy, t).allowed).toBe(true)
    const third = limiter.check('k', policy, t)
    expect(third.allowed).toBe(true)
    expect(third.remaining).toBe(0)

    expect(limiter.check('k', policy, t).allowed).toBe(false)
  })

  it('counts each key separately', () => {
    const limiter = new MemoryRateLimiter()
    const t = 1_000_000
    for (let i = 0; i < 3; i++) limiter.check('a', policy, t)

    expect(limiter.check('a', policy, t).allowed).toBe(false)
    expect(limiter.check('b', policy, t).allowed).toBe(true)
  })

  it('slides: an old hit stops counting once it leaves the window', () => {
    const limiter = new MemoryRateLimiter()
    const t = 1_000_000
    for (let i = 0; i < 3; i++) limiter.check('k', policy, t)

    // One millisecond short of the window — still three inside it.
    expect(limiter.check('k', policy, t + 59_999).allowed).toBe(false)
    // Past it, so the first hit has aged out and one slot is free.
    expect(limiter.check('k', policy, t + 60_001).allowed).toBe(true)
  })

  it('does not let twice the limit through across a boundary', () => {
    // The failure a fixed window has and this one must not: three at the end of
    // one minute and three at the start of the next is six in two seconds.
    const limiter = new MemoryRateLimiter()
    const t = 1_000_000
    for (let i = 0; i < 3; i++) limiter.check('k', policy, t + 59_000)

    expect(limiter.check('k', policy, t + 60_500).allowed).toBe(false)
  })

  it('says how long to wait, rounded up', () => {
    const limiter = new MemoryRateLimiter()
    const t = 1_000_000
    for (let i = 0; i < 3; i++) limiter.check('k', policy, t)

    // 500ms into the window: 59.5s remain, and telling anyone to wait 59 would
    // send them back to the same refusal.
    expect(limiter.check('k', policy, t + 500).retryAfterSeconds).toBe(60)
    expect(limiter.check('k', policy, t + 59_500).retryAfterSeconds).toBe(1)
  })

  it('never reports a wait of zero on a refusal', () => {
    const limiter = new MemoryRateLimiter()
    const t = 1_000_000
    for (let i = 0; i < 3; i++) limiter.check('k', policy, t)

    // Right at the edge the arithmetic rounds to zero, and "try again in 0
    // seconds" is a refusal that reads like a bug.
    const refused = limiter.check('k', policy, t + 60_000)
    if (!refused.allowed) expect(refused.retryAfterSeconds).toBeGreaterThan(0)
  })

  describe('forgive', () => {
    it('gives back exactly one attempt', () => {
      const limiter = new MemoryRateLimiter()
      const t = 1_000_000
      for (let i = 0; i < 3; i++) limiter.check('k', policy, t)
      expect(limiter.check('k', policy, t).allowed).toBe(false)

      limiter.forgive('k')
      expect(limiter.check('k', policy, t).allowed).toBe(true)
      // And no more than one: the slot just used is spent again.
      expect(limiter.check('k', policy, t).allowed).toBe(false)
    })

    it('does not forgive what a mixture of hits and misses spent', () => {
      // The share-token case: two misses and one hit should leave two counted.
      const limiter = new MemoryRateLimiter()
      const t = 1_000_000
      limiter.check('k', policy, t) // miss
      limiter.check('k', policy, t) // miss
      limiter.check('k', policy, t) // hit, forgiven below
      limiter.forgive('k')

      expect(limiter.check('k', policy, t).allowed).toBe(true) // the third slot
      expect(limiter.check('k', policy, t).allowed).toBe(false)
    })

    it('is a no-op on a key with nothing against it', () => {
      const limiter = new MemoryRateLimiter()
      expect(() => limiter.forgive('never-seen')).not.toThrow()
    })
  })

  it('evicts rather than growing without bound', () => {
    // An attacker varying the key — one address per request — must not be able
    // to turn a limiter into a memory leak. Eviction forgives, which is the
    // right direction for a limiter documented as a floor.
    const limiter = new MemoryRateLimiter(10)
    for (let i = 0; i < 50; i++) limiter.check(`key-${i}`, policy, 1_000_000)

    // The oldest keys are gone, so their counts start again.
    expect(limiter.check('key-0', policy, 1_000_000).remaining).toBe(policy.limit - 1)
  })

  it('keeps counting a key that is being hammered', () => {
    // A refused key is re-inserted so it reads as recently touched. Without
    // that, the caller flooding one key is the first one whose count is
    // forgiven — precisely backwards.
    const limiter = new MemoryRateLimiter(5)
    const t = 1_000_000
    for (let i = 0; i < 3; i++) limiter.check('hot', policy, t)

    for (let i = 0; i < 20; i++) {
      limiter.check(`cold-${i}`, policy, t)
      expect(limiter.check('hot', policy, t).allowed).toBe(false)
    }
  })
})

describe('rateLimitKey', () => {
  it('namespaces by policy, so two limits never share a counter', () => {
    expect(rateLimitKey('signIn', '1.2.3.4')).not.toBe(rateLimitKey('signUp', '1.2.3.4'))
  })

  it('folds case, because one address is not two buckets', () => {
    expect(rateLimitKey('signIn', 'Ada@Example.com')).toBe(
      rateLimitKey('signIn', 'ada@example.com')
    )
  })
})

describe('POLICIES', () => {
  it('states a positive limit and window for every policy', () => {
    for (const [name, p] of Object.entries(POLICIES)) {
      expect(p.limit, name).toBeGreaterThan(0)
      expect(p.windowSeconds, name).toBeGreaterThan(0)
    }
  })

  it('leaves room for an honest mistake on the credential forms', () => {
    // Someone who mistypes a password four times must never meet a limiter.
    expect(POLICIES.signIn.limit).toBeGreaterThanOrEqual(5)
  })
})
