'use client'

import { useMemo, useState } from 'react'
import { MapPinned } from 'lucide-react'
import type { ItineraryDay } from '@/server/queries/itinerary'
import type { MapMarker } from '@/client/components/map/map-view'
import { dayLabel, formatTimeRange } from '@/shared/itinerary'
import type { LngLat } from '@/shared/geo/point'
import { Skeleton } from '@/client/components/ui/skeleton'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'

/**
 * The map beside the days — the other half of screen 21.
 *
 * It draws the entries that carry a pin, numbered in the order they happen, and
 * joins them in that order. That line is the point of the map: a plan reads as
 * a list, and the thing a list cannot show is that Tuesday afternoon is an hour
 * back the way you came.
 *
 * **The numbering runs across days, not within them.** Stop 7 is the seventh
 * thing you do on the trip, which is what somebody comparing the map to the
 * list is counting. Numbering per day would put three markers labelled "1" on
 * one screen.
 *
 * Entries with no pin are not an error and not a gap — most of an itinerary is
 * written before anybody knows exactly where. The count below the map says how
 * many are on it rather than leaving the reader to wonder what is missing.
 *
 * Lazy, like every other map in this app: MapLibre is far too large to sit in
 * the bundle of a screen that is mostly a list.
 */
export function ItineraryMap({ days }: { days: ItineraryDay[] }) {
  const { Component: MapView, failed } = useLazyComponent(
    async () => (await import('@/client/components/map/map-view')).MapView
  )
  const [selected, setSelected] = useState<string | null>(null)

  // Flattened in the order the days are already sorted in, so the numbers match
  // the list beside it exactly.
  const pinned = useMemo(
    () =>
      days.flatMap((day, dayIndex) =>
        day.items
          .filter((item) => item.point !== null)
          .map((item) => ({ item, point: item.point as LngLat, day, dayIndex }))
      ),
    [days]
  )

  const totalItems = useMemo(() => days.reduce((count, day) => count + day.items.length, 0), [days])

  const markers = useMemo<MapMarker[]>(
    () =>
      pinned.map(({ item, point, day, dayIndex }, index) => {
        const time = formatTimeRange(item.timeStart, item.timeEnd)
        return {
          id: item.id,
          point,
          kind: 'stop' as const,
          title: item.title,
          detail: [dayLabel(day.title, dayIndex), time].filter(Boolean).join(' · '),
          label: String(index + 1),
        }
      }),
    [pinned]
  )

  const route = useMemo(() => pinned.map((p) => p.point), [pinned])
  const fitTo = route

  const open = pinned.find(({ item }) => item.id === selected) ?? null

  if (markers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
        <MapPinned className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Nothing pinned yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {totalItems === 0
            ? 'Add something to a day, and drop a pin on it, and it appears here.'
            : 'None of this plan carries a pin. Open an entry and set where it is — the map draws them in the order they happen.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative h-[22rem] overflow-hidden rounded-xl border">
        {MapView ? (
          <MapView
            // A canvas of this trip: the country fills stay unpainted so the
            // numbered stops are the only colour on it.
            regions={[]}
            admin1Countries={[]}
            visibleStates={[]}
            onSelectCountry={() => {}}
            markers={markers}
            onSelectMarker={(id) => setSelected((current) => (current === id ? null : id))}
            route={route}
            fitTo={fitTo}
            className="absolute inset-0"
          />
        ) : failed ? (
          <p className="absolute inset-0 m-auto flex max-w-xs items-center justify-center px-6 text-center text-sm text-muted-foreground">
            The map could not load. Your plan is still listed beside it.
          </p>
        ) : (
          <Skeleton className="absolute inset-0" />
        )}
      </div>

      {/* Selecting a marker names it here — which is also how the map's
          contents are reachable without a mouse. */}
      {open && (
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">{open.item.title}</p>
          <p className="text-xs text-muted-foreground">
            {dayLabel(open.day.title, open.dayIndex)}
            {formatTimeRange(open.item.timeStart, open.item.timeEnd) &&
              ` · ${formatTimeRange(open.item.timeStart, open.item.timeEnd)}`}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {markers.length} of {totalItems} {totalItems === 1 ? 'entry is' : 'entries are'} pinned,
        numbered and joined in the order they happen.
      </p>
    </div>
  )
}
