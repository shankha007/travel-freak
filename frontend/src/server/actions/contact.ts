'use server'

import { createClient } from '@/server/supabase/server'
import { contactSchema } from '@/shared/validation/contact'

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

  return { error: null, sent: true }
}
