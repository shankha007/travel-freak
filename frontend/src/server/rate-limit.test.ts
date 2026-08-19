import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Upstash branch — the one that runs in production and the one nobody sees
 * fail.
 *
 * Everything in `shared/rate-limit.ts` is arithmetic and is tested there. This is
 * the other half: a pipeline whose shape has to match what Upstash answers, and a
 * set of failure modes whose whole point is to be invisible. A limiter that has
 * quietly been failing open for a month looks exactly like a limiter that is
 * working, so the assertions below are mostly about what happens when the network
 * does not cooperate.
 *
 * `fetch` is stubbed rather than pointed at a real Redis: the contract being
 * checked is how this file reads a reply, and a test that needs credentials is a
 * test that does not run.
 *
 * The module is re-imported per case because it reads env at call time but holds
 * one limiter per process — a memory count left over from one case would decide
 * the next.
 */

const OK = { status: 200, statusText: 'OK' }

/** One Upstash pipeline reply: INCR, EXPIRE, TTL. */
function pipelineReply(count: number, ttl: number) {
  return new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: ttl }]), OK)
}

async function loadModule() {
  vi.resetModules()
  return import('@/server/rate-limit')
}

function configureUpstash() {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
}

beforeEach(() => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('with Upstash configured', () => {
  it('increments, sets the expiry only if absent, and reads what is left', async () => {
    configureUpstash()
    const fetchMock = vi.fn(async () => pipelineReply(1, 600))
    vi.stubGlobal('fetch', fetchMock)

    const { checkRateLimit } = await loadModule()
    await checkRateLimit('signIn', '1.2.3.4')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.upstash.io/pipeline')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')

    const body = JSON.parse(init.body as string)
    expect(body[0][0]).toBe('INCR')
    // `NX` is what stops each request pushing the window out and the key living
    // forever — without it a caller who never stops is never let back in.
    expect(body[1]).toEqual(['EXPIRE', body[0][1], '600', 'NX'])
    expect(body[2]).toEqual(['TTL', body[0][1]])
  })

  it('namespaces the key by policy and identifier', async () => {
    configureUpstash()
    const fetchMock = vi.fn(async () => pipelineReply(1, 600))
    vi.stubGlobal('fetch', fetchMock)

    const { checkRateLimit } = await loadModule()
    await checkRateLimit('signIn', 'Ada@Example.com')

    const key = JSON.parse(
      (fetchMock.mock.calls[0] as never as [string, RequestInit])[1].body as string
    )[0][1]
    expect(key).toBe('rl:signIn:ada@example.com')
  })

  it('allows while the count is within the limit', async () => {
    configureUpstash()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => pipelineReply(10, 600))
    )

    const { checkRateLimit } = await loadModule()
    // signIn allows 10; the tenth request increments the counter to exactly 10.
    const result = await checkRateLimit('signIn', 'ip')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('refuses the one after that, and says how long to wait', async () => {
    configureUpstash()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => pipelineReply(11, 412))
    )

    const { checkRateLimit } = await loadModule()
    const result = await checkRateLimit('signIn', 'ip')
    expect(result.allowed).toBe(false)
    // Taken from the key's real TTL rather than from the policy, so a caller who
    // arrives halfway through a window is told the truth about the remainder.
    expect(result.retryAfterSeconds).toBe(412)
  })

  it('falls back to a full window when the key has no expiry', async () => {
    configureUpstash()
    // -1 is "exists, never expires", which EXPIRE NX should have prevented.
    // Treating it as forever would lock somebody out permanently.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => pipelineReply(11, -1))
    )

    const { checkRateLimit } = await loadModule()
    expect((await checkRateLimit('signIn', 'ip')).retryAfterSeconds).toBe(600)
  })

  describe('failing open', () => {
    it('allows the request when Upstash answers an error status', async () => {
      configureUpstash()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('nope', { status: 500 }))
      )
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { checkRateLimit } = await loadModule()
      const result = await checkRateLimit('signIn', 'ip')

      // A limiter that failed closed would turn a Redis blip into a total outage
      // of sign-in and uploads, which is a worse day than a few unlimited minutes.
      expect(result.allowed).toBe(true)
      // Reported, though: an analytics-shaped silence is how this stays broken.
      expect(error).toHaveBeenCalled()
    })

    it('allows the request when the connection throws', async () => {
      configureUpstash()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('ECONNREFUSED')
        })
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { checkRateLimit } = await loadModule()
      expect((await checkRateLimit('signIn', 'ip')).allowed).toBe(true)
    })

    it('allows the request when the reply is not the shape expected', async () => {
      configureUpstash()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ error: 'WRONGTYPE' }), OK))
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { checkRateLimit } = await loadModule()
      expect((await checkRateLimit('signIn', 'ip')).allowed).toBe(true)
    })

    it('does not quietly hand over to the memory counter instead', async () => {
      configureUpstash()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('nope', { status: 500 }))
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { checkRateLimit } = await loadModule()
      // Twenty attempts against a policy of ten. A per-instance count taking over
      // mid-incident would start refusing legitimate callers unpredictably, which
      // is the opposite of what failing open is for.
      for (let i = 0; i < 20; i++) {
        expect((await checkRateLimit('signIn', 'ip')).allowed).toBe(true)
      }
    })
  })

  it('gives one attempt back with DECR', async () => {
    configureUpstash()
    const fetchMock = vi.fn(async () => new Response('1', OK))
    vi.stubGlobal('fetch', fetchMock)

    const { forgiveRateLimit } = await loadModule()
    await forgiveRateLimit('shareToken', '1.2.3.4')

    // DECR rather than dropping the key, so a caller mixing hits and misses is
    // still counted for the misses — the share-token case in shared/rate-limit.ts.
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toContain('/DECR/')
    expect(url).toContain(encodeURIComponent('rl:shareToken:1.2.3.4'))
  })

  it('never lets a failed forgiveness break the page it was called from', async () => {
    configureUpstash()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
    )

    const { forgiveRateLimit } = await loadModule()
    // Costs one count against a legitimate visitor, which is not worth failing a
    // trip page over.
    await expect(forgiveRateLimit('shareToken', 'ip')).resolves.toBeUndefined()
  })
})

