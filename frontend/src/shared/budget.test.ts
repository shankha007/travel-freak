import { describe, expect, it } from 'vitest'
import {
  budgetVerdict,
  categoryLabel,
  formatMoney,
  summariseBudget,
  type BudgetExpense,
} from '@/shared/budget'

const inr = (amount: number, category = 'food'): BudgetExpense => ({
  category,
  amount,
  currency: 'INR',
})

describe('summariseBudget', () => {
  it('has nothing to say about a trip with no budget and no spend', () => {
    const summary = summariseBudget({ expenses: [], planned: null, plannedCurrency: 'INR' })

    expect(summary.currencies).toEqual([])
    expect(summary.count).toBe(0)
  })

  it('shows a budget that has been set but not spent against', () => {
    const summary = summariseBudget({ expenses: [], planned: 50000, plannedCurrency: 'INR' })

    expect(summary.currencies).toHaveLength(1)
    expect(summary.currencies[0]).toMatchObject({
      currency: 'INR',
      spent: 0,
      planned: 50000,
      remaining: 50000,
      usedPercent: 0,
      count: 0,
    })
  })

  it('compares spend against the plan in the same currency', () => {
    const summary = summariseBudget({
      expenses: [inr(10000, 'flights'), inr(5000, 'food')],
      planned: 50000,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]).toMatchObject({
      spent: 15000,
      remaining: 35000,
      usedPercent: 30,
      count: 2,
    })
  })

  it('reports going over as a negative remainder rather than clamping', () => {
    const summary = summariseBudget({
      expenses: [inr(60000, 'hotels')],
      planned: 50000,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]?.remaining).toBe(-10000)
    expect(summary.currencies[0]?.usedPercent).toBe(120)
  })

  it('never converts between currencies', () => {
    const summary = summariseBudget({
      expenses: [inr(40000, 'hotels'), { category: 'food', amount: 400, currency: 'USD' }],
      planned: 50000,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies.map((c) => [c.currency, c.spent])).toEqual([
      ['INR', 40000],
      ['USD', 400],
    ])
    // The plan is in rupees, so the dollars get a total and no comparison.
    expect(summary.currencies[1]?.planned).toBeNull()
    expect(summary.currencies[1]?.remaining).toBeNull()
    expect(summary.hasUnplannedCurrency).toBe(true)
  })

  it('does not flag an unplanned currency when everything is in the planned one', () => {
    const summary = summariseBudget({
      expenses: [inr(100)],
      planned: 500,
      plannedCurrency: 'INR',
    })

    expect(summary.hasUnplannedCurrency).toBe(false)
  })

  it('leads with the planned currency even when it is not the largest', () => {
    const summary = summariseBudget({
      expenses: [inr(100), { category: 'food', amount: 9000, currency: 'JPY' }],
      planned: 500,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]?.currency).toBe('INR')
  })

  it('treats a missing plan as unbudgeted rather than as zero', () => {
    const summary = summariseBudget({
      expenses: [inr(1200)],
      planned: null,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]?.planned).toBeNull()
    expect(summary.currencies[0]?.usedPercent).toBeNull()
    expect(budgetVerdict(summary.currencies[0]!)).toBe('unplanned')
  })

  it('refuses to divide by a budget of zero', () => {
    const summary = summariseBudget({ expenses: [inr(100)], planned: 0, plannedCurrency: 'INR' })

    expect(summary.currencies[0]?.usedPercent).toBeNull()
  })

  it('breaks a currency down by category, largest first', () => {
    const summary = summariseBudget({
      expenses: [inr(1000, 'food'), inr(4000, 'hotels'), inr(1000, 'food')],
      planned: null,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]?.categories).toEqual([
      { category: 'hotels', label: 'Stays', total: 4000, percent: 66.7, count: 1 },
      { category: 'food', label: 'Food & drink', total: 2000, percent: 33.3, count: 2 },
    ])
  })

  it('lists no category that has nothing in it', () => {
    const summary = summariseBudget({
      expenses: [inr(500, 'shopping')],
      planned: null,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]?.categories).toHaveLength(1)
  })

  it('folds currency case', () => {
    const summary = summariseBudget({
      expenses: [{ category: 'food', amount: 10, currency: 'inr' }],
      planned: 100,
      plannedCurrency: 'inr',
    })

    expect(summary.currencies).toHaveLength(1)
    expect(summary.currencies[0]?.usedPercent).toBe(10)
  })

  it('keeps paise from drifting into a float tail', () => {
    const summary = summariseBudget({
      expenses: [inr(0.1), inr(0.2)],
      planned: null,
      plannedCurrency: 'INR',
    })

    expect(summary.currencies[0]?.spent).toBe(0.3)
  })
})

describe('budgetVerdict', () => {
  const base = { currency: 'INR', spent: 0, count: 0, categories: [] }

  it('is under while there is room', () => {
    expect(
      budgetVerdict({ ...base, spent: 100, planned: 1000, remaining: 900, usedPercent: 10 })
    ).toBe('under')
  })

  it('warns as the plan runs out', () => {
    expect(
      budgetVerdict({ ...base, spent: 900, planned: 1000, remaining: 100, usedPercent: 90 })
    ).toBe('close')
  })

  it('is over past the plan, not at it', () => {
    expect(
      budgetVerdict({ ...base, spent: 1000, planned: 1000, remaining: 0, usedPercent: 100 })
    ).toBe('close')
    expect(
      budgetVerdict({ ...base, spent: 1001, planned: 1000, remaining: -1, usedPercent: 100.1 })
    ).toBe('over')
  })
})

describe('categoryLabel', () => {
  it('spells out a known category', () => {
    expect(categoryLabel('flights')).toBe('Getting there')
  })

  it('passes anything unknown through rather than blanking it', () => {
    expect(categoryLabel('bribes')).toBe('bribes')
  })
})

describe('formatMoney', () => {
  it('names the currency rather than guessing a symbol', () => {
    expect(formatMoney(40000, 'INR')).toBe('INR 40,000')
  })

  it('writes both decimal places once there are any, the way money is written', () => {
    expect(formatMoney(1234.5, 'usd')).toBe('USD 1,234.50')
  })
})
