import { describe, expect, it } from 'vitest'
import {
  MAX_GENERATED_DAYS,
  costByCurrency,
  dayLabel,
  formatTime,
  formatTimeRange,
  parseOrderedIds,
  tripDateRange,
} from '@/shared/itinerary'

describe('formatTime', () => {
  it('drops the seconds Postgres sends', () => {
    expect(formatTime('14:30:00')).toBe('14:30')
  })

  it('is empty for a time that was never set', () => {
    expect(formatTime(null)).toBe('')
  })

  it('hands back anything it does not recognise rather than mangling it', () => {
    expect(formatTime('soon')).toBe('soon')
  })
})

describe('formatTimeRange', () => {
  it('joins both ends', () => {
    expect(formatTimeRange('09:00:00', '11:30:00')).toBe('09:00 – 11:30')
  })

  it('shows a start with no end as a start', () => {
    expect(formatTimeRange('09:00:00', null)).toBe('09:00')
  })

  it('reads an end with no start as a deadline', () => {
    expect(formatTimeRange(null, '11:30:00')).toBe('until 11:30')
  })

  it('is empty when neither end is set', () => {
    expect(formatTimeRange(null, null)).toBe('')
  })
})

describe('costByCurrency', () => {
  it('adds up one currency', () => {
    expect(
      costByCurrency([
        { cost: 100, currency: 'INR' },
        { cost: 250.5, currency: 'INR' },
      ])
    ).toEqual([{ currency: 'INR', total: 350.5 }])
  })

  it('never sums across currencies', () => {
    const totals = costByCurrency([
      { cost: 40000, currency: 'INR' },
      { cost: 400, currency: 'USD' },
    ])

    expect(totals).toEqual([
      { currency: 'INR', total: 40000 },
      { currency: 'USD', total: 400 },
    ])
  })

  it('treats a missing cost as unpriced, not as free', () => {
    expect(costByCurrency([{ cost: null, currency: 'INR' }])).toEqual([])
  })

  it('folds case so inr and INR are one currency', () => {
    expect(
      costByCurrency([
        { cost: 10, currency: 'inr' },
        { cost: 5, currency: 'INR' },
      ])
    ).toEqual([{ currency: 'INR', total: 15 }])
  })

  it('leads with the largest', () => {
    const totals = costByCurrency([
      { cost: 10, currency: 'USD' },
      { cost: 900, currency: 'INR' },
    ])
    expect(totals[0]?.currency).toBe('INR')
  })
})

describe('parseOrderedIds', () => {
  const a = '11111111-1111-4111-8111-111111111111'
  const b = '22222222-2222-4222-8222-222222222222'

  it('reads the order a drag produced', () => {
    expect(parseOrderedIds(JSON.stringify([b, a]))).toEqual([b, a])
  })

  it('accepts an empty day', () => {
    // A day emptied by dragging its last entry away is a real state, not a
    // malformed payload.
    expect(parseOrderedIds('[]')).toEqual([])
  })

  it('refuses anything that is not JSON', () => {
    expect(parseOrderedIds('not json')).toBeNull()
    expect(parseOrderedIds('')).toBeNull()
  })

  it('refuses a payload that is not an array', () => {
    expect(parseOrderedIds(JSON.stringify({ 0: a }))).toBeNull()
    expect(parseOrderedIds(JSON.stringify(a))).toBeNull()
  })

  it('refuses the whole list if any id is malformed, rather than part-applying', () => {
    expect(parseOrderedIds(JSON.stringify([a, 'nonsense']))).toBeNull()
    expect(parseOrderedIds(JSON.stringify([a, 42]))).toBeNull()
    expect(parseOrderedIds(JSON.stringify([a, null]))).toBeNull()
  })

  it('refuses duplicates, which would silently drop an entry', () => {
    // The database sets order_index from array position, so a repeated id would
    // leave one entry unnumbered and another numbered twice.
    expect(parseOrderedIds(JSON.stringify([a, b, a]))).toBeNull()
  })

  it('catches a duplicate that differs only in case', () => {
    expect(parseOrderedIds(JSON.stringify([a, a.toUpperCase()]))).toBeNull()
  })
})

describe('dayLabel', () => {
  it('uses the title when there is one', () => {
    expect(dayLabel('Arrival and the old town', 0)).toBe('Arrival and the old town')
  })

  it('numbers an unnamed day from one', () => {
    expect(dayLabel('', 0)).toBe('Day 1')
    expect(dayLabel('   ', 2)).toBe('Day 3')
  })
})

describe('tripDateRange', () => {
  it('covers both ends inclusively', () => {
    expect(tripDateRange('2026-03-01', '2026-03-04')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ])
  })

  it('gives one day for a single-day trip', () => {
    expect(tripDateRange('2026-03-01', '2026-03-01')).toEqual(['2026-03-01'])
  })

  it('crosses a month and a year without arithmetic drift', () => {
    expect(tripDateRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  it('has nothing to offer a trip with no dates', () => {
    expect(tripDateRange(null, '2026-03-04')).toEqual([])
    expect(tripDateRange('2026-03-01', null)).toEqual([])
  })

  it('refuses an inverted range rather than looping', () => {
    expect(tripDateRange('2026-03-04', '2026-03-01')).toEqual([])
  })

  it('refuses a range long enough to be a mistyped year', () => {
    expect(tripDateRange('2026-01-01', '2027-01-01')).toEqual([])
  })

  it('goes right up to the cap', () => {
    const end = new Date(Date.UTC(2026, 0, MAX_GENERATED_DAYS))
    const range = tripDateRange('2026-01-01', end.toISOString().slice(0, 10))
    expect(range).toHaveLength(MAX_GENERATED_DAYS)
  })
})
