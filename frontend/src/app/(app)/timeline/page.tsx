import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CalendarClock,
  CalendarRange,
  Camera,
  Clock,
  Compass,
  MapPin,
  NotebookPen,
  Sparkles,
} from 'lucide-react'
import { getTimeline } from '@/server/queries/timeline'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import type { TimelineYear } from '@/shared/timeline'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Travel Timeline — screen 31.
 *
 * `/trips` answers "what have I got", sorted into past and upcoming. This
 * answers "what happened", which is a different question: one column, newest
 * first, with the year as the unit — and each year saying what it added up to
 * before listing what it was made of.
 *
 * Free on every plan, per the plan's tier table.
 */

export const metadata: Metadata = {
  title: 'Timeline',
  description: 'Everything you have done, chronologically, grouped by year.',
}

export const dynamic = 'force-dynamic'

/**
 * How a trip's status is said on an entry.
 *
 * Completed is the default and gets no badge — most of a timeline is completed
 * trips, and a badge on nearly every row is noise rather than information.
 */
const STATUS_LABEL: Record<string, string | undefined> = {
  planning: 'Planning',
  upcoming: 'Booked',
  ongoing: 'Happening now',
}

function yearLabel(year: number | null): string {
  return year === null ? 'No dates yet' : String(year)
}

function anchorFor(year: number | null): string {
  return year === null ? 'undated' : String(year)
}

export default async function TimelinePage() {
  const years = await getTimeline()

  // Days and countries count what has happened; the trip count is everything on
  // the page, including what is still ahead, because that is what is listed.
  const totals = {
    trips: years.reduce((n, y) => n + y.tripCount, 0),
    days: years.reduce((n, y) => n + y.daysAway, 0),
    countries: new Set(years.flatMap((y) => y.newCountryCodes)).size,
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted-foreground">
          {years.length === 0
            ? 'Everything you have done, once there is something to show.'
            : `${totals.trips} ${totals.trips === 1 ? 'trip' : 'trips'} · ${totals.days} ${totals.days === 1 ? 'day' : 'days'} away · ${totals.countries} ${totals.countries === 1 ? 'country' : 'countries'} reached for the first time.`}
        </p>
      </header>

      {years.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <CalendarRange className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Nothing on the timeline yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Log a trip and it appears here, in the year it happened, along with anything you write
              about it.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/trips/new" />}>
            Log a trip
          </Button>
        </div>
      ) : (
        <>
          {/* Plain anchors rather than a scroll-spy: the list is short, the jump
              is instant, and it works before any JavaScript has loaded. */}
          {years.length > 1 && (
            <nav aria-label="Jump to a year" className="flex flex-wrap gap-1.5">
              {years.map((year) => (
                <Button
                  key={anchorFor(year.year)}
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`#year-${anchorFor(year.year)}`} />}
                >
                  {yearLabel(year.year)}
                </Button>
              ))}
            </nav>
          )}

          <div className="space-y-10">
            {years.map((year) => (
              <YearSection key={anchorFor(year.year)} year={year} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function YearSection({ year }: { year: TimelineYear }) {
  const anchor = anchorFor(year.year)

  return (
    <section id={`year-${anchor}`} className="scroll-mt-6 space-y-4">
      <div className="space-y-2 border-b pb-3">
        <h2 className="text-xl font-semibold tracking-tight tabular-nums">
          {yearLabel(year.year)}
        </h2>

        {year.year === null ? (
          <p className="text-sm text-muted-foreground">
            Trips without dates. Give one a date range and it moves up into its year.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Compass className="size-3.5" aria-hidden />
              {year.tripCount} {year.tripCount === 1 ? 'trip' : 'trips'}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarRange className="size-3.5" aria-hidden />
              {year.daysAway} {year.daysAway === 1 ? 'day' : 'days'} away
            </span>
            {/* Never folded into the number above: days you have booked are not
                days you have lived. */}
            {year.scheduledDaysAway > 0 && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden />
                {year.scheduledDaysAway} more booked
              </span>
            )}
            {year.countryCodes.length > 0 && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {year.countryCodes.length}{' '}
                {year.countryCodes.length === 1 ? 'country' : 'countries'}
              </span>
            )}
          </div>
        )}

        {/* The number most people are actually keeping: going back to Thailand
            for the fourth time is a trip, not a new country. */}
        {year.newCountryCodes.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <Sparkles className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">First time in</span>
            {year.newCountryCodes.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1">
                <span aria-hidden>{countryFlag(code)}</span>
                {countryName(code)}
              </Badge>
            ))}
          </p>
        )}
      </div>

      {year.entries.length === 0 ? (
        // A year with days but no entries: a trip that began in December and
        // ran into January leaves this year occupied but unlisted.
        <p className="text-sm text-muted-foreground">
          No trip began this year — those days belong to one that started the year before.
        </p>
      ) : (
        <ol className="space-y-4 border-l pl-6">
          {year.entries.map((entry) =>
            entry.kind === 'trip' ? (
              <li key={entry.trip.id} className="relative">
                <Dot />
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="flex flex-wrap items-center gap-2 font-medium">
                        <Link
                          href={`/trips/${entry.trip.id}`}
                          className="hover:underline hover:underline-offset-4"
                        >
                          {entry.trip.title}
                        </Link>
                        {/* Said in words on the entry itself, so a year holding
                            both lived and booked travel reads correctly without
                            comparing it against the stats above. */}
                        {STATUS_LABEL[entry.trip.status] && (
                          <Badge variant="outline" className="font-normal">
                            {STATUS_LABEL[entry.trip.status]}
                          </Badge>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(entry.trip.startDate, entry.trip.endDate)}
                        {entry.days !== null &&
                          ` · ${entry.days} ${entry.days === 1 ? 'day' : 'days'}`}
                      </p>
                    </div>

                    {entry.trip.summary && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {entry.trip.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {entry.trip.countryCodes.map((code) => (
                        <span key={code} className="flex items-center gap-1">
                          <span aria-hidden>{countryFlag(code)}</span>
                          {countryName(code)}
                        </span>
                      ))}
                      {entry.trip.photoCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="size-3" aria-hidden />
                          {entry.trip.photoCount}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ) : (
              <li key={entry.post.id} className="relative">
                <Dot muted />
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1.5 text-sm">
                    <NotebookPen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <Link
                      href={`/b/${entry.post.slug}`}
                      className="font-medium hover:underline hover:underline-offset-4"
                    >
                      {entry.post.title}
                    </Link>
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Published {formatDateRange(entry.at.slice(0, 10), null)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" aria-hidden />
                      {entry.post.readingMinutes} min
                    </span>
                  </p>
                </div>
              </li>
            )
          )}
        </ol>
      )}
    </section>
  )
}

function Dot({ muted = false }: { muted?: boolean }) {
  return (
    <span
      className={`absolute top-4 -left-[27px] size-2 rounded-full ring-4 ring-background ${muted ? 'bg-muted-foreground/50' : 'bg-primary'}`}
      aria-hidden
    />
  )
}
