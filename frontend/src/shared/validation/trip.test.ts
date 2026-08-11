import { describe, expect, it } from 'vitest'
import { createTripSchema, slugify, suggestStatus } from './trip'

const TODAY = new Date('2026-08-11T12:00:00Z')

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Vietnam by rail',
    summary: '',
    tripType: 'solo',
    travelerCount: '2',
    startDate: '2024-05-02',
    endDate: '2024-05-20',
    status: 'completed',
    visibility: 'private',
    budgetPlanned: '',
    currency: 'INR',
    places: [{ countryCode: 'VNM', regionCode: '', cityName: 'Hanoi' }],
    ...overrides,
  }
}

describe('suggestStatus', () => {
  it('treats a trip with no start date as planning', () => {
    expect(suggestStatus(null, null, TODAY)).toBe('planning')
  })

  it('marks a finished trip completed', () => {
    expect(suggestStatus('2024-05-02', '2024-05-20', TODAY)).toBe('completed')
  })

  it('marks a trip spanning today as ongoing', () => {
    expect(suggestStatus('2026-08-08', '2026-08-15', TODAY)).toBe('ongoing')
  })

  it('marks a future trip upcoming', () => {
    expect(suggestStatus('2026-11-02', '2026-11-12', TODAY)).toBe('upcoming')
  })

  it('treats an open-ended trip that has started as ongoing', () => {
    expect(suggestStatus('2026-08-01', null, TODAY)).toBe('ongoing')
  })

  // The boundary that decides whether today's departure reads as ongoing.
  it('counts a trip starting today as ongoing, not upcoming', () => {
    expect(suggestStatus('2026-08-11', '2026-08-20', TODAY)).toBe('ongoing')
  })

  it('counts a trip ending today as ongoing, not completed', () => {
    expect(suggestStatus('2026-08-01', '2026-08-11', TODAY)).toBe('ongoing')
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ladakh on two wheels')).toBe('ladakh-on-two-wheels')
  })

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Café hopping')).toBe('cafe-hopping')
  })

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugify('  Goa —— slowly!  ')).toBe('goa-slowly')
  })

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toBe('trip')
  })

  it('caps length so the column stays sane', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60)
  })
})

describe('createTripSchema', () => {
  it('accepts a well-formed trip', () => {
    expect(createTripSchema.safeParse(validInput()).success).toBe(true)
  })

  it('requires a title', () => {
    const result = createTripSchema.safeParse(validInput({ title: '   ' }))
    expect(result.success).toBe(false)
  })

  it('requires at least one place — this is what fills in the globe', () => {
    const result = createTripSchema.safeParse(validInput({ places: [] }))
    expect(result.success).toBe(false)
  })

  it('rejects an unknown country code', () => {
    const result = createTripSchema.safeParse(
      validInput({ places: [{ countryCode: 'ZZZ', regionCode: '', cityName: '' }] })
    )
    expect(result.success).toBe(false)
  })

  it('rejects an end date before the start date, matching the DB constraint', () => {
    const result = createTripSchema.safeParse(
      validInput({ startDate: '2024-05-20', endDate: '2024-05-02' })
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('endDate'))).toBe(true)
  })

  it('allows equal start and end dates — a day trip is a trip', () => {
    const result = createTripSchema.safeParse(
      validInput({ startDate: '2024-05-02', endDate: '2024-05-02' })
    )
    expect(result.success).toBe(true)
  })

  it('turns empty dates into null rather than failing', () => {
    const result = createTripSchema.safeParse(validInput({ startDate: '', endDate: '' }))
    expect(result.success).toBe(true)
    expect(result.data?.startDate).toBeNull()
    expect(result.data?.endDate).toBeNull()
  })

  it('turns an empty budget into null and parses a filled one', () => {
    expect(createTripSchema.safeParse(validInput()).data?.budgetPlanned).toBeNull()
    expect(createTripSchema.safeParse(validInput({ budgetPlanned: '45000' })).data?.budgetPlanned).toBe(
      45000
    )
  })

  it('rejects a negative budget', () => {
    expect(createTripSchema.safeParse(validInput({ budgetPlanned: '-5' })).success).toBe(false)
  })

  it('requires at least one traveller', () => {
    expect(createTripSchema.safeParse(validInput({ travelerCount: '0' })).success).toBe(false)
  })

  it('rejects a visibility outside the enum', () => {
    expect(createTripSchema.safeParse(validInput({ visibility: 'everyone' })).success).toBe(false)
  })
})
