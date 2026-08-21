import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The send layer, and mostly its failure modes.
 *
 * The success path is one POST and is barely worth asserting beyond the shape of
 * the payload. What matters is that **nothing here can break the thing that
 * caused it**: an invitation that was written to the database is an invitation
 * whether or not Resend answered, and a contact message that was stored is
 * stored. Every case below that ends in "returns rather than throws" is a case
 * where the alternative is a mail outage becoming a product outage.
 *
 * The module is re-imported per case because it reads env at call time.
 */

const EMAIL = {
  to: 'friend@example.com',
  subject: 'Ada invited you',
  html: '<p>hello</p>',
  text: 'hello',
}

async function load() {
  vi.resetModules()
  return import('@/server/mail/send')
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('RESEND_FROM', '')
  vi.stubEnv('NODE_ENV', 'production')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('with Resend configured', () => {
  beforeEach(() => vi.stubEnv('RESEND_API_KEY', 're_test_key'))

  it('posts the message to Resend with both parts', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendEmail } = await load()
    expect(await sendEmail(EMAIL)).toEqual({ sent: true })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key')

    const body = JSON.parse(init.body as string)
    expect(body.to).toEqual(['friend@example.com'])
    expect(body.subject).toBe('Ada invited you')
    // Both parts, always: a message with no text alternative scores as spam.
    expect(body.html).toBe('<p>hello</p>')
    expect(body.text).toBe('hello')
  })

  it('sends from our own domain, never from the person it is about', async () => {
    // `From` is the only address SPF and DKIM cover. Putting a user's address
    // there is how a domain gets classified as a spammer.
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendEmail } = await load()
    await sendEmail({ ...EMAIL, replyTo: 'ada@example.com' })

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as never as [string, RequestInit])[1].body as string
    )
    expect(body.from).toContain('@travelfreak.app')
    expect(body.from).not.toContain('ada@example.com')
    // The sender's address goes here instead, which needs no authentication and
    // is what makes "reply" answer the person.
    expect(body.reply_to).toEqual(['ada@example.com'])
  })

  it('omits reply_to entirely when there is nobody to reply to', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendEmail } = await load()
    await sendEmail(EMAIL)

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as never as [string, RequestInit])[1].body as string
    )
    expect('reply_to' in body).toBe(false)
  })

  it('honours a configured sender', async () => {
    // The verified domain is a deployment fact, not a code one.
    vi.stubEnv('RESEND_FROM', 'Trips <hello@example.org>')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { sendEmail } = await load()
    await sendEmail(EMAIL)

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as never as [string, RequestInit])[1].body as string
    )
    expect(body.from).toBe('Trips <hello@example.org>')
  })

  it('treats a quoted empty key as unset', async () => {
    // `.env.local.example` ships its lines as NAME="", and dotenv hands that
    // through as two literal quote characters — the trap the MapTiler key fell
    // into. Here it would mean authenticating with `""` and 401ing every send.
    vi.stubEnv('RESEND_API_KEY', '""')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { sendEmail } = await load()
    expect(await sendEmail(EMAIL)).toEqual({ sent: false, reason: 'not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('when it goes wrong', () => {
    it('reports a refusal rather than throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{"message":"domain not verified"}', { status: 403 }))
      )
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { sendEmail } = await load()
      const result = await sendEmail(EMAIL)

      expect(result.sent).toBe(false)
      expect(result.reason).toBe('resend 403')
      // The body names the problem — an unverified domain, a malformed sender —
      // and a bare status would send somebody hunting for it.
      expect(error.mock.calls[0]?.[0]).toContain('domain not verified')
    })

    it('reports a connection failure rather than throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('ECONNREFUSED')
        })
      )
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { sendEmail } = await load()
      await expect(sendEmail(EMAIL)).resolves.toEqual({ sent: false, reason: 'request failed' })
    })
  })
})

describe('with Resend unconfigured', () => {
  it('sends nothing, says so, and does not throw', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { sendEmail } = await load()
    expect(await sendEmail(EMAIL)).toEqual({ sent: false, reason: 'not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
    // Warned rather than silent: mail that has been quietly off for a month is
    // worse than mail that is visibly off.
    expect(warn).toHaveBeenCalled()
  })

  it('logs the whole message in development, so the copy can be read', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubGlobal('fetch', vi.fn())
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    const { sendEmail } = await load()
    await sendEmail(EMAIL)

    expect(info.mock.calls[0]?.[0]).toContain('hello')
  })
})
