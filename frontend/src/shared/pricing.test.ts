import { describe, expect, it } from 'vitest'
import {
  COMPARISON,
  annualSavingPercent,
  formatLimit,
  formatPrice,
  formatStorage,
  monthlyEquivalent,
  planHighlights,
  quantity,
  type PlanLimitsShape,
} from './pricing'

/** The Explorer row as the migration seeds it, trimmed to what pricing reads. */
const FREE = {
  trips: 15,
  photos_per_trip: 5,
  videos_per_trip: 0,
  audios_per_trip: 0,
  storage_bytes: 1_073_741_824,
  collaborators_per_trip: 0,
  globe_region_detail: false,
  india_state_map: true,
  albums: false,
  itinerary_full: false,
  budget_full: false,
  analytics_advanced: false,
  wrapped_advanced: false,
  export_pdf: false,
  export_media_archive: false,
  custom_domain: false,
  branding_badge: true,
  ai_generations_per_month: 5,
  support: 'community',
} satisfies PlanLimitsShape

const PAID: PlanLimitsShape = {
  ...FREE,
  trips: null,
  photos_per_trip: 200,
  storage_bytes: 32_212_254_720,
  collaborators_per_trip: 3,
  globe_region_detail: true,
  branding_badge: false,
  support: 'email',
}

describe('formatPrice', () => {
  it('reads minor units as rupees', () => {
    expect(formatPrice(39900, 'INR')).toBe('₹399')
    expect(formatPrice(0, 'INR')).toBe('₹0')
  })

  it('keeps the paise when an amount is not whole', () => {
    expect(formatPrice(34999, 'INR')).toBe('₹349.99')
  })

  it('switches symbol with currency', () => {
    expect(formatPrice(500, 'USD')).toBe('$5')
  })
})

describe('monthlyEquivalent', () => {
  it('divides a yearly price into what it costs a month', () => {
    expect(monthlyEquivalent(349900, 'INR')).toBe('₹291.58')
  })

  it('is null when there is no annual price, so the free plan opts out', () => {
    expect(monthlyEquivalent(0, 'INR')).toBeNull()
  })
})

describe('annualSavingPercent', () => {
  it('compares a year against twelve months of the monthly price', () => {
    // ₹399 × 12 = ₹4,788 against ₹3,499.
    expect(annualSavingPercent(39900, 349900)).toBe(27)
  })

  it('is null when paying yearly saves nothing', () => {
    expect(annualSavingPercent(39900, 478800)).toBeNull()
    expect(annualSavingPercent(39900, 500000)).toBeNull()
  })

  it('is null for a free plan rather than dividing by zero', () => {
    expect(annualSavingPercent(0, 0)).toBeNull()
  })
})

describe('formatLimit', () => {
  it('reads null as unlimited, not as zero', () => {
    expect(formatLimit(null, 'trip')).toBe('Unlimited trips')
  })

  it('reads zero as not included, which is the opposite answer', () => {
    expect(formatLimit(0, 'video')).toBe('No videos')
  })

  it('singularises one', () => {
    expect(formatLimit(1, 'trip')).toBe('1 trip')
    expect(formatLimit(15, 'trip')).toBe('15 trips')
  })

  it('takes an irregular plural', () => {
    expect(formatLimit(3, 'person', 'people')).toBe('3 people')
  })
})

describe('formatStorage', () => {
  it('reads bytes as a size', () => {
    expect(formatStorage(1_073_741_824)).toBe('1.0 GB of storage')
  })

  it('keeps null meaning unlimited', () => {
    expect(formatStorage(null)).toBe('Unlimited storage')
  })
})

describe('quantity', () => {
  it('turns zero into a dash rather than the text "0"', () => {
    expect(quantity(0, 'video')).toEqual({ kind: 'no' })
  })

  it('turns null into Unlimited', () => {
    expect(quantity(null, 'trip')).toEqual({ kind: 'text', text: 'Unlimited' })
  })
})

describe('planHighlights', () => {
  it('describes the free plan from its own row', () => {
    expect(planHighlights(FREE)).toEqual([
      '15 trips',
      '5 photos per trip',
      '1.0 GB of storage',
      'Globe at country level',
      'Solo, with public sharing',
    ])
  })

  it('describes a paid plan from its own row', () => {
    expect(planHighlights(PAID)).toEqual([
      'Unlimited trips',
      '200 photos per trip',
      '30 GB of storage',
      'States and provinces on the globe',
      '3 collaborators per trip',
    ])
  })
})

describe('COMPARISON', () => {
  it('has a value for every row on every plan', () => {
    for (const group of COMPARISON) {
      for (const row of group.rows) {
        for (const limits of [FREE, PAID]) {
          const value = row.value(limits)
          expect(['yes', 'no', 'text']).toContain(value.kind)
          if (value.kind === 'text') expect(value.text).not.toBe('')
        }
      }
    }
  })

  it('reads the badge row as "included" when the plan has no badge', () => {
    const row = COMPARISON.flatMap((g) => g.rows).find((r) => r.label === 'Pages without our badge')
    expect(row?.value(FREE)).toEqual({ kind: 'no' })
    expect(row?.value(PAID)).toEqual({ kind: 'yes' })
  })

  it('labels support per plan', () => {
    const row = COMPARISON.flatMap((g) => g.rows).find((r) => r.label === 'Support')
    expect(row?.value(FREE)).toEqual({ kind: 'text', text: 'Community' })
    expect(row?.value(PAID)).toEqual({ kind: 'text', text: 'Email' })
  })
})
