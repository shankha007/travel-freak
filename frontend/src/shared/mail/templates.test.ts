import { describe, expect, it } from 'vitest'
import { contactNotificationEmail, escapeHtml, invitationEmail } from '@/shared/mail/templates'

/**
 * An email cannot be corrected once it is sent, which is the whole reason these
 * are pure functions with a test beside them rather than strings built at the
 * call site.
 *
 * Two things are worth asserting. **The escaping**, because a trip title and a
 * contact message are written by people and one of them is written by a stranger
 * — an apostrophe that breaks the markup is the small version, and a `<script>`
 * that survives into a webmail client is the large one. And **the promises the
 * copy makes**, because each sentence here was chosen to head off a specific
 * confusion and a rewrite that drops one costs a support thread.
 */

describe('escapeHtml', () => {
  it('escapes all five predefined entities', () => {
    expect(escapeHtml(`Tom & Jerry's <"trip">`)).toBe(
      'Tom &amp; Jerry&#39;s &lt;&quot;trip&quot;&gt;'
    )
  })

  it('escapes the ampersand before anything that introduces one', () => {
    // The classic double-escape bug: run `<` first and its `&lt;` becomes
    // `&amp;lt;`.
    expect(escapeHtml('<')).toBe('&lt;')
  })
})

describe('invitationEmail', () => {
  const base = {
    inviterName: 'Ada Lovelace',
    tripTitle: 'Bhutan in autumn',
    role: 'editor' as const,
    invitedEmail: 'friend@example.com',
  }

  it('names the inviter and the trip in the subject', () => {
    // Both, because an invitation from nobody to nothing reads as spam — which
    // is exactly where it will end up.
    const mail = invitationEmail(base)
    expect(mail.subject).toContain('Ada Lovelace')
    expect(mail.subject).toContain('Bhutan in autumn')
  })

  it('says what an editor may do, and what a viewer may not', () => {
    expect(invitationEmail(base).text).toContain('add places, photos, plans and lists')
    expect(invitationEmail({ ...base, role: 'viewer' }).text).toContain('without changing anything')
  })

  it('tells them which address to sign up with', () => {
    // The sentence that prevents the commonest confusion: an invitation is
    // matched by email, so registering with a different address finds nothing
    // and gives no clue why.
    const mail = invitationEmail(base)
    expect(mail.text).toContain('friend@example.com')
    expect(mail.text).toContain('matched to that address')
  })

  it('carries no token and no one-click accept', () => {
    // Acceptance is matched on the account's own verified address, so a link
    // that accepted on click would be an authorisation sitting in an inbox —
    // and forwarding the mail would hand somebody else a trip.
    const mail = invitationEmail(base)
    expect(mail.html).not.toMatch(/token|accept\?|invite_id/i)
    expect(mail.html).toContain('/trips"')
  })

  it('tells an unexpecting recipient that ignoring it is safe', () => {
    expect(invitationEmail(base).text).toContain('Nothing is shared with you until you accept')
  })

  it('escapes a trip title that is trying to be markup', () => {
    const mail = invitationEmail({ ...base, tripTitle: '<script>alert(1)</script>' })
    expect(mail.html).not.toContain('<script>alert(1)</script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('escapes the inviter name too, which is equally somebody else’s text', () => {
    const mail = invitationEmail({ ...base, inviterName: '<img src=x onerror=1>' })
    expect(mail.html).not.toContain('<img src=x')
  })

  it('ships a plain-text part that is not the HTML', () => {
    // A message with no text alternative scores as spam with most filters.
    const mail = invitationEmail(base)
    expect(mail.text.length).toBeGreaterThan(80)
    expect(mail.text).not.toContain('<div')
  })
})

describe('contactNotificationEmail', () => {
  const base = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    topic: 'Bug report',
    message: 'The globe span the wrong way.\n\nTwice.',
  }

  it('puts the topic and the sender in the subject', () => {
    expect(contactNotificationEmail(base).subject).toBe('Bug report: Ada Lovelace')
  })

  it('carries the message as written, blank lines and all', () => {
    const mail = contactNotificationEmail(base)
    // `white-space: pre-wrap` rather than `<br>` conversion, so the paragraphs
    // somebody wrote survive as paragraphs.
    expect(mail.html).toContain('white-space:pre-wrap')
    expect(mail.text).toContain('The globe span the wrong way.\n\nTwice.')
  })

  it('names where they wrote from, when the form captured it', () => {
    expect(contactNotificationEmail({ ...base, sourcePath: '/pricing' }).text).toContain('/pricing')
  })

  it('omits the source line entirely when there is none', () => {
    const mail = contactNotificationEmail(base)
    expect(mail.text).not.toContain('Sent from:')
    // And no empty placeholder left behind in the HTML.
    expect(mail.html).not.toContain('from <code></code>')
  })

  it('escapes a message that is trying to be markup', () => {
    const mail = contactNotificationEmail({ ...base, message: '<script>alert(1)</script>' })
    expect(mail.html).not.toContain('<script>alert(1)</script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('escapes the name, which lands in the subject and the body', () => {
    const mail = contactNotificationEmail({ ...base, name: 'A <b>bold</b> name' })
    expect(mail.html).not.toContain('<b>bold</b>')
  })

  it('says how to answer, and where the record lives', () => {
    const mail = contactNotificationEmail(base)
    expect(mail.html).toContain('Reply to this email')
    expect(mail.html).toContain('contact_messages')
  })
})

describe('every template', () => {
  it('is a complete document with a subject and both parts', () => {
    const mails = [
      invitationEmail({
        inviterName: 'A',
        tripTitle: 'B',
        role: 'viewer',
        invitedEmail: 'c@d.e',
      }),
      contactNotificationEmail({ name: 'A', email: 'a@b.c', topic: 'T', message: 'M' }),
    ]

    for (const mail of mails) {
      expect(mail.subject.trim()).not.toBe('')
      expect(mail.html).toContain('<!doctype html>')
      expect(mail.html).toContain('</html>')
      expect(mail.text.trim()).not.toBe('')
    }
  })

  it('loads nothing from a remote host', () => {
    // No images and no stylesheets, deliberately: a logo fetched from our origin
    // reports when the mail was opened and from where, which is tracking nobody
    // agreed to — and renders as a broken square wherever images are blocked.
    const mail = invitationEmail({
      inviterName: 'A',
      tripTitle: 'B',
      role: 'editor',
      invitedEmail: 'c@d.e',
    })
    expect(mail.html).not.toMatch(/<img|<link|url\(/)
  })
})
