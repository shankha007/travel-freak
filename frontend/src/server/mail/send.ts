import 'server-only'

import { BRAND } from '@/shared/brand'
import type { Email } from '@/shared/mail/templates'

/**
 * Sending mail, through Resend.
 *
 * ## Over `fetch`, not through the SDK
 *
 * The same call the rest of this codebase makes for PostHog and Upstash, and for
 * the same reasons: `resend` is a dependency wrapping one POST to a documented
 * endpoint, and a plain `fetch` works unchanged on the edge runtime. If batching
 * or attachments are ever wanted, that is the moment to reconsider — not before.
 *
 * ## Unset means off
 *
 * With no `RESEND_API_KEY` nothing is sent and the attempt is logged. A local
 * checkout and CI behave exactly as they did before this file existed, which is
 * what keeps mail from becoming something a contributor has to configure to work
 * on an unrelated screen. In development the message is logged in full, so the
 * copy can be read without an inbox.
 *
 * ## Never in front of the user, and never fatal
 *
 * Every caller sends inside `after()`, so the work happens once the response has
 * gone. Nothing here throws: an invitation that was written to the database is an
 * invitation whether or not the mail provider was reachable, and a contact
 * message that was stored is stored. A failure is reported and returned, never
 * raised — the alternative is a Resend outage turning into a product outage.
 *
 * ## What `From` and `Reply-To` mean here
 *
 * `From` is always our own verified sender, because it is the only address the
 * domain's SPF and DKIM cover — putting a user's address there is what gets a
 * domain classified as a spammer. When a reply should reach a person rather than
 * a no-reply box, that address goes in `Reply-To`, which is exactly what it is
 * for and needs no authentication.
 */

interface ResendConfig {
  apiKey: string
  from: string
}

/** Same treatment `shared/env.ts` gives every optional var — see the note there. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  return trimmed.length > 0 ? trimmed : undefined
}

function config(): ResendConfig | null {
  const apiKey = clean(process.env.RESEND_API_KEY)
  if (!apiKey) return null

  return {
    apiKey,
    // Overridable because the verified domain is a deployment fact, not a code
    // one — and a sender the domain cannot authenticate is a sender that lands
    // in spam.
    from: clean(process.env.RESEND_FROM) ?? `${BRAND.name} <noreply@${BRAND.domain}>`,
  }
}

export interface SendEmailInput extends Email {
  /** One recipient. Everything sent here is addressed to a person, not a list. */
  to: string
  /**
   * Where a reply should go, when that is not us. Optional, and used by the
   * contact forwarder so support can answer the sender directly.
   */
  replyTo?: string
}

export interface SendResult {
  sent: boolean
  /** Why not, when `sent` is false. Never thrown — see the note above. */
  reason?: string
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailInput): Promise<SendResult> {
  const resend = config()

  if (!resend) {
    // Logged rather than silent, and in development the whole message: an email
    // nobody can read is copy nobody can check.
    if (process.env.NODE_ENV === 'development') {
      console.info(`[mail] RESEND_API_KEY unset. Would send to ${to}:\n${subject}\n\n${text}\n`)
    } else {
      console.warn(`[mail] RESEND_API_KEY unset; "${subject}" was not sent to ${to}.`)
    }
    return { sent: false, reason: 'not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resend.from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
      }),
      cache: 'no-store',
      // Bounded, like every other outbound call here. `after()` is not a licence
      // to hold a serverless instance open indefinitely.
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      // Resend answers a JSON body on failure; it names the problem — an
      // unverified domain, a malformed sender — and is worth having in the log
      // rather than a bare status.
      const detail = await response.text().catch(() => '')
      console.error(
        `[mail] Resend refused "${subject}" (${response.status}): ${detail.slice(0, 300)}`
      )
      return { sent: false, reason: `resend ${response.status}` }
    }

    return { sent: true }
  } catch (error) {
    console.error(`[mail] Could not send "${subject}":`, error)
    return { sent: false, reason: 'request failed' }
  }
}
