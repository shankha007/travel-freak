import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { getMediaQuota, type MediaQuota } from '@/server/entitlements'
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
  hasLocation: boolean
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

  const [photoRows, memoryRows, quota] = await Promise.all([
    supabase
      .from('media')
      .select(
        'id, storage_path, caption, alt_text, bytes, width, height, taken_at, created_at, is_featured, exif_lat, exif_lng'
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
    getMediaQuota(tripId),
  ])

  const rows = photoRows.data ?? []
  const signed = rows.length
    ? await supabase.storage.from('media').createSignedUrls(
        rows.map((r) => r.storage_path),
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
      url: urlByPath.get(r.storage_path) ?? null,
      caption: r.caption,
      altText: r.alt_text,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      takenAt: r.taken_at,
      createdAt: r.created_at,
      isFeatured: r.is_featured,
      // The coordinates themselves stay on the server: the vault only needs to
      // know whether a photo could be placed on a map later.
      hasLocation: r.exif_lat !== null && r.exif_lng !== null,
    })),
    memories: (memoryRows.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      happenedAt: m.happened_at,
      createdAt: m.created_at,
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
    .select('storage_path')
    .eq('id', mediaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null

  const { data: signed } = await supabase.storage
    .from('media')
    .createSignedUrl(data.storage_path, SIGNED_URL_TTL_S)

  return signed?.signedUrl ?? null
}

/** Signed URLs for many ids at once, keyed by id. */
export async function getMediaUrls(mediaIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter(Boolean))]
  if (!ids.length) return new Map()

  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('media')
    .select('id, storage_path')
    .in('id', ids)
    .is('deleted_at', null)

  if (!rows?.length) return new Map()

  const { data: signed } = await supabase.storage.from('media').createSignedUrls(
    rows.map((r) => r.storage_path),
    SIGNED_URL_TTL_S
  )

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  return new Map(
    rows
      .map((r) => [r.id, urlByPath.get(r.storage_path)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  )
}
