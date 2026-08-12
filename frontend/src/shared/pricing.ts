import { formatBytes } from '@/shared/format'

/**
 * Turning `plans.limits` into pricing copy.
 *
 * The landing page used to carry a hand-written list of what each tier
 * includes, which is a second source of truth for numbers the server already
 * enforces — "5 photos per trip" was prose, and nothing failed when the column
 * said something else. Everything here is derived from the row instead, so the
 * page and the quota gate cannot disagree.
 *
 * The convention inside `limits` is the one `entitlements.ts` documents:
 *   null → unlimited
 *   0    → not available on this plan
 *
 * These functions are pure and take plain values, so the whole table can be
 * tested without a database.
 */

/** Prices are stored in the minor unit — 39900 is ₹399. */
export function formatPrice(minorUnits: number, currency: 'INR' | 'USD'): string {
  const major = minorUnits / 100
  const symbol = currency === 'INR' ? '₹' : '$'
  // Whole amounts read better without the trailing zeroes; ₹349.50 keeps them.
  const shown = Number.isInteger(major) ? major.toLocaleString('en-IN') : major.toFixed(2)
  return `${symbol}${shown}`
}

/**
 * A yearly price as "what you pay a month if you pay for the year".
 *
 * Null when there is no annual price to compare, which is how the free plan and
 * any tier without an annual deal opt out of the toggle rather than showing ₹0.
 */
export function monthlyEquivalent(
  yearlyMinorUnits: number,
  currency: 'INR' | 'USD'
): string | null {
  if (yearlyMinorUnits <= 0) return null
  return formatPrice(Math.round(yearlyMinorUnits / 12), currency)
}

/** How much a year of the annual price saves against twelve monthly ones. */
export function annualSavingPercent(monthly: number, yearly: number): number | null {
  if (monthly <= 0 || yearly <= 0) return null
  const full = monthly * 12
  if (yearly >= full) return null
  return Math.round(((full - yearly) / full) * 100)
}

/**
 * A quantity limit as a phrase.
 *
 * The three cases are the ones the column actually encodes, and they are not
 * interchangeable: "Unlimited" and "Not included" are opposite answers, and
 * printing a bare `null` as "0" would turn the best tier into the worst.
 */
export function formatLimit(value: number | null, unit: string, pluralUnit = `${unit}s`): string {
  if (value === null) return `Unlimited ${pluralUnit}`
  if (value === 0) return `No ${pluralUnit}`
  return `${value.toLocaleString('en-IN')} ${value === 1 ? unit : pluralUnit}`
}

/** Storage, which is a byte count rather than a countable thing. */
export function formatStorage(bytes: number | null): string {
  if (bytes === null) return 'Unlimited storage'
  if (bytes === 0) return 'No storage'
  return `${formatBytes(bytes)} of storage`
}

/** A boolean capability, for the comparison table's ticks and dashes. */
export type FeatureValue = { kind: 'yes' } | { kind: 'no' } | { kind: 'text'; text: string }

export const YES: FeatureValue = { kind: 'yes' }
export const NO: FeatureValue = { kind: 'no' }

export function text(value: string): FeatureValue {
  return { kind: 'text', text: value }
}

export function bool(value: unknown): FeatureValue {
  return value === true ? YES : NO
}

/** A countable limit for the table, where 0 means the row is a dash. */
export function quantity(value: number | null, unit: string, pluralUnit?: string): FeatureValue {
  if (value === 0) return NO
  if (value === null) return text('Unlimited')
  return text(formatLimit(value, unit, pluralUnit))
}

export interface PlanLimitsShape {
  trips: number | null
  photos_per_trip: number | null
  videos_per_trip: number | null
  audios_per_trip: number | null
  storage_bytes: number | null
  collaborators_per_trip: number | null
  globe_region_detail: boolean
  india_state_map: boolean
  albums: boolean
  itinerary_full: boolean
  budget_full: boolean
  analytics_advanced: boolean
  wrapped_advanced: boolean
  export_pdf: boolean
  export_media_archive: boolean
  custom_domain: boolean
  branding_badge: boolean
  ai_generations_per_month: number | null
  support: string
  [key: string]: unknown
}

