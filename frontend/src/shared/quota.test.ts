import { describe, expect, it } from 'vitest'
import { describeQuota, hasMeterableLines, quotaTone, usageFraction, type QuotaLine } from './quota'

const count = (value: number) => String(value)

function line(overrides: Partial<QuotaLine> = {}): QuotaLine {
  return { label: 'Trips', used: 3, limit: 15, format: count, ...overrides }
}

describe('usageFraction', () => {
  it('measures how full a limited line is', () => {
    expect(usageFraction(3, 15)).toBeCloseTo(0.2)
  })

  it('has no fraction for an unlimited line', () => {
    // `plans.limits` uses null for unlimited. Treating it as a number would
    // produce a full bar on the most expensive plan.
    expect(usageFraction(300, null)).toBeNull()
  })

  it('clamps past the ceiling rather than drawing a bar over 100%', () => {
    // Storage can legitimately exceed its limit — the cap is enforced when a
    // file arrives, and a downgrade moves the ceiling under what is stored.
    expect(usageFraction(20, 10)).toBe(1)
  })

  it('treats a limit of zero as nothing to measure', () => {
    // Zero means "not on this plan", which the app already reads that way for
    // collaborators. A meter has nothing to show for a feature you do not have.
    expect(usageFraction(0, 0)).toBeNull()
  })
})

describe('quotaTone', () => {
  it('is calm well under the limit', () => {
    expect(quotaTone(3, 15)).toBe('ok')
  })

  it('warns from four fifths', () => {
    expect(quotaTone(12, 15)).toBe('warn')
    expect(quotaTone(11, 15)).toBe('ok')
  })

  it('is full at the limit and past it', () => {
    expect(quotaTone(15, 15)).toBe('full')
    expect(quotaTone(16, 15)).toBe('full')
  })

  it('is never anything but calm when unlimited', () => {
    expect(quotaTone(9999, null)).toBe('ok')
  })
})

describe('describeQuota', () => {
  it('states the allowance rather than the remainder', () => {
    // The pricing table sells "15 trips". Saying "12 left" makes somebody
    // subtract to check they got what they paid for.
    expect(describeQuota(line())).toBe('3 of 15')
  })

  it('says unlimited instead of inventing a ceiling', () => {
    expect(describeQuota(line({ used: 42, limit: null }))).toBe('42 used · unlimited')
  })

  it('formats both numbers the same way', () => {
    const formatted = describeQuota(
      line({ label: 'Storage', used: 1024, limit: 4096, format: (v) => `${v / 1024} KB` })
    )

    expect(formatted).toBe('1 KB of 4 KB')
  })
})

describe('hasMeterableLines', () => {
  it('is true when something has a ceiling', () => {
    expect(hasMeterableLines([line({ limit: null }), line()])).toBe(true)
  })

  it('is false on a plan with no limits at all', () => {
    // Nothing to meter on the unlimited tier: a row of "unlimited" labels is
    // chrome, not information.
    expect(hasMeterableLines([line({ limit: null }), line({ limit: null })])).toBe(false)
  })
})
