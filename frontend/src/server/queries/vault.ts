import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { getMediaQuota, type MediaQuota } from '@/server/entitlements'
import { displayKeysFor } from '@/server/media/display'
import { countryName } from '@/shared/geo/countries'
import { pointFrom, type LngLat } from '@/shared/geo/point'
import type { Database } from '@/shared/types/database'

/**
 * Memory Vault data — screen 25.
 *
 * The `media` bucket is private, so nothing here can hand out a plain URL. Each
 * photo gets a short-lived signed link, minted per request. That is also what
 * keeps a shared screenshot of a URL from being a permanent public link to
 * someone's holiday.
 */

type MemoryKind = Database['public']['Enums']['memory_kind']

/** An hour: long enough to browse a gallery, short enough to be worthless later. */
const SIGNED_URL_TTL_S = 60 * 60

export interface VaultPhoto {
  id: string
  url: string | null
  caption: string
  altText: string
  bytes: number
  width: number | null
  height: number | null
  takenAt: string | null
  createdAt: string
  isFeatured: boolean
  /**
   * Where the camera says the photo was taken, when it recorded that.
   *
   * The vault is the owner's own screen, so this is the one place the
   * coordinates cross to the client — the public pages publish EXIF-stripped
   * derivatives and never see it.
   */
  point: LngLat | null
}

/** A stop on the trip, as the vault's map needs it. */
export interface VaultPlace {
  id: string
  /** City if there is one, otherwise the country's name. */
  label: string
  countryCode: string
  /** The pin, when the place was given one. */
  point: LngLat | null
  arrivalDate: string | null
  departureDate: string | null
  orderIndex: number
}

export interface VaultMemory {
  id: string
  kind: MemoryKind
  body: string
  happenedAt: string | null
  createdAt: string
}

export interface VaultData {
  tripId: string
  tripTitle: string
  photos: VaultPhoto[]
  memories: VaultMemory[]
  places: VaultPlace[]
  quota: MediaQuota
}

/** Everything the vault renders, or null when the trip is not the caller's. */
export async function getVaultData(tripId: string): Promise<VaultData | null> {
  const supabase = await createClient()
  const user = await requireUser()

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) {
    return null
  }

  // Ownership, not readability: the vault is where you edit, so a public trip
  // belonging to someone else must not open here.
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return null

  const [photoRows, memoryRows, placeRows, quota] = await Promise.all([
    supabase
      .from('media')
      .select(
        'id, storage_path, mime, caption, alt_text, bytes, width, height, taken_at, created_at, is_featured, exif_lat, exif_lng'
      )
      .eq('user_id', user.id)
      .eq('trip_id', tripId)
      .eq('kind', 'image')
      .is('deleted_at', null)
      .order('taken_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('memories')
      .select('id, kind, body, happened_at, created_at')
      .eq('user_id', user.id)
      .eq('trip_id', tripId)
      .order('happened_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('trip_places')
      .select(
        'id, city_name, country_code, arrival_date, departure_date, order_index, latitude, longitude'
      )
      .eq('trip_id', tripId)
      .order('order_index', { ascending: true }),
    getMediaQuota(tripId),
  ])

  const rows = photoRows.data ?? []

  // What to sign, which is the original for everything but a HEIC — those get a
  // private WebP copy so the owner's own gallery is not a wall of empty frames
  // in every browser but Safari. Nothing else about the row changes: the bytes,
  // the dimensions and the EXIF all still describe the original.
  const displayKeys = await displayKeysFor(
    rows.map((r) => ({ storagePath: r.storage_path, mime: r.mime }))
  )

  const signed = rows.length
    ? await supabase.storage.from('media').createSignedUrls(
        rows.map((r) => displayKeys.get(r.storage_path) ?? r.storage_path),
        SIGNED_URL_TTL_S
      )
    : { data: [] }

  const urlByPath = new Map(
    (signed.data ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl as string])
  )

  return {
    tripId: trip.id,
    tripTitle: trip.title,
    photos: rows.map((r) => ({
      id: r.id,
      url: urlByPath.get(displayKeys.get(r.storage_path) ?? r.storage_path) ?? null,
      caption: r.caption,
      altText: r.alt_text,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      takenAt: r.taken_at,
      createdAt: r.created_at,
      isFeatured: r.is_featured,
      point: pointFrom(r.exif_lat, r.exif_lng),
    })),
    memories: (memoryRows.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      happenedAt: m.happened_at,
      createdAt: m.created_at,
    })),
    places: (placeRows.data ?? []).map((p) => ({
      id: p.id,
      label: p.city_name || countryName(p.country_code),
      countryCode: p.country_code,
      point: pointFrom(p.latitude, p.longitude),
      arrivalDate: p.arrival_date,
      departureDate: p.departure_date,
      orderIndex: p.order_index,
    })),
    quota,
  }
}

/**
 * A signed URL for one media id, for callers outside the vault.
 *
 * Used by the globe's region modal and the trip page. Returns null rather than
 * throwing when the media row is gone or is not the caller's to see — a missing
 * hero photo is a layout case, not an error.
 */
export async function getMediaUrl(mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null

  const supabase = await createClient()

  const { data } = await supabase
    .from('media')
    .select('storage_path, mime')
    .eq('id', mediaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null

  const keys = await displayKeysFor([{ storagePath: data.storage_path, mime: data.mime }])

  const { data: signed } = await supabase.storage
    .from('media')
    .createSignedUrl(keys.get(data.storage_path) ?? data.storage_path, SIGNED_URL_TTL_S)

  return signed?.signedUrl ?? null
}

/** Signed URLs for many ids at once, keyed by id. */
export async function getMediaUrls(mediaIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter(Boolean))]
  if (!ids.length) return new Map()

  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('media')
    .select('id, storage_path, mime')
    .in('id', ids)
    .is('deleted_at', null)

  if (!rows?.length) return new Map()

  const keys = await displayKeysFor(
    rows.map((r) => ({ storagePath: r.storage_path, mime: r.mime }))
  )
  const keyOf = (path: string) => keys.get(path) ?? path

  const { data: signed } = await supabase.storage.from('media').createSignedUrls(
    rows.map((r) => keyOf(r.storage_path)),
    SIGNED_URL_TTL_S
  )

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  return new Map(
    rows
      .map((r) => [r.id, urlByPath.get(keyOf(r.storage_path))] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  )
}
