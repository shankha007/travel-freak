import { CalendarRange, Clock, Globe2, Map as MapIcon, Route, Luggage } from 'lucide-react'
import type { ResumeStats } from '@/server/queries/resume'
import { PLACE_KINDS, formatDistance, placeKindLabel } from '@/shared/resume'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * The counters that make up a Travel Resume.
 *
 * A server component: it is just numbers, and both the private resume and the
 * public profile render the same ones. Kinds with a zero count are dropped
 * rather than shown as "0 beaches" — a resume should list what someone has
 * done, not what they have not.
 */
export function ResumeStatsGrid({ stats }: { stats: ResumeStats }) {
  const headline = [
    { label: 'Countries', value: stats.countries, icon: Globe2 },
    { label: 'States & regions', value: stats.regions, icon: MapIcon },
    { label: 'Trips', value: stats.trips, icon: Luggage },
    { label: 'Travel days', value: stats.travelDays, icon: Clock },
    {
      label: 'Years travelling',
      value: stats.yearsTravelling,
      icon: CalendarRange,
    },
    {
      label: 'Distance',
      value: formatDistance(stats.distanceKm),
      icon: Route,
      // Straight lines between recorded stops, not a GPS track.
      note: stats.distanceKm === null ? 'Needs pinned places' : 'Approximate',
    },
  ]

  const kinds = PLACE_KINDS.map((kind) => ({ kind, count: stats.places[kind] })).filter(
    (k) => k.count > 0
  )

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {headline.map(({ label, value, icon: Icon, note }) => (
          <li key={label}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </span>
                <span className="text-2xl leading-tight font-semibold tabular-nums">{value}</span>
                {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {kinds.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Places
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              {kinds.map(({ kind, count }) => (
                <li key={kind} className="min-w-24">
                  <p className="text-xl leading-tight font-semibold tabular-nums">{count}</p>
                  <p className="text-sm text-muted-foreground">{placeKindLabel(kind, count)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
