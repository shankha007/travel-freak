import { describe, expect, it } from 'vitest'
import { RETENTION_DAYS, daysLeftIn, retentionCutoff } from './retention'

const NOW = new Date('2026-08-13T12:00:00Z').getTime()
const DAY = 86_400_000

describe('daysLeftIn', () => {
  it('reads a fresh delete as the full window', () => {
    expect(daysLeftIn(new Date(NOW).toISOString(), NOW)).toBe(RETENTION_DAYS)
  })

  it('rounds up, so a few hours in still shows the full window', () => {
    // A countdown that drops to 29 the same afternoon reads as a day lost.
    expect(daysLeftIn(new Date(NOW - 20 * 3_600_000).toISOString(), NOW)).toBe(RETENTION_DAYS)
  })

  it('counts down a day at a time', () => {
    expect(daysLeftIn(new Date(NOW - 10 * DAY).toISOString(), NOW)).toBe(20)
    expect(daysLeftIn(new Date(NOW - 29.5 * DAY).toISOString(), NOW)).toBe(1)
  })

  it('never goes negative once the window has closed', () => {
    expect(daysLeftIn(new Date(NOW - 45 * DAY).toISOString(), NOW)).toBe(0)
  })

  it('treats an unparseable timestamp as expired rather than throwing', () => {
    expect(daysLeftIn('not a date', NOW)).toBe(0)
  })
})

describe('retentionCutoff', () => {
  it('is exactly the window back from now', () => {
    expect(retentionCutoff(NOW)).toBe(new Date(NOW - RETENTION_DAYS * DAY).toISOString())
  })
})
