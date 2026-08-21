'use server'

import { after } from 'next/server'
import { createClient } from '@/server/supabase/server'
import { checkRateLimitByIp, rateLimitMessage } from '@/server/rate-limit'
import { sendEmail } from '@/server/mail/send'
import { contactNotificationEmail } from '@/shared/mail/templates'
import { BRAND } from '@/shared/brand'
import { contactSchema, topicLabel } from '@/shared/validation/contact'

/**
 * The `/contact` form's write — screen 6.
 *
 * The insert goes through `submit_contact_message()`, a security-definer
 * function, because nothing holding the anon key has rights on
 * `contact_messages` itself. The rate limit and the length checks live in that
 * function, so a hand-crafted POST that skips this file faces them anyway; the
 * validation here exists to produce sentences a person can act on.
 */

export interface ContactSubmission {
  name: string
  email: string
  topic: string
  message: string
}

export interface ContactState {
  error: string | null
  fieldErrors?: Record<string, string>
  /** Set on success, so the form can swap itself for an acknowledgement. */
  sent?: boolean
  /** The rejected submission, echoed back — React resets an uncontrolled form on return. */
  values?: ContactSubmission
}

function submissionOf(formData: FormData): ContactSubmission {
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }

  return {
    name: text('name'),
    email: text('email'),
    topic: text('topic'),
    message: text('message'),
  }
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const values = submissionOf(formData)

  /**
   * Per IP, in front of the per-address limit `submit_contact_message()` holds.
   * Both are needed and neither is redundant: the function's limit is five an
   * hour for one address, which a sender who varies the address walks straight
   * past, and this one does not know the address at all.
   *
   * Before the honeypot, so a bot filling every field is counted rather than
   * given a free acknowledgement each time.
   */
  const limit = await checkRateLimitByIp('contact')
  if (!limit.allowed) return { error: rateLimitMessage(limit), values }

  // Honeypot. A field hidden from people and left empty by them; a bot that
  // fills every input fills this one too. Answering "sent" rather than "no"
  // means the sender is told nothing about why it did not arrive — which is the
  // point, since the alternative is a bot that learns to leave it alone.
  if (formData.get('website')) return { error: null, sent: true }

  const parsed = contactSchema.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors, values }
  }

  const sourcePath = formData.get('sourcePath')

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_contact_message', {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_topic: parsed.data.topic,
    p_message: parsed.data.message,
    // The column's own limit, so a hand-crafted POST is trimmed rather than
    // rejected by a check constraint the sender never saw.
    p_source_path:
      typeof sourcePath === 'string' && sourcePath ? sourcePath.slice(0, 200) : undefined,
  })

  if (error) {
    // P0001 is the rate limit raising by hand; it is the one failure with a
    // remedy the sender can act on, so it gets its own sentence.
    if (error.code === 'P0001') {
      return {
        error:
          'That is several messages from this address in the last hour. Give it a little while, or write to us by email.',
        values,
      }
    }
    return { error: 'Could not send that. Please try again, or write to us by email.', values }
  }

  /**
   * Tell somebody it arrived.
   *
   * The page promises an answer "within about three working days", and until this
   * existed that promise rested on a person remembering to open a table in
   * Studio. The row is still the record — `contact_messages` and its `handled_at`
   * are unchanged — and this is the notification that makes the promise
   * something the product keeps rather than something it hopes for.
   *
   * The sender's address rides in `Reply-To`, so answering is one press rather
   * than a copy and paste. `after()` keeps it off the acknowledgement the sender
   * is waiting for, and a failure is logged without changing what they are told:
   * their message did reach us, which is the thing that was true either way.
   */
  after(async () => {
    await sendEmail({
      to: BRAND.support.email,
      replyTo: parsed.data.email,
      ...contactNotificationEmail({
        name: parsed.data.name,
        email: parsed.data.email,
        // The label rather than the stored value: the row keeps `bug`, and a
        // subject line reading "bug: Ada Lovelace" is a database column leaking
        // into somebody's inbox. `topicLabel` is the same map the form's own
        // picker renders, so the two cannot describe a message differently.
        topic: topicLabel(parsed.data.topic),
        message: parsed.data.message,
        sourcePath:
          typeof sourcePath === 'string' && sourcePath ? sourcePath.slice(0, 200) : undefined,
      }),
    })
  })

  return { error: null, sent: true }
}
