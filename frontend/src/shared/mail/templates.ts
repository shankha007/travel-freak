import { BRAND, SITE_URL } from '@/shared/brand'

/**
 * The transactional emails, as pure functions.
 *
 * Pure for the same reason `shared/content/feed.ts` is: an email is published to
 * somebody else's inbox and cannot be corrected afterwards, and the two things
 * most likely to be wrong about one — the escaping and the copy — are both
 * testable without a network. `server/mail/send.ts` is what puts these on the
 * wire and knows nothing about their contents.
 *
 * ## Written as HTML by hand, and with a text part
 *
 * No template library and no MJML. These are two emails of a dozen elements
 * each, and every mail client renders inline styles — what they do *not* reliably
 * render is a stylesheet, a class, or anything clever. The `text` part is not a
 * courtesy either: a message with no plain-text alternative is scored as spam by
 * most filters, and some people genuinely read mail as text.
 *
 * ## Everything interpolated is escaped
 *
 * A trip title, a display name and a contact message are all written by people,
 * and two of them are written by people the recipient has never met. `escapeHtml`
 * is applied at every interpolation rather than at the call site, so a template
 * cannot be added later that forgets.
 */

export interface Email {
  subject: string
  html: string
  text: string
}

/** The five predefined entities. Applied to every interpolated value below. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The shell every message shares.
 *
 * Deliberately plain: a system font stack, one accent colour, no images and no
 * remote assets. An email that loads a logo from our origin tells us when it was
 * opened and from where, which is tracking nobody asked for — and it renders as a
 * broken square in every client that blocks images by default, which is most.
 */
function layout(heading: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e;line-height:1.6;">
    <p style="margin:0 0 24px;font-size:15px;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(BRAND.name)}</p>
    <div style="background:#ffffff;border:1px solid #e6e7eb;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;font-weight:600;">${escapeHtml(heading)}</h1>
      ${body}
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
      ${escapeHtml(BRAND.name)} · <a href="${SITE_URL}" style="color:#6b7280;">${escapeHtml(BRAND.domain)}</a>
    </p>
  </div>
</body>
</html>`
}

/** A link styled as a button. Still a link, so it works where CSS does not. */
function button(href: string, label: string): string {
  return `<p style="margin:24px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1c1c1e;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(label)}</a></p>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;">${text}</p>`
}

export interface InvitationEmailInput {
  /** Who sent it, as they are named on their profile. */
  inviterName: string
  tripTitle: string
  role: 'editor' | 'viewer'
  /** The address invited, which may not have an account yet. */
  invitedEmail: string
}

/**
 * "Somebody has invited you to a trip" — screen 24.
 *
 * ## What it does and does not say
 *
 * It names the inviter, the trip and the role, and stops. It does **not** carry a
 * token or a one-click accept: an invitation is accepted on `/trips` after
 * signing in, because the acceptance is matched on the account's own verified
 * address. A link that accepted on click would be an authorisation sitting in an
 * inbox, and forwarding the mail would hand somebody else a trip.
 *
 * The line about signing up with this address is the one that stops the common
 * confusion. An invitation is matched by email, so a person who registers with a
 * different address sees nothing and has no way to work out why.
 */
export function invitationEmail({
  inviterName,
  tripTitle,
  role,
  invitedEmail,
}: InvitationEmailInput): Email {
  const what =
    role === 'editor'
      ? 'You can add places, photos, plans and lists.'
      : 'You can see the trip and everything on it, without changing anything.'

  const heading = `${inviterName} invited you to “${tripTitle}”`

  const html = layout(
    heading,
    [
      paragraph(
        `<strong>${escapeHtml(inviterName)}</strong> has invited you to their trip <strong>${escapeHtml(tripTitle)}</strong> on ${escapeHtml(BRAND.name)}, as ${role === 'editor' ? 'an editor' : 'a viewer'}. ${escapeHtml(what)}`
      ),
      paragraph(
        `The invitation is waiting on your Trips screen. Sign in with <strong>${escapeHtml(invitedEmail)}</strong> to accept it — an invitation is matched to that address, so signing up with a different one will not find it.`
      ),
      button(`${SITE_URL}/trips`, 'Open your trips'),
      `<p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Not expecting this? Ignore it. Nothing is shared with you until you accept, and we will not write again about this trip.</p>`,
    ].join('\n      ')
  )

  const text = [
    heading,
    '',
    `${inviterName} has invited you to their trip "${tripTitle}" on ${BRAND.name}, as ${role === 'editor' ? 'an editor' : 'a viewer'}. ${what}`,
    '',
    `The invitation is waiting on your Trips screen. Sign in with ${invitedEmail} to accept it — an invitation is matched to that address, so signing up with a different one will not find it.`,
    '',
    `${SITE_URL}/trips`,
    '',
    'Not expecting this? Ignore it. Nothing is shared with you until you accept, and we will not write again about this trip.',
  ].join('\n')

  return { subject: heading, html, text }
}

export interface ContactNotificationInput {
  name: string
  email: string
  topic: string
  message: string
  /** The page they wrote from, when the form captured one. */
  sourcePath?: string
}

/**
 * The message somebody sent through `/contact`, forwarded to support — screen 6.
 *
 * This exists because the page makes a promise: "we answer within about three
 * working days". Before this, the message landed in a table nobody was told
 * about, and keeping that promise depended on somebody remembering to open
 * Studio. The row is still the record; this is the notification.
 *
 * The sender's address goes in `Reply-To` rather than in `From` — see
 * `server/mail/send.ts` — so hitting reply answers the person rather than our own
 * no-reply box, which is the whole point of forwarding it.
 */
export function contactNotificationEmail({
  name,
  email,
  topic,
  message,
  sourcePath,
}: ContactNotificationInput): Email {
  const heading = `${topic}: ${name}`

  // `white-space: pre-wrap` rather than converting newlines to `<br>`: the
  // message is plain text and should be shown as written, including the blank
  // lines somebody used to separate their paragraphs.
  const html = layout(
    heading,
    [
      paragraph(
        `<strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt; wrote about <strong>${escapeHtml(topic)}</strong>${sourcePath ? ` from <code>${escapeHtml(sourcePath)}</code>` : ''}.`
      ),
      `<div style="margin:16px 0 0;padding:16px;background:#f6f7f9;border-radius:8px;font-size:15px;white-space:pre-wrap;">${escapeHtml(message)}</div>`,
      `<p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Reply to this email to answer them directly. The message is also stored in <code>contact_messages</code>; mark it handled there when it is done.</p>`,
    ].join('\n      ')
  )

  const text = [
    heading,
    '',
    `From: ${name} <${email}>`,
    `Topic: ${topic}`,
    sourcePath ? `Sent from: ${sourcePath}` : null,
    '',
    message,
    '',
    'Reply to this email to answer them directly.',
  ]
    .filter((line) => line !== null)
    .join('\n')

  return { subject: heading, html, text }
}
