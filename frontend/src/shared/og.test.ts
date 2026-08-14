import { describe, expect, it } from 'vitest'
import { OG_SIZE, countLabel, factLine, truncate } from './og'

describe('OG_SIZE', () => {
  it('is the 1.91:1 both networks ask for', () => {
    expect(OG_SIZE.width / OG_SIZE.height).toBeCloseTo(1.9, 1)
  })
})

describe('truncate', () => {
  it('leaves anything that already fits alone', () => {
    expect(truncate('Two weeks in Iceland', 40)).toBe('Two weeks in Iceland')
  })

  it('collapses the whitespace a pasted title arrives with', () => {
    expect(truncate('  Two   weeks \n in Iceland ', 40)).toBe('Two weeks in Iceland')
  })

  it('cuts on a word boundary rather than mid-word', () => {
    const result = truncate('Two weeks chasing the northern lights in Iceland', 24)
    expect(result).toBe('Two weeks chasing the…')
    expect(result.length).toBeLessThanOrEqual(24)
  })

  it('cuts mid-word rather than returning almost nothing', () => {
    // One enormous word: respecting the boundary would leave "Lo…" from a
    // 40-character limit, which tells a reader less than the hard cut does.
    const long = `Lo${'o'.repeat(60)}ng`
    const result = truncate(`${long} tail`, 20)
    expect(result).toHaveLength(20)
    expect(result.endsWith('…')).toBe(true)
  })

  it('never exceeds the limit it was given', () => {
    for (const max of [10, 20, 40, 72]) {
      const result = truncate('A reasonably wordy trip title that goes on for a while', max)
      expect(result.length).toBeLessThanOrEqual(max)
    }
  })
})

describe('factLine', () => {
  it('joins what there is', () => {
    expect(factLine(['12 countries', '4 trips'])).toBe('12 countries · 4 trips')
  })

  it('drops the empties rather than leaving orphaned separators', () => {
    expect(factLine(['12 countries', null, undefined, '', false, '4 trips'])).toBe(
      '12 countries · 4 trips'
    )
  })

  it('is empty when there is nothing, so the caller can render nothing', () => {
    expect(factLine([null, '', undefined])).toBe('')
  })
})

describe('countLabel', () => {
  it('agrees with itself about number', () => {
    expect(countLabel(1, 'country', 'countries')).toBe('1 country')
    expect(countLabel(12, 'country', 'countries')).toBe('12 countries')
    expect(countLabel(3, 'trip')).toBe('3 trips')
  })

  it('says nothing rather than advertising an empty account', () => {
    // "0 countries" on a share card is worse than no line at all.
    expect(countLabel(0, 'country', 'countries')).toBeNull()
    expect(countLabel(-1, 'country', 'countries')).toBeNull()
    expect(countLabel(Number.NaN, 'country', 'countries')).toBeNull()
  })
})