describe('with Upstash unconfigured', () => {
  it('counts in memory and never reaches the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { checkRateLimit } = await loadModule()
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit('signIn', 'ip')).allowed).toBe(true)
    }
    expect((await checkRateLimit('signIn', 'ip')).allowed).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a quoted empty value as unset', async () => {
    // `.env.local.example` ships these lines as NAME="", and dotenv hands that
    // through as two literal quote characters — the same trap the MapTiler key
    // fell into. A URL of `""` would make every check fail open silently.
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '""')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '""')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { checkRateLimit } = await loadModule()
    await checkRateLimit('signIn', 'ip')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('needs both halves before it will use Upstash', async () => {
    // A URL with no token would authenticate as nobody and 401 on every call,
    // which fails open — a half-configured limiter must read as no limiter.
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { checkRateLimit } = await loadModule()
    await checkRateLimit('signIn', 'ip')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('strips a trailing slash from the configured URL', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io/')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    const fetchMock = vi.fn(async () => pipelineReply(1, 600))
    vi.stubGlobal('fetch', fetchMock)

    const { checkRateLimit } = await loadModule()
    await checkRateLimit('signIn', 'ip')

    // `//pipeline` is a 404 from Upstash, and a 404 fails open — so a trailing
    // slash pasted from the console would silently disable every limit.
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://example.upstash.io/pipeline'
    )
  })
})

describe('rateLimitMessage', () => {
  it('counts in seconds for a short wait and minutes for a long one', async () => {
    const { rateLimitMessage } = await loadModule()

    expect(rateLimitMessage({ allowed: false, remaining: 0, retryAfterSeconds: 45 })).toBe(
      'Too many attempts. Try again in 45 seconds.'
    )
    expect(rateLimitMessage({ allowed: false, remaining: 0, retryAfterSeconds: 600 })).toBe(
      'Too many attempts. Try again in 10 minutes.'
    )
  })

  it('says minute in the singular', async () => {
    const { rateLimitMessage } = await loadModule()
    expect(rateLimitMessage({ allowed: false, remaining: 0, retryAfterSeconds: 91 })).toContain(
      '2 minutes'
    )
    expect(rateLimitMessage({ allowed: false, remaining: 0, retryAfterSeconds: 60 })).toContain(
      '60 seconds'
    )
  })

  it('never says how many attempts the limit is', async () => {
    // A limit stated in words is a limit somebody can tune a script against. The
    // message says how long to wait and nothing else, so the only number in it is
    // the wait itself.
    const { rateLimitMessage } = await loadModule()
    const { POLICIES } = await import('@/shared/rate-limit')
    const message = rateLimitMessage({ allowed: false, remaining: 0, retryAfterSeconds: 300 })

    expect(message).toBe('Too many attempts. Try again in 5 minutes.')
    // Exactly one number, and it is the five in "5 minutes".
    expect(message.match(/\d+/g)).toEqual(['5'])
    expect(message).not.toMatch(new RegExp(`\\b${POLICIES.signIn.limit}\\b`))
  })
})