/**
 * The five lines shown on a plan card.
 *
 * Deliberately short: a card is a decision, not a specification. The full
 * comparison lives in the table below it, from the same row.
 */
export function planHighlights(limits: PlanLimitsShape): string[] {
  return [
    formatLimit(limits.trips, 'trip'),
    `${formatLimit(limits.photos_per_trip, 'photo')} per trip`,
    formatStorage(limits.storage_bytes),
    limits.globe_region_detail ? 'States and provinces on the globe' : 'Globe at country level',
    limits.collaborators_per_trip === 0
      ? 'Solo, with public sharing'
      : `${formatLimit(limits.collaborators_per_trip, 'collaborator')} per trip`,
  ]
}

export interface ComparisonRow {
  label: string
  /** Why the row matters, for the ones whose name does not say it. */
  hint?: string
  value: (limits: PlanLimitsShape) => FeatureValue
}

export interface ComparisonGroup {
  title: string
  rows: ComparisonRow[]
}

/**
 * The comparison table, as data.
 *
 * Every cell is a function of the plan's own `limits`, so adding a plan needs no
 * change here and changing a limit in the database changes the table.
 */
export const COMPARISON: ComparisonGroup[] = [
  {
    title: 'Trips and places',
    rows: [
      { label: 'Trips', value: (l) => quantity(l.trips, 'trip') },
      {
        label: 'Itinerary builder',
        hint: 'Day-by-day plans rather than dates alone.',
        value: (l) => bool(l.itinerary_full),
      },
      {
        label: 'Budget tracking',
        hint: 'Planned against actual, per trip.',
        value: (l) => bool(l.budget_full),
      },
      {
        label: 'Collaborators',
        value: (l) => quantity(l.collaborators_per_trip, 'person', 'people'),
      },
    ],
  },
  {
    title: 'Memories',
    rows: [
      { label: 'Photos per trip', value: (l) => quantity(l.photos_per_trip, 'photo') },
      { label: 'Videos per trip', value: (l) => quantity(l.videos_per_trip, 'video') },
      { label: 'Audio diaries', value: (l) => quantity(l.audios_per_trip, 'clip') },
      {
        label: 'Storage',
        value: (l) =>
          l.storage_bytes === null ? text('Unlimited') : text(formatBytes(l.storage_bytes ?? 0)),
      },
      { label: 'Albums', value: (l) => bool(l.albums) },
      { label: 'Blogs and notes', value: () => text('Unlimited') },
    ],
  },
  {
    title: 'Maps and globe',
    rows: [
      {
        label: 'Globe, country level',
        hint: 'Free on every plan, forever.',
        value: () => YES,
      },
      {
        label: 'States and provinces',
        hint: 'Subdivision detail on the globe and the world map.',
        value: (l) => bool(l.globe_region_detail),
      },
      {
        label: 'India state map',
        hint: 'Free on every plan.',
        value: (l) => bool(l.india_state_map),
      },
    ],
  },
  {
    title: 'Sharing and export',
    rows: [
      { label: 'Public profile and trip pages', value: () => YES },
      {
        label: 'Pages without our badge',
        hint: 'Free pages carry a small TravelFreak mark.',
        value: (l) => bool(!l.branding_badge),
      },
      { label: 'PDF export', value: (l) => bool(l.export_pdf) },
      { label: 'Media archive export', value: (l) => bool(l.export_media_archive) },
      { label: 'Custom domain', value: (l) => bool(l.custom_domain) },
    ],
  },
  {
    title: 'Everything else',
    rows: [
      { label: 'Advanced analytics', value: (l) => bool(l.analytics_advanced) },
      { label: 'Travel Wrapped', value: (l) => bool(l.wrapped_advanced) },
      {
        label: 'AI suggestions',
        value: (l) =>
          l.ai_generations_per_month === null
            ? text('Unlimited')
            : text(`${l.ai_generations_per_month ?? 0} a month`),
      },
      { label: 'Support', value: (l) => text(supportLabel(l.support)) },
    ],
  },
]

function supportLabel(support: string): string {
  if (support === 'priority') return 'Priority'
  if (support === 'email') return 'Email'
  return 'Community'
}
