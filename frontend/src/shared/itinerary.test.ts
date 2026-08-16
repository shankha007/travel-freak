import { describe, expect, it } from 'vitest'
import {
  EXPENSE_CATEGORY_FOR_KIND,
  ITINERARY_KINDS,
  MAX_GENERATED_DAYS,
  canRecordExpense,
  costByCurrency,
  dayLabel,
  formatTime,
  formatTimeRange,
  parseOrderedIds,
  planVariance,
  tripDateRange,
} from '@/shared/itinerary'
import { EXPENSE_CATEGORIES } from '@/shared/budget'

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

describe('EXPENSE_CATEGORY_FOR_KIND', () => {
  it('maps every itinerary kind to a real expense category', () => {
    // Two enums of six that are not the same six. A kind with no mapping would
    // be a button that silently does nothing on one sort of row.
    for (const kind of ITINERARY_KINDS) {
      expect(EXPENSE_CATEGORIES).toContain(EXPENSE_CATEGORY_FOR_KIND[kind])
    }
  })

  it('files transport under flights, because there is no transport category', () => {
    // The planner migration's own reasoning: a train ticket is an expense under
    // "getting there", and inventing a seventh category would put this list out
    // of step with the pricing page.
    expect(EXPENSE_CATEGORY_FOR_KIND.transport).toBe('flights')
  })
})

describe('canRecordExpense', () => {
  it('offers the control on a priced entry that is not yet recorded', () => {
    expect(canRecordExpense({ cost: 8000, recorded: null })).toBe(true)
  })

  it('offers it on an entry deliberately priced at nothing', () => {
    // A free walking tour is a real plan, and recording it keeps the day's
    // actual spend honest about what has been accounted for.
    expect(canRecordExpense({ cost: 0, recorded: null })).toBe(true)
  })

  it('withholds it from an unpriced entry', () => {
    // Nothing to prefill: the writer would land on the empty form they already
    // have on the budget screen.
    expect(canRecordExpense({ cost: null, recorded: null })).toBe(false)
  })

  it('withholds it once the entry has been recorded', () => {
    expect(canRecordExpense({ cost: 8000, recorded: { id: 'e1' } })).toBe(false)
  })
})

describe('planVariance', () => {
  it('reports an overspend as a positive difference', () => {
    const variance = planVariance(
      { cost: 8000, currency: 'INR' },
      { amount: 9240, currency: 'INR' }
    )

    expect(variance).toEqual({ planned: 8000, actual: 9240, difference: 1240, currency: 'INR' })
  })

  it('reports an underspend as a negative one', () => {
    expect(
      planVariance({ cost: 8000, currency: 'INR' }, { amount: 7500, currency: 'INR' })?.difference
    ).toBe(-500)
  })

  it('refuses to compare across currencies', () => {
    // The same refusal every total in this codebase makes. "₹8,000 planned, $95
    // spent" is two facts, and there is no exchange rate here to make it one.
    expect(
      planVariance({ cost: 8000, currency: 'INR' }, { amount: 95, currency: 'USD' })
    ).toBeNull()
  })

  it('matches currencies case-insensitively', () => {
    expect(
      planVariance({ cost: 100, currency: 'inr' }, { amount: 120, currency: 'INR' })?.currency
    ).toBe('INR')
  })

  it('has nothing to compare when the plan carried no price', () => {
    expect(
      planVariance({ cost: null, currency: 'INR' }, { amount: 500, currency: 'INR' })
    ).toBeNull()
  })
})
