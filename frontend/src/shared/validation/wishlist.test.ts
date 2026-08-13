import { describe, expect, it } from 'vitest'
import { wishlistItemSchema } from './wishlist'
import { DEFAULT_PRIORITY, priorityLabel } from '@/shared/wishlist'

const minimal = { countryCode: 'ISL' }

describe('wishlistItemSchema', () => {
  it('accepts a country and nothing else', () => {
    // The globe needs only the code, so that is the whole requirement.
    const result = wishlistItemSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      countryCode: 'ISL',
      title: '',
      notes: '',
      estBudget: null,
      currency: 'INR',
      priority: DEFAULT_PRIORITY,
      bestSeason: '',
    })
  })

  it('upper-cases the codes, so a hand-typed "isl" still matches stored rows', () => {
    const result = wishlistItemSchema.parse({ countryCode: 'isl', currency: 'usd' })
    expect(result.countryCode).toBe('ISL')
    expect(result.currency).toBe('USD')
  })

  it('rejects a code that is not a country', () => {
    expect(wishlistItemSchema.safeParse({ countryCode: 'ZZZ' }).success).toBe(false)
    expect(wishlistItemSchema.safeParse({ countryCode: 'IN' }).success).toBe(false)
  })

  it('keeps a blank budget null rather than zero', () => {
    // Zero is a budget of nothing; null is not having decided.
    expect(wishlistItemSchema.parse(minimal).estBudget).toBeNull()
    expect(wishlistItemSchema.parse({ ...minimal, estBudget: 0 }).estBudget).toBe(0)
  })

  it('rejects a negative budget', () => {
    expect(wishlistItemSchema.safeParse({ ...minimal, estBudget: -1 }).success).toBe(false)
  })

  it('only accepts the five priorities the column allows', () => {
    // The check constraint is `between 1 and 5`; a 0 or a 6 would be a database
    // error surfacing as a broken form.
    for (const priority of [1, 2, 3, 4, 5]) {
      expect(wishlistItemSchema.safeParse({ ...minimal, priority }).success).toBe(true)
    }
    expect(wishlistItemSchema.safeParse({ ...minimal, priority: 0 }).success).toBe(false)
    expect(wishlistItemSchema.safeParse({ ...minimal, priority: 6 }).success).toBe(false)
    expect(wishlistItemSchema.safeParse({ ...minimal, priority: 2.5 }).success).toBe(false)
  })

  it('trims the free text', () => {
    const result = wishlistItemSchema.parse({
      ...minimal,
      title: '  Ring road  ',
      bestSeason: ' Sep–Mar ',
    })
    expect(result.title).toBe('Ring road')
    expect(result.bestSeason).toBe('Sep–Mar')
  })
})

describe('priorityLabel', () => {
  it('names every priority the schema allows', () => {
    expect(priorityLabel(1)).toBe('Next up')
    expect(priorityLabel(5)).toBe('One day')
  })

  it('falls back rather than rendering undefined for an unexpected value', () => {
    expect(priorityLabel(9)).toBe('Priority 9')
  })
})
