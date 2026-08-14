import { HAPPENED, daysInYear, yearOf } from '@/shared/timeline'

/**
 * The arithmetic behind Analytics — screen 32.
 *
 * Pure functions over rows the server has already fetched, for the same reason
 * `timeline.ts` and `resume.ts` are: every number on that screen is a claim
 * about someone's life, and "your longest trip was 23 days" is either true or
 * it is a bug that nobody will report because it looks plausible.
 *
 * Two rules run through the whole file.
 *
 * **Travel taken is counted apart from travel booked.** A trip in November is
 * not days you have been away, and adding the two would inflate the current
 * year every December. `HAPPENED` comes from `timeline.ts` so both screens draw
 * that line in the same place.
 *
 * **Nothing is invented to fill a hole.** A trip without dates contributes to
 * no year, a trip without a budget is not counted as a budget of zero, and a
 * measure with nothing to measure returns null rather than 0 — because 0 is a
 * claim and null is an absence.
 */

export interface AnalyticsTrip {
  id: string
  title: string
  slug: string
  startDate: string | null
  endDate: string | null
  status: string
  /** 'solo' | 'couple' | 'friends' | 'family' | 'business', or null when unsaid. */
  tripType: string | null
  budgetPlanned: number | null
  currency: string
  countryCodes: string[]
}

/** Trip types, in the order the breakdown lists them. Matches the `trip_type` enum. */
export const TRIP_TYPES = ['solo', 'couple', 'friends', 'family', 'business'] as const

export type TripType = (typeof TRIP_TYPES)[number]

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  solo: 'Solo',
  couple: 'As a couple',
  friends: 'With friends',
  family: 'With family',
  business: 'Business',
}

// ---------------------------------------------------------------------------
// Per year
// ---------------------------------------------------------------------------

export interface YearStat {
  year: number
  /** Trips that began in this year, whether or not they have happened. */
  trips: number
  /** Days of this year spent away on trips that have happened. */
  days: number
  /** Days of this year on trips still ahead. Never added to `days`. */
  scheduledDays: number
  /** Distinct countries touched by trips beginning in this year. */
  countries: number
  /** Of those, the ones reached for the first time in this year. */
  newCountries: number
}

/**
 * One row per calendar year, oldest first, **including the empty ones**.
 *
 * The gap-filling is the point. A chart drawn from 2019 and 2026 alone puts
 * them side by side and shows a person who travels constantly; the seven years
 * between them are the actual story, and a bar chart that omits its zeroes is
 * a bar chart that lies about the shape of a life.
 */
export function perYear(trips: AnalyticsTrip[]): YearStat[] {
  const dated = trips.filter((t) => yearOf(t.startDate) !== null)
  if (dated.length === 0) return []

  const startYears = dated.map((t) => yearOf(t.startDate) as number)
  const first = Math.min(...startYears)
  // The last year is the last one *touched*, not the last one begun in: a trip
  // running from 28 December into January contributes days to a year no trip
  // starts in, and taking the range from start dates alone would drop them off
  // the end of the chart without ever reporting a total that looked wrong.
  const last = Math.max(...dated.map((t) => yearOf(t.endDate) ?? (yearOf(t.startDate) as number)))

  // Which year each country was first reached, over trips that happened. A
  // country first *planned* for next year has not been reached.
  const firstSeen = new Map<string, number>()
  for (const trip of [...dated].sort((a, b) =>
    (a.startDate ?? '').localeCompare(b.startDate ?? '')
  )) {
    if (!HAPPENED.has(trip.status)) continue
    const year = yearOf(trip.startDate) as number
    for (const code of trip.countryCodes) {
      if (!firstSeen.has(code)) firstSeen.set(code, year)
    }
  }

  const rows: YearStat[] = []
  for (let year = first; year <= last; year++) {
    const began = dated.filter((t) => yearOf(t.startDate) === year)
    const countries = new Set(began.flatMap((t) => t.countryCodes))

    rows.push({
      year,
      trips: began.length,
      // Every trip is asked about every year, not just the ones that began in
      // it: a trip from 28 December to 4 January is four days of the next year.
      days: sumDays(dated, year, (t) => HAPPENED.has(t.status)),
      scheduledDays: sumDays(dated, year, (t) => !HAPPENED.has(t.status)),
      countries: countries.size,
      newCountries: [...countries].filter((code) => firstSeen.get(code) === year).length,
    })
  }

  return rows
}

function sumDays(
  trips: AnalyticsTrip[],
  year: number,
  include: (trip: AnalyticsTrip) => boolean
): number {
  return trips.reduce(
    (sum, trip) => (include(trip) ? sum + daysInYear(trip.startDate, trip.endDate, year) : sum),
    0
  )
}

