import { describe, expect, it } from 'vitest'
import {
  CONTACT_TOPICS,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  contactSchema,
  topicLabel,
} from './contact'

const valid = {
  name: 'Ada',
  email: 'ada@example.com',
  topic: 'bug',
  message: 'The globe stays grey after I log a trip to Iceland.',
}

describe('contactSchema', () => {
  it('accepts an ordinary message', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('needs an address that can actually be replied to', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'ada@' }).success).toBe(false)
    expect(contactSchema.safeParse({ ...valid, email: '' }).success).toBe(false)
  })

  it('refuses a topic nobody offered', () => {
    // The database has the same seven in a check constraint; a mismatch here
    // would turn a typo in a hand-crafted POST into a 23514 the writer cannot act on.
    expect(contactSchema.safeParse({ ...valid, topic: 'marketing' }).success).toBe(false)
  })

  it('holds the message to the same bounds as the column', () => {
    const short = 'a'.repeat(MIN_MESSAGE_LENGTH - 1)
    const long = 'a'.repeat(MAX_MESSAGE_LENGTH + 1)
    expect(contactSchema.safeParse({ ...valid, message: short }).success).toBe(false)
    expect(contactSchema.safeParse({ ...valid, message: long }).success).toBe(false)
  })

  it('measures the message after trimming, so whitespace is not a message', () => {
    const padded = `   ${'a'.repeat(MIN_MESSAGE_LENGTH - 2)}   `
    expect(contactSchema.safeParse({ ...valid, message: padded }).success).toBe(false)
  })

  it('reports each problem against its own field', () => {
    const result = contactSchema.safeParse({ name: '', email: 'no', topic: 'bug', message: 'hi' })
    expect(result.success).toBe(false)
    const paths = result.error?.issues.map((i) => i.path.join('.')) ?? []
    expect(paths).toContain('name')
    expect(paths).toContain('email')
    expect(paths).toContain('message')
  })
})

describe('topicLabel', () => {
  it('names every topic the form offers', () => {
    for (const topic of CONTACT_TOPICS) expect(topicLabel(topic.value)).toBe(topic.label)
  })

  it('falls back rather than rendering a blank label', () => {
    expect(topicLabel('nonsense')).toBe('Something else')
  })
})
