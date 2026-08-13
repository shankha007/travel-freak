'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, MapPinned } from 'lucide-react'
import type { VaultPhoto, VaultPlace } from '@/server/queries/vault'
import type { MapMarker } from '@/client/components/map/map-view'
import {
  placePhotos,
  UNPLACED_REASON_LABEL,
  type UnplacedReason,
} from '@/shared/geo/photo-placement'
import type { LngLat } from '@/shared/geo/point'
import { Button } from '@/client/components/ui/button'
import { Skeleton } from '@/client/components/ui/skeleton'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'
import { cn } from '@/shared/utils'

/**
 * The vault's map view — screen 25's third tab.
 *
 * It draws two things: the trip's pinned stops, in the order they were visited,
 * and the photos, at the coordinates the camera recorded or — failing that — at
 * the stop whose dates contain them. `placePhotos` owns that policy; this file
 * owns what it looks like and what the reader can do with it.
 *
 * Photos taken at the same stop share one point exactly, so drawing one marker
 * each would stack twenty pins on one dot. They are grouped by point instead,
 * and selecting a group lists it under the map — which is also how the map's
 * contents stay reachable without a mouse.
 */

/** ~11 m. Close enough that two markers would overlap anyway. */
const GROUP_PRECISION = 4

interface PhotoGroup {
  key: string
  point: LngLat
  photos: VaultPhoto[]
  /** The stop these photos were placed at, when the date was all we had. */
  inferredAt: string | null
}

function groupKey(point: LngLat): string {
  return `${point.lng.toFixed(GROUP_PRECISION)},${point.lat.toFixed(GROUP_PRECISION)}`
}