// ---------------------------------------------------------------------------
// Trip lengths
// ---------------------------------------------------------------------------

export interface TripLength {
  trip: AnalyticsTrip
  days: number
}

export interface TripLengthSummary {
  longest: TripLength
  shortest: TripLength
  /** Mean length of the measurable trips, to one decimal place. */
  averageDays: number
  /** How many trips could be measured at all. */
  measured: number
}

/**
 * Longest, shortest and average trip, over trips that have happened and carry
 * both dates.
 *
 * Null when nothing can be measured. A planned trip is excluded on purpose —
 * "your shortest trip was 2 days" should not be a booking you have not taken.
 * Both ends inclusive, so a Friday-to-Sunday weekend is three days, which is
 * how people count them.
 */
export function tripLengths(trips: AnalyticsTrip[]): TripLengthSummary | null {
  const measured: TripLength[] = []

  for (const trip of trips) {
    if (!HAPPENED.has(trip.status) || !trip.startDate || !trip.endDate) continue
    const days = inclusiveDays(trip.startDate, trip.endDate)
    if (days !== null) measured.push({ trip, days })
  }

  if (measured.length === 0) return null

  const sorted = [...measured].sort((a, b) => a.days - b.days)
  const total = measured.reduce((sum, m) => sum + m.days, 0)

  return {
    longest: sorted[sorted.length - 1],
    shortest: sorted[0],
    averageDays: Math.round((total / measured.length) * 10) / 10,
    measured: measured.length,
  }
}

