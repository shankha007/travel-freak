import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Globe2,
  Lock,
  MapPin,
  Route,
  Sparkles,
  Timer,
  Wallet,
} from 'lucide-react'
import { getAnalytics } from '@/server/queries/analytics'
import { TRIP_TYPE_LABELS, type TripLength } from '@/shared/analytics'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDistance } from '@/shared/resume'
import { formatMoney } from '@/shared/budget'
import { YearChart } from '@/client/components/analytics/year-chart'
import { TravelHeatmap } from '@/client/components/analytics/travel-heatmap'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Analytics — screen 32.
 *
 * `/resume` says what your travel adds up to and is built to be shared.
 * `/timeline` says what happened, in order. This says what the shape of it is:
 * which years, how long, how often you go back, and when in the year you
 * actually leave.
 *
 * Everything on it is computed by `shared/analytics.ts`, which is pure and
 * tested — the numbers here are claims about someone's life, and a chart is a
 * very convincing way to be wrong.
 *
 * The deeper half is gated on `analytics_advanced`, which is the row the
 * pricing table already sells. The gate hides the panels and says what they
 * are; it does not pretend they do not exist.
 */

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'The shape of your travel: years, lengths, destinations and when you actually go.',
}

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const data = await getAnalytics()
  const { headline, years, lengths, budgets, types, destinations } = data

  if (headline.trips === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <BarChart3 className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Nothing to analyse yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Log a trip with dates and this fills in — years, trip lengths, the countries you keep
              going back to, and a calendar of when you are actually away.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/trips/new" />}>
            Log a trip
          </Button>
        </div>
      </div>
    )
  }

  const stats = [
    { icon: Globe2, label: 'Countries', value: String(headline.countries) },
    { icon: MapPin, label: 'States & provinces', value: String(headline.regions) },
    { icon: MapPin, label: 'Cities', value: String(headline.cities) },
    { icon: CalendarDays, label: 'Days away', value: headline.travelDays.toLocaleString('en-IN') },
    { icon: Route, label: 'Trips', value: String(headline.trips) },
    { icon: Timer, label: 'Years travelling', value: String(headline.yearsTravelling) },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <Header />

      {/* Two across on a phone rather than one: six counters stacked is most of
          a screen of scrolling before the reader reaches anything they came for,
          and none of these values is long enough to need the width. */}
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="space-y-1 p-4">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* `min-w-0` because the chart inside measures its container: without
            it the grid item refuses to shrink and the whole page grows a
            horizontal scrollbar. */}
        <Card className="min-w-0">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1">
              <h2 className="font-medium">Days away, by year</h2>
              <p className="text-sm text-muted-foreground">
                A trip that crosses New Year is counted in both years, in the days it actually spent
                there. Empty years are drawn as empty rather than skipped.
                {data.undatedTrips > 0 && (
                  <>
                    {' '}
                    {data.undatedTrips} {data.undatedTrips === 1 ? 'trip has' : 'trips have'} no
                    dates and appear in no year.
                  </>
                )}
              </p>
            </div>
            <YearChart years={years} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-medium">How long you go for</h2>
              {lengths === null ? (
                <p className="text-sm text-muted-foreground">
                  Nothing measurable yet — a trip needs both a start and an end date, and needs to
                  have happened.
                </p>
              ) : (
                <>
                  <TripExtreme label="Longest" length={lengths.longest} />
                  <TripExtreme label="Shortest" length={lengths.shortest} />
                  <p className="text-sm text-muted-foreground">
                    Averaging{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {lengths.averageDays} days
                    </span>{' '}
                    over the {lengths.measured} {lengths.measured === 1 ? 'trip' : 'trips'} that can
                    be measured. Both ends counted, the way holidays are.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <h2 className="font-medium">Distance covered</h2>
              <p className="text-3xl font-semibold tabular-nums">
                {formatDistance(headline.distanceKm)}
              </p>
              <p className="text-sm text-muted-foreground">
                {headline.pinned.total === 0
                  ? 'No places recorded yet.'
                  : headline.pinned.measurable === 0
                    ? 'Distance is the leg between two stops, and no trip of yours has a second one recorded yet.'
                    : headline.pinned.measured === 0
                      ? 'No trip has two pinned stops yet, so there is nothing to measure. Pin a second place and the legs between stops start counting.'
                      : `Straight lines between the stops that carry a pin — ${headline.pinned.measured} of your ${headline.pinned.measurable} multi-stop trips. The legs it cannot see are real distance it is not claiming.`}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {data.showsAdvanced ? (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <h2 className="font-medium">When you are actually away</h2>
                <p className="text-sm text-muted-foreground">
                  One square per day. Solid is a day you were away; a dashed outline is one you have
                  booked but not yet taken.
                </p>
              </div>
              {data.heatmapYears.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No dated trips yet, so there is no calendar to draw.
                </p>
              ) : (
                <TravelHeatmap
                  trips={data.trips}
                  years={data.heatmapYears}
                  initialYear={data.heatmapYears[0]}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="font-medium">Who you travel with</h2>
                {types.stats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No trip has a type recorded. It is a field on the trip form, and this fills in
                    once a few of them do.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {types.stats.map((stat) => (
                        <li key={stat.type} className="space-y-1">
                          <div className="flex items-baseline justify-between text-sm">
                            <span>{TRIP_TYPE_LABELS[stat.type]}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {stat.trips} · {stat.percent}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-[var(--chart-1)]"
                              style={{ width: `${stat.percent}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                    {types.unstated > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Shares are of the {headline.trips - types.unstated} trips that say.{' '}
                        {types.unstated} {types.unstated === 1 ? 'does' : 'do'} not.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="font-medium">Where you keep going back</h2>
                {destinations.ranked.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nowhere visited yet. Countries appear here once a trip or a “been there” mark
                    puts them on the globe.
                  </p>
                ) : (
                  <>
                    <ol className="space-y-2">
                      {destinations.ranked.map((place) => (
                        <li
                          key={place.countryCode}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span className="truncate">
                            <span aria-hidden>{countryFlag(place.countryCode)}</span>{' '}
                            {countryName(place.countryCode)}
                          </span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {place.visits} {place.visits === 1 ? 'visit' : 'visits'}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      {destinations.favourite
                        ? `${countryName(destinations.favourite.countryCode)} is the one you return to.`
                        : 'Nothing has been visited twice yet, so there is no favourite to name.'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 font-medium">
                  <Wallet className="size-4 text-muted-foreground" aria-hidden />
                  Money
                </h2>
                {budgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No trip carries a budget or an expense yet. A budget is an optional field on the
                    trip form; expenses are recorded on a trip’s Budget screen.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {budgets.map((budget) => (
                      <li key={budget.currency} className="space-y-1">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {budget.currency}
                        </p>

                        <dl className="flex flex-wrap gap-x-6 gap-y-1">
                          {budget.plannedTrips > 0 && (
                            <div>
                              <dt className="text-xs text-muted-foreground">Planned</dt>
                              <dd className="text-lg leading-tight font-semibold tabular-nums">
                                {formatMoney(budget.plannedTotal, budget.currency)}
                              </dd>
                              <dd className="text-xs text-muted-foreground">
                                over {budget.plannedTrips}{' '}
                                {budget.plannedTrips === 1 ? 'trip' : 'trips'} ·{' '}
                                {formatMoney(budget.plannedAverage, budget.currency)} each
                              </dd>
                            </div>
                          )}

                          {budget.spentTrips > 0 && (
                            <div>
                              <dt className="text-xs text-muted-foreground">Spent</dt>
                              <dd className="text-lg leading-tight font-semibold tabular-nums">
                                {formatMoney(budget.spentTotal, budget.currency)}
                              </dd>
                              <dd className="text-xs text-muted-foreground">
                                across {budget.spentTrips}{' '}
                                {budget.spentTrips === 1 ? 'trip' : 'trips'}
                              </dd>
                            </div>
                          )}
                        </dl>

                        {/* The only place the two are set against each other, and
                            only over the trips that carry both. */}
                        {budget.comparable && (
                          <p className="text-xs text-muted-foreground">
                            On the {budget.comparable.trips}{' '}
                            {budget.comparable.trips === 1 ? 'trip' : 'trips'} with both,{' '}
                            {formatMoney(budget.comparable.spent, budget.currency)} spent against{' '}
                            {formatMoney(budget.comparable.planned, budget.currency)} planned —{' '}
                            <span className="font-medium text-foreground">
                              {budget.comparable.spent > budget.comparable.planned
                                ? `${formatMoney(
                                    Math.round(
                                      (budget.comparable.spent - budget.comparable.planned) * 100
                                    ) / 100,
                                    budget.currency
                                  )} over`
                                : `${formatMoney(
                                    Math.round(
                                      (budget.comparable.planned - budget.comparable.spent) * 100
                                    ) / 100,
                                    budget.currency
                                  )} under`}
                            </span>
                            .
                          </p>
                        )}

                        {budget.plannedTrips > 0 && budget.spentTrips > 0 && !budget.comparable && (
                          <p className="text-xs text-muted-foreground">
                            No trip has both a plan and spend in {budget.currency}, so there is
                            nothing here to compare.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Currencies are never added together, because there is no exchange rate here to do
                  it with — and a budgeted trip with no expenses recorded is left out of the
                  comparison rather than counted as an underspend.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <AdvancedLocked />
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
      <p className="text-sm text-muted-foreground">
        The shape of your travel — how much, how long, how often, and when.
      </p>
    </header>
  )
}

function TripExtreme({ label, length }: { label: string; length: TripLength }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <Link href={`/trips/${length.trip.id}`} className="font-medium hover:underline">
          {length.trip.title}
        </Link>
      </span>
      <span className="shrink-0 tabular-nums">
        {length.days} {length.days === 1 ? 'day' : 'days'}
      </span>
    </div>
  )
}

/**
 * The paid half, described rather than hidden.
 *
 * Naming what is behind the gate is the difference between an upsell and a
 * dead end: someone deciding whether to pay needs to know what they would get,
 * and someone who is not going to pay should not be left wondering whether the
 * page finished loading.
 */
function AdvancedLocked() {
  const behind = [
    'A calendar of every day you were away, one square per day',
    'Who you travel with — solo, as a couple, with friends or family',
    'The countries you keep going back to, ranked',
    'What you plan to spend, per currency and per trip',
  ]

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="w-fit gap-1">
            <Lock className="size-3" aria-hidden />
            On the paid plans
          </Badge>
          <h2 className="text-lg font-semibold tracking-tight">There is more in here</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {behind.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Everything above this line stays free, and so does your timeline and your resume.
          </p>
        </div>
        <Button size="lg" nativeButton={false} render={<Link href="/upgrade" />}>
          See the plans
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  )
}