export function VaultMap({
  photos,
  places,
  tripId,
  onSelectPhoto,
}: {
  photos: VaultPhoto[]
  places: VaultPlace[]
  tripId: string
  onSelectPhoto: (photo: VaultPhoto) => void
}) {
  const { Component: MapView, failed } = useLazyComponent(
    async () => (await import('@/client/components/map/map-view')).MapView
  )
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const pinnedPlaces = useMemo(() => places.filter((p) => p.point), [places])

  const { groups, unplaced } = useMemo(() => {
    const placements = placePhotos(
      photos.map((photo) => ({
        id: photo.id,
        point: photo.point,
        at: photo.takenAt ?? photo.createdAt,
      })),
      places.map((place) => ({
        id: place.id,
        point: place.point,
        arrivalDate: place.arrivalDate,
        departureDate: place.departureDate,
      }))
    )

    const byId = new Map(photos.map((photo) => [photo.id, photo]))
    const labelById = new Map(places.map((place) => [place.id, place.label]))
    const grouped = new Map<string, PhotoGroup>()
    const off: { photo: VaultPhoto; reason: UnplacedReason }[] = []

    for (const placement of placements) {
      const photo = byId.get(placement.photoId)
      if (!photo) continue

      if (!placement.point) {
        off.push({ photo, reason: placement.reason })
        continue
      }

      const key = groupKey(placement.point)
      const existing = grouped.get(key)
      const inferredAt =
        placement.source === 'stop' ? (labelById.get(placement.stopId) ?? null) : null

      if (existing) {
        existing.photos.push(photo)
        // A group is only inferred if every photo in it was: one measured
        // coordinate makes the point real.
        if (!inferredAt) existing.inferredAt = null
      } else {
        grouped.set(key, { key, point: placement.point, photos: [photo], inferredAt })
      }
    }

    return { groups: [...grouped.values()], unplaced: off }
  }, [photos, places])

  const markers = useMemo<MapMarker[]>(
    () => [
      ...pinnedPlaces.map((place, index) => ({
        id: `place:${place.id}`,
        point: place.point as LngLat,
        kind: 'stop' as const,
        title: place.label,
        detail: `Stop ${index + 1}`,
        label: String(index + 1),
      })),
      ...groups.map((group) => ({
        id: `photos:${group.key}`,
        point: group.point,
        kind: 'photo' as const,
        title:
          group.photos.length === 1
            ? group.photos[0].caption || 'Photo'
            : `${group.photos.length} photos`,
        detail: group.inferredAt ? `Placed by date, at ${group.inferredAt}` : undefined,
        thumbnailUrl: group.photos[0].url,
        inferred: Boolean(group.inferredAt),
      })),
    ],
    [groups, pinnedPlaces]
  )

  const route = useMemo(() => pinnedPlaces.map((p) => p.point as LngLat), [pinnedPlaces])
  const fitTo = useMemo(() => markers.map((m) => m.point), [markers])

  const open = groups.find((g) => `photos:${g.key}` === selectedGroup) ?? null
  const placedCount = groups.reduce((total, group) => total + group.photos.length, 0)
  const inferredCount = groups
    .filter((g) => g.inferredAt)
    .reduce((total, group) => total + group.photos.length, 0)

  // Nothing to draw is not an error and not a placeholder: it is a trip whose
  // places were recorded by name, which the wizard allows on purpose.
  if (markers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <MapPinned className="size-6 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">There is nothing to plot yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {places.length === 0
              ? 'This trip has no places yet. Add them and drop a pin on each, and your photos will find their way here.'
              : 'None of this trip’s places carry a pin, and none of these photos carry GPS. Pin a place and the map fills in.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${tripId}/edit`} />}
        >
          Edit places
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative h-[26rem] overflow-hidden rounded-xl border">
        {MapView ? (
          <MapView
            // The map is a canvas of this trip, not of the world's fills — the
            // countries stay unpainted so the markers are the only colour.
            regions={[]}
            admin1Countries={[]}
            visibleStates={[]}
            onSelectCountry={() => {}}
            markers={markers}
            onSelectMarker={(id) =>
              setSelectedGroup((current) =>
                id.startsWith('photos:') ? (current === id ? null : id) : null
              )
            }
            route={route}
            fitTo={fitTo}
            className="absolute inset-0"
          />
        ) : failed ? (
          <p className="absolute inset-0 m-auto flex max-w-xs items-center justify-center px-6 text-center text-sm text-muted-foreground">
            The map could not load. Your photos are still listed below.
          </p>
        ) : (
          <Skeleton className="absolute inset-0" />
        )}
      </div>

      {/* The map's own legend, in words. A dashed marker means a guess, and that
          has to be readable rather than inferred from the border style. */}
      <p className="text-xs text-muted-foreground">
        {placedCount === 0
          ? 'No photos are on the map yet — the numbered pins are this trip’s stops.'
          : `${placedCount} of ${photos.length} ${photos.length === 1 ? 'photo is' : 'photos are'} on the map.`}
        {inferredCount > 0 &&
          ` ${inferredCount} of them ${inferredCount === 1 ? 'has' : 'have'} no GPS and ${inferredCount === 1 ? 'is' : 'are'} drawn dashed, at the stop whose dates they fall in.`}
      </p>

      {/* Selecting a marker lists it here. Photos at one stop share a point
          exactly, so the map can only ever show the top of the pile — this is
          the rest of it, and the only way to reach it from a keyboard. */}
      {open && (
        <section className="space-y-2 rounded-lg border p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Camera className="size-4" aria-hidden />
            {open.photos.length} {open.photos.length === 1 ? 'photo' : 'photos'} here
            {open.inferredAt && (
              <span className="font-normal text-muted-foreground">
                · {open.inferredAt}, by date
              </span>
            )}
          </h3>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {open.photos.map((photo) => (
              <li key={photo.id}>
                <PhotoButton photo={photo} onSelect={() => onSelectPhoto(photo)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {unplaced.length > 0 && (
        <section className="space-y-2 rounded-lg border border-dashed p-3">
          <h3 className="text-sm font-medium">
            {unplaced.length} {unplaced.length === 1 ? 'photo is' : 'photos are'} not on the map
          </h3>
          <p className="text-xs text-muted-foreground">
            Nothing here says where these were taken. Pinning the place they belong to, or setting
            the stop’s dates, brings them in.
          </p>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {unplaced.map(({ photo, reason }) => (
              <li key={photo.id} className="space-y-1">
                <PhotoButton photo={photo} onSelect={() => onSelectPhoto(photo)} />
                <p className="text-[0.6875rem] leading-tight text-muted-foreground">
                  {UNPLACED_REASON_LABEL[reason]}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PhotoButton({ photo, onSelect }: { photo: VaultPhoto; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative block aspect-square w-full overflow-hidden rounded-md bg-muted',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
      )}
    >
      {photo.url && (
        <Image
          src={photo.url}
          alt={photo.altText || photo.caption || 'Trip photo'}
          fill
          sizes="120px"
          className="object-cover transition-transform group-hover:scale-105"
        />
      )}
    </button>
  )
}