/** Days from start to end with both ends counted, or null if the dates are nonsense. */
export function inclusiveDays(start: string, end: string): number | null {
  const from = new Date(`${start.slice(0, 10)}T00:00:00Z`)
  const to = new Date(`${end.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface BudgetByCurrency {
  currency: string
  trips: number
  total: number
  average: number
}

/**
 * Planned budgets, grouped by the currency they were written in.
 *
 * Grouped rather than summed, because there is no exchange rate in this
 * codebase and inventing one would turn ₹40,000 and $400 into a single number
 * that is wrong in both currencies. Trips with no budget are left out entirely
 * rather than averaged in as zero — not having thought about the money is a
 * different statement from having planned to spend none.
 *
 * Largest total first, so the currency someone actually travels in leads.
 */
export function budgetByCurrency(trips: AnalyticsTrip[]): BudgetByCurrency[] {
  const groups = new Map<string, number[]>()

  for (const trip of trips) {
    if (trip.budgetPlanned === null || !Number.isFinite(trip.budgetPlanned)) continue
    const currency = trip.currency?.trim().toUpperCase() || 'INR'
    groups.set(currency, [...(groups.get(currency) ?? []), trip.budgetPlanned])
  }

  return [...groups.entries()]
    .map(([currency, amounts]) => {
      const total = amounts.reduce((sum, n) => sum + n, 0)
      return {
        currency,
        trips: amounts.length,
        total,
        average: Math.round(total / amounts.length),
      }
    })
    .sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------------------
// Trip types
// ---------------------------------------------------------------------------

export interface TripTypeStat {
  type: TripType
  trips: number
  /** Share of the trips that state a type at all, 0–100. */
  percent: number
}

export interface TripTypeBreakdown {
  stats: TripTypeStat[]
  /** Trips with no type recorded. Shown, not hidden — it is why the shares are what they are. */
  unstated: number
  /** The commonest type, or null when nothing states one. */
  favourite: TripTypeStat | null
}

/**
 * How the trips split by who they were with.
 *
 * Percentages are of the trips that *say*, not of all trips, so a person who
 * filled the field in twice does not read as "50% solo, 50% couple, and 90% of
 * my travel unaccounted for". `unstated` carries that number separately.
 */
export function byTripType(trips: AnalyticsTrip[]): TripTypeBreakdown {
  const counts = new Map<TripType, number>()
  let unstated = 0

  for (const trip of trips) {
    const type = trip.tripType as TripType | null
    if (type && (TRIP_TYPES as readonly string[]).includes(type)) {
      counts.set(type, (counts.get(type) ?? 0) + 1)
    } else {
      unstated++
    }
  }

  const stated = [...counts.values()].reduce((sum, n) => sum + n, 0)

  const stats = TRIP_TYPES.filter((type) => counts.has(type))
    .map((type) => ({
      type,
      trips: counts.get(type) as number,
      percent: stated === 0 ? 0 : Math.round(((counts.get(type) as number) / stated) * 100),
    }))
    .sort((a, b) => b.trips - a.trips)

  return { stats, unstated, favourite: stats[0] ?? null }
}

// ---------------------------------------------------------------------------
// Favourite destinations
// ---------------------------------------------------------------------------

export interface DestinationVisits {
  countryCode: string
  /** Separate trips that reached this country. */
  visits: number
  firstVisit: string | null
  lastVisit: string | null
}

export interface FavouriteDestinations {
  ranked: DestinationVisits[]
  /**
   * The country visited most often, or null when nothing has been visited twice.
   *
   * A "favourite" over a list where everything was visited once is not a
   * favourite, it is whatever sorted first — so the screen is told to say
   * nothing instead.
   */
  favourite: DestinationVisits | null
}

/**
 * Countries by how often they have been returned to.
 *
 * Reads the `visited_regions` aggregate rather than counting trips, because the
 * aggregate already knows that a trip through three cities in Japan is one
 * visit to Japan. Only rows in a visited state count: a country you plan to see
 * is not somewhere you keep going back to.
 *
 * A country with a visit count of zero is dropped rather than listed at the
 * bottom. Two things produce one: a trip you are on right now, which has not
 * finished being a visit yet, and a bare "been there" mark, which records no
 * trip by design. Both are real, and neither is an answer to "where do you keep
 * going back to" — the globe is where they belong, and "Singapore — 0 visits"
 * on this list reads as a bug even when the number is correct.
 */
export function favouriteDestinations(
  regions: {
    countryCode: string
    regionCode: string
    state: string
    visitCount: number
    firstVisit: string | null
    lastVisit: string | null
  }[],
  limit = 5
): FavouriteDestinations {
  const byCountry = new Map<string, DestinationVisits>()

  for (const region of regions) {
    if (region.state !== 'visited' && region.state !== 'current') continue

    const existing = byCountry.get(region.countryCode)
    // Subdivision rows and the country row describe the same visits, so the
    // country's count is the largest of them rather than their sum — adding
    // them would make a country you know in detail look like one you visit
    // constantly.
    byCountry.set(region.countryCode, {
      countryCode: region.countryCode,
      visits: Math.max(existing?.visits ?? 0, region.visitCount),
      firstVisit: earlier(existing?.firstVisit ?? null, region.firstVisit),
      lastVisit: later(existing?.lastVisit ?? null, region.lastVisit),
    })
  }

  const ranked = [...byCountry.values()]
    .filter((place) => place.visits > 0)
    // Ties broken by the most recent visit, then by code so the order is stable
    // across renders: a list where everything is "1 visit" should at least put
    // the place you were last at the top.
    .sort(
      (a, b) =>
        b.visits - a.visits ||
        (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') ||
        a.countryCode.localeCompare(b.countryCode)
    )
    .slice(0, limit)

  const top = ranked[0]
  return { ranked, favourite: top && top.visits > 1 ? top : null }
}

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

// ---------------------------------------------------------------------------
// The calendar heatmap
// ---------------------------------------------------------------------------

export interface TravelDay {
  /** `YYYY-MM-DD`. */
  date: string
  /** Trips covering this day. Normally 0 or 1; 2 where trips overlap. */
  trips: number
  /** True when every trip covering it is still ahead. */
  scheduled: boolean
}

/**
 * Every day of one calendar year, in order, marked with what was happening.
 *
 * A full year is returned rather than only the travelled days, because the
 * empty squares are the chart: a heatmap is read by the shape of the gaps.
 * Leap years take care of themselves — the loop walks real dates rather than
 * assuming 365.
 */
export function travelDaysOfYear(trips: AnalyticsTrip[], year: number): TravelDay[] {
  const days: TravelDay[] = []

  const spans = trips
    .filter((t) => t.startDate)
    .map((t) => ({
      from: `${t.startDate?.slice(0, 10)}`,
      to: `${(t.endDate ?? t.startDate)?.slice(0, 10)}`,
      happened: HAPPENED.has(t.status),
    }))
    .filter((s) => s.to >= s.from)

  const cursor = new Date(`${year}-01-01T00:00:00Z`)
  const end = new Date(`${year}-12-31T00:00:00Z`)

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10)
    const covering = spans.filter((s) => s.from <= date && date <= s.to)

    days.push({
      date,
      trips: covering.length,
      scheduled: covering.length > 0 && covering.every((s) => !s.happened),
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

/** The years worth offering in the heatmap's year picker, newest first. */
export function yearsWithTravel(trips: AnalyticsTrip[]): number[] {
  const years = new Set<number>()

  for (const trip of trips) {
    const from = yearOf(trip.startDate)
    const to = yearOf(trip.endDate) ?? from
    if (from === null || to === null) continue
    for (let year = from; year <= to; year++) years.add(year)
  }

  return [...years].sort((a, b) => b - a)
}
