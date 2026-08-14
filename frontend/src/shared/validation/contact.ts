import { z } from 'zod'

/**
 * One message from `/contact` — screen 6.
 *
 * The limits below are the same numbers as the check constraints on
 * `contact_messages`, deliberately: a form that accepts what the database will
 * refuse produces a generic "could not save" for a mistake the writer could
 * have fixed in the field. The database is still the one that decides.
 */

export const CONTACT_TOPICS = [
  { value: 'support', label: 'Help using it' },
  { value: 'bug', label: 'Something is broken' },
  { value: 'feedback', label: 'Feedback or a feature request' },
  { value: 'privacy', label: 'Privacy — export, correction or deletion' },
  { value: 'billing', label: 'Plans and billing' },
  { value: 'security', label: 'A security issue' },
  { value: 'other', label: 'Something else' },
] as const

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value']

const TOPIC_VALUES = CONTACT_TOPICS.map((t) => t.value) as [ContactTopic, ...ContactTopic[]]

/** The shortest message worth sending. Below this there is nothing to answer. */
export const MIN_MESSAGE_LENGTH = 10
export const MAX_MESSAGE_LENGTH = 4000

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Tell us what to call you' })
    .max(80, { error: 'Keep the name under 80 characters' }),
  email: z
    .email({ error: 'Enter an address we can reply to' })
    .max(254, { error: 'That address is longer than an address can be' }),
  topic: z.enum(TOPIC_VALUES, { error: 'Pick what this is about' }),
  message: z
    .string()
    .trim()
    .min(MIN_MESSAGE_LENGTH, { error: 'A few more words would help us answer' })
    .max(MAX_MESSAGE_LENGTH, {
      error: `Keep it under ${MAX_MESSAGE_LENGTH.toLocaleString('en-IN')} characters`,
    }),
})

export type ContactValues = z.output<typeof contactSchema>

export function topicLabel(topic: string): string {
  return CONTACT_TOPICS.find((t) => t.value === topic)?.label ?? 'Something else'
}
