'use client'

import { useMemo, useState } from 'react'
import { MapPinned } from 'lucide-react'
import type { MapMarker } from '@/client/components/map/map-view'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import type { LngLat } from '@/shared/geo/point'
import { Skeleton } from '@/client/components/ui/skeleton'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'

/**
 * A trip's stops on a map, in visit order — the route timeline, drawn.
 *
 * The trip page and the public trip page both list the stops as a timeline, and
 * a timeline is exactly the thing that cannot show that the third stop is back
 * past the first. `MapView` already takes markers, a route line and a set of
 * points to frame itself to — the vault's map tab is built on those same three
 * props — so this is the trip's own places poured into them.
 *
 * **A stop's pin is not a photo's GPS.** Publication strips EXIF from every
 * photograph, and that stays true; what is drawn here is the place the owner
 * chose from a picker and typed a city name next to, on a trip they chose to
 * publish. The two are different facts about a trip and the product treats them
 * differently on purpose.
 *
 * Lazy, like every map in this app: MapLibre has no business in the bundle of a
 * page that is mostly prose.
 */

/** The least a stop has to be for this to draw it. */
export interface RouteStop {
  id: string
  countryCode: string
  cityName: string | null
  arrivalDate: string | null
  departureDate: string | null
  /** Null for a place recorded by name alone, which is most of them at first. */
  lat: number | null
  lng: number | null
}

/**
 * A stop's second line: its dates when it has any, else its country.
 *
 * Not `formatDateRange` alone — that answers "Dates not set" for an undated
 * stop, which is true of most stops on a trip that was recorded afterwards and
 * is not worth a marker tooltip saying so.
 */
function stopDetail(stop: RouteStop): string {
  return stop.arrivalDate || stop.departureDate
    ? formatDateRange(stop.arrivalDate, stop.departureDate)
    : countryName(stop.countryCode)
}

export function TripRouteMap({ stops, className }: { stops: RouteStop[]; className?: string }) {
  const { Component: MapView, failed } = useLazyComponent(
    async () => (await import('@/client/components/map/map-view')).MapView
  )
  const [selected, setSelected] = useState<string | null>(null)

  // Numbered over the pinned stops rather than over all of them: the marker
  // labelled 2 has to be the second marker, or the map contradicts itself. The
  // note under it is what accounts for the stops that are missing.
  const pinned = useMemo(
    () =>
      stops
        .filter((stop) => stop.lat !== null && stop.lng !== null)
        .map((stop) => ({ stop, point: { lng: stop.lng as number, lat: stop.lat as number } })),
    [stops]
  )

  const markers = useMemo<MapMarker[]>(
    () =>
      pinned.map(({ stop, point }, index) => ({
        id: stop.id,
        point,
        kind: 'stop' as const,
        title: stop.cityName || countryName(stop.countryCode),
        detail: stopDetail(stop),
        label: String(index + 1),
      })),
    [pinned]
  )

  const route = useMemo(() => pinned.map((p) => p.point) as LngLat[], [pinned])

  const open = pinned.find(({ stop }) => stop.id === selected) ?? null

  // One pinned stop is a dot, not a route — but it is still where the trip was,
  // and drawing it is better than an empty state that says "nothing to show".
  // Nothing pinned at all renders nothing: the timeline beside this already
  // explains that case, and two notices saying the same thing is one too many.
  if (markers.length === 0) return null

  return (
    <div className={className}>
      <div className="relative h-64 overflow-hidden rounded-xl border">
        {MapView ? (
          <MapView
            // A canvas of this trip: the country fills stay unpainted, so the
            // numbered stops are the only colour on it.
            regions={[]}
            admin1Countries={[]}
            visibleStates={[]}
            onSelectCountry={() => {}}
            markers={markers}
            onSelectMarker={(id) => setSelected((current) => (current === id ? null : id))}
            route={route}
            fitTo={route}
            className="absolute inset-0"
          />
        ) : failed ? (
          <p className="absolute inset-0 m-auto flex max-w-xs items-center justify-center px-6 text-center text-sm text-muted-foreground">
            The map could not load. The stops are listed below it.
          </p>
        ) : (
          <Skeleton className="absolute inset-0" />
        )}
      </div>

      {/* Selecting a marker names it here — which is also the only way the map's
          contents are reachable without a mouse. */}
      {open && (
        <div className="mt-3 rounded-lg border p-3">
          <p className="text-sm font-medium">
            <span aria-hidden className="mr-1.5">
              {countryFlag(open.stop.countryCode)}
            </span>
            {open.stop.cityName || countryName(open.stop.countryCode)}
          </p>
          <p className="text-xs text-muted-foreground">{stopDetail(open.stop)}</p>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPinned className="size-3.5 shrink-0" aria-hidden />
        {/* Three cases, because two of them were one sentence that read badly:
            a single pinned stop is a dot with nothing to join, so it must not
            claim a visit order, and "All 1 stop" is not a sentence. */}
        {pinned.length < 2
          ? `${pinned.length} of ${stops.length} ${stops.length === 1 ? 'stop carries' : 'stops carry'} a pin — enough to place this trip, not to draw a route through it.`
          : pinned.length === stops.length
            ? `All ${stops.length} stops pinned, joined in visit order.`
            : `${pinned.length} of ${stops.length} stops carry a pin. The line joins the ones that do — the legs it cannot see are real.`}
      </p>
    </div>
  )
}
