/**
 * The Travel Timeline — screen 31.
 *
 * Everything that happened, by year. The arithmetic lives here rather than in
 * the page because a timeline is a set of claims about someone's life — "you
 * spent 41 days away in 2025", "Japan was new that year" — and claims of that
 * kind deserve tests rather than a rendering that looks about right.
 */

export interface TimelineTripInput {
  id: string
  title: string
  slug: string
  summary: string
  startDate: string | null
  endDate: string | null
  status: string
  countryCodes: string[]
  photoCount: number
}

export interface TimelinePostInput {
  id: string
  title: string
  slug: string
  publishedAt: string | null
  readingMinutes: number
}

export type TimelineEntry =
  | { kind: 'trip'; at: string; trip: TimelineTripInput; days: number | null }
  | { kind: 'post'; at: string; post: TimelinePostInput }

export interface TimelineYear {
  /** The calendar year, or null for the section holding undated trips. */
  year: number | null
  entries: TimelineEntry[]
  /** Trips that began in this year. */
  tripCount: number
  /** Distinct countries touched by those trips. */
  countryCodes: string[]
  /**
   * Countries reached for the first time in this year.
   *
   * A subset of `countryCodes`, and the number most people actually want: going
   * back to Thailand for the fourth time is a trip, not a new country.
   */
  newCountryCodes: string[]
  /** Days spent away within this year, on trips that have happened. */
  daysAway: number
  /**
   * Days within this year on trips still to come.
   *
   * Kept apart from `daysAway` rather than added to it. The current year usually
   * holds both, and "34 days away" is a different claim from "23 days away and
   * 11 booked for November" — one of them is a fact about a life lived and the
   * other is a plan.
   */
  scheduledDaysAway: number
}

/**
 * Trip statuses that have actually happened, or are happening now.
 *
 * Exported because `analytics.ts` has to draw the same line, and a second copy
 * of "which trips count as travel taken" is a second copy that can disagree —
 * the timeline saying 41 days and the analytics screen saying 52 for the same
 * year is the kind of thing that costs a reader their trust in both.
 */
export const HAPPENED: ReadonlySet<string> = new Set(['completed', 'ongoing'])

/** The calendar year of an ISO date, or null when there is not one. */
export function yearOf(iso: string | null): number | null {
  if (!iso) return null
  const year = Number(iso.slice(0, 4))
  return Number.isInteger(year) ? year : null
}

/**
 * Days of a trip that fall inside one calendar year.
 *
 * A trip from 28 December to 4 January is eight days of travel, four of them in
 * each year. Attributing all eight to the year it started in would be the easy
 * thing and would quietly overstate one year and empty the next, so the range is
 * clamped to the year and counted there. Both ends are inclusive, which is how
 * people count holidays.
 */
export function daysInYear(start: string | null, end: string | null, year: number): number {
  if (!start) return 0
  const from = new Date(`${start.slice(0, 10)}T00:00:00Z`)
  const to = new Date(`${(end ?? start).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0

  const yearStart = new Date(`${year}-01-01T00:00:00Z`)
  const yearEnd = new Date(`${year}-12-31T00:00:00Z`)

  const clampedFrom = from > yearStart ? from : yearStart
  const clampedTo = to < yearEnd ? to : yearEnd
  if (clampedTo < clampedFrom) return 0

  return Math.floor((clampedTo.getTime() - clampedFrom.getTime()) / 86_400_000) + 1
}

/** Days within one year across the trips that pass `keep`. */
function sumDays(
  trips: TimelineTripInput[],
  year: number,
  keep: (trip: TimelineTripInput) => boolean
): number {
  return trips
    .filter(keep)
    .reduce((total, trip) => total + daysInYear(trip.startDate, trip.endDate, year), 0)
}

/** Every calendar year a trip touches, so a New Year crossing counts in both. */
function yearsSpanned(start: string | null, end: string | null): number[] {
  const first = yearOf(start)
  if (first === null) return []
  const last = yearOf(end) ?? first
  if (last < first) return [first]

  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

/**
 * Groups trips and posts into year sections, newest first.
 *
 * A trip is *listed* in the year it began — it is one event and belongs in one
 * place — but its days are counted in every year it actually occupied, which is
 * what `daysInYear` is for. Undated trips land in a trailing section rather than
 * being dropped: a draft with no dates is still something you are planning.
 *
 * `firstVisitYearByCountry` comes from the `visited_regions` aggregate, which
 * already knows when each country was first reached; recomputing it from this
 * page's trips would disagree with the globe for anyone who marked a country
 * "been there" without logging a trip.
 */
export function buildTimeline(
  trips: TimelineTripInput[],
  posts: TimelinePostInput[],
  firstVisitYearByCountry: Map<string, number>
): TimelineYear[] {
  const byYear = new Map<number | null, TimelineEntry[]>()

  const push = (year: number | null, entry: TimelineEntry) => {
    const existing = byYear.get(year)
    if (existing) existing.push(entry)
    else byYear.set(year, [entry])
  }

  // Every year any trip *occupied*, before anything is listed in one. A trip
  // from 28 December to 4 January is listed once, in December's year, but the
  // January year is still a year this person spent days away — without this it
  // would have no section at all and those days would vanish.
  for (const trip of trips) {
    for (const year of yearsSpanned(trip.startDate, trip.endDate)) {
      if (!byYear.has(year)) byYear.set(year, [])
    }
  }

  for (const trip of trips) {
    const year = yearOf(trip.startDate)
    push(year, {
      kind: 'trip',
      // Undated trips sort last within their section; '' does that and is never
      // shown, because the entry renders its dates rather than this key.
      at: trip.startDate ?? '',
      trip,
      days: trip.startDate ? daysInYear(trip.startDate, trip.endDate, year as number) : null,
    })
  }

  for (const post of posts) {
    const year = yearOf(post.publishedAt)
    // A post with no publication date has not happened yet; the blog screens are
    // where drafts live.
    if (year === null) continue
    push(year, { kind: 'post', at: post.publishedAt as string, post })
  }

  const sections: TimelineYear[] = []

  for (const [year, entries] of byYear) {
    entries.sort((a, b) => b.at.localeCompare(a.at))

    const yearTrips = entries.filter((e) => e.kind === 'trip').map((e) => e.trip)
    const countryCodes = [...new Set(yearTrips.flatMap((t) => t.countryCodes))]

    sections.push({
      year,
      entries,
      tripCount: yearTrips.length,
      countryCodes,
      newCountryCodes:
        year === null
          ? []
          : countryCodes.filter((code) => firstVisitYearByCountry.get(code) === year),
      // Counted over every trip, not just the ones listed here: a trip that
      // began on 28 December is listed under that year and still spent days in
      // this one.
      daysAway: year === null ? 0 : sumDays(trips, year, (t) => HAPPENED.has(t.status)),
      scheduledDaysAway: year === null ? 0 : sumDays(trips, year, (t) => !HAPPENED.has(t.status)),
    })
  }

  // Newest year first; the undated section trails everything.
  return sections.sort((a, b) => {
    if (a.year === null) return 1
    if (b.year === null) return -1
    return b.year - a.year
  })
}
