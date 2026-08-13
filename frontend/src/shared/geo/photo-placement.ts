import { type LngLat } from '@/shared/geo/point'

/**
 * Where each of a trip's photos belongs on the vault's map.
 *
 * Two sources of truth, and they are not equally good:
 *
 *  - The camera's own GPS, read from EXIF at upload. That is where the photo was
 *    taken, full stop.
 *  - The trip's pinned places. A photo with no GPS still has a date, and a place
 *    with a pin still has an arrival and departure — so a photo taken between
 *    them was, as far as anything here knows, at that place.
 *
 * The second is a guess, and the map says so rather than quietly drawing it as
 * fact. A photo that matches neither is not plotted at all; it is listed under
 * the map with the reason, because silently dropping a third of someone's
 * photos is how a map starts lying about a trip.
 */

export interface PlaceablePhoto {
  id: string
  /** EXIF coordinates, when the camera recorded them. */
  point: LngLat | null
  /** When the shutter fired, or when it was uploaded. ISO 8601. */
  at: string | null
}

export interface PlaceableStop {
  id: string
  /** The pin, when the place has one. */
  point: LngLat | null
  /** Inclusive date range, `YYYY-MM-DD`. Either end may be missing. */
  arrivalDate: string | null
  departureDate: string | null
}

/** Why a photo could not be drawn. Rendered as words, never as a missing dot. */
export type UnplacedReason = 'no-gps-no-date' | 'no-place-for-date'

export type PhotoPlacement =
  | { photoId: string; point: LngLat; source: 'exif' }
  | { photoId: string; point: LngLat; source: 'stop'; stopId: string }
  | { photoId: string; point: null; source: 'none'; reason: UnplacedReason }

/** The day part of a timestamp, which is the granularity a stop's dates have. */
function day(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

/**
 * The stop a date falls within.
 *
 * Only pinned stops are candidates: an unpinned one has nowhere to put the
 * photo, and matching it would turn "we know the day" into a dot at 0°N 0°E.
 * Ties go to the earlier stop in the trip's order, which is the order the caller
 * passes them in — two stops sharing a changeover day means the photo is drawn
 * at the one being left, not the one being arrived at, and the map admits either
 * way that it inferred this.
 */
function stopFor(photoDay: string, stops: PlaceableStop[]): PlaceableStop | null {
  return (
    stops.find((stop) => {
      if (!stop.point) return false
      const from = stop.arrivalDate
      const to = stop.departureDate ?? stop.arrivalDate
      if (!from || !to) return false
      return photoDay >= from && photoDay <= to
    }) ?? null
  )
}

/**
 * Resolves every photo to a point or to a stated reason it has none.
 *
 * Pure, and order-preserving: the caller decides what to draw and what to list,
 * and the tests can state the whole policy without a map.
 */
export function placePhotos(photos: PlaceablePhoto[], stops: PlaceableStop[]): PhotoPlacement[] {
  return photos.map((photo) => {
    if (photo.point) return { photoId: photo.id, point: photo.point, source: 'exif' as const }

    const photoDay = day(photo.at)
    if (!photoDay) {
      return { photoId: photo.id, point: null, source: 'none' as const, reason: 'no-gps-no-date' }
    }

    const stop = stopFor(photoDay, stops)
    if (!stop?.point) {
      return {
        photoId: photo.id,
        point: null,
        source: 'none' as const,
        reason: 'no-place-for-date',
      }
    }

    return { photoId: photo.id, point: stop.point, source: 'stop' as const, stopId: stop.id }
  })
}

/** Human-readable explanation for a photo that stayed off the map. */
export const UNPLACED_REASON_LABEL: Record<UnplacedReason, string> = {
  'no-gps-no-date': 'No location and no date',
  'no-place-for-date': 'No pinned place on that date',
}
