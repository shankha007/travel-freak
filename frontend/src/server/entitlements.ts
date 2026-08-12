import 'server-only'

import { cache } from 'react'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'

/**
 * Plan limits and quota checks — the single source of truth for entitlement.
 *
 * Everything comes from `plans.limits` in the database, which the pricing page
 * also reads. The two cannot disagree because there is only one copy.
 *
 * Convention inside `limits`, set by the plans migration:
 *   null → unlimited
 *   0    → not available on this plan
 *
 * Every create and upload path must call the relevant `assert*` here **before**
 * doing any work. Client-side checks exist for UX only; this is the enforcement.
 */

export interface PlanLimits {
  trips: number | null
  photos_per_trip: number | null
  videos_per_trip: number | null
  audios_per_trip: number | null
  storage_bytes: number | null
  globe_region_detail: boolean
  planned_trips: number | null
  collaborators_per_trip: number | null
  albums: boolean
  ai_generations_per_month: number | null
  [key: string]: unknown
}

export interface Entitlements {
  planCode: string
  planName: string
  limits: PlanLimits
}

/** The signed-in user's plan and its limits. Deduped per render pass. */
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .maybeSingle()

  // Falling back to the free plan rather than throwing: a missing subscription
  // row should degrade to the most restrictive tier, never to unrestricted.
  const planCode = subscription?.plan_code ?? 'explorer'

  const { data: plan } = await supabase
    .from('plans')
    .select('code, name, limits')
    .eq('code', planCode)
    .maybeSingle()

  return {
    planCode,
    planName: plan?.name ?? 'Explorer',
    limits: (plan?.limits ?? {}) as PlanLimits,
  }
})

export interface QuotaCheck {
  allowed: boolean
  /** Current usage against the limit, for the meter and the upgrade copy. */
  used: number
  limit: number | null
  /** User-facing explanation when `allowed` is false. */
  reason?: string
}

/**
 * Whether the user may create another trip.
 *
 * Counts live rather than trusting `usage_counters.trips_count`: the counter is
 * maintained by a trigger and is right in practice, but a quota gate should not
 * depend on a denormalisation being in sync.
 *
 * The `user_id` filter is load-bearing, not decoration: `trips` has a policy
 * exposing every published public trip, so counting on RLS alone would charge a
 * new user for strangers' holidays and could wall them off before their first
 * trip.
 */
export async function checkTripQuota(): Promise<QuotaCheck> {
  const supabase = await createClient()
  const user = await requireUser()
  const { limits, planName } = await getEntitlements()

  const limit = limits.trips ?? null
  const { count } = await supabase
    .from('trips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null)

  const used = count ?? 0

  if (limit === null) return { allowed: true, used, limit }

  return {
    allowed: used < limit,
    used,
    limit,
    reason:
      used < limit
        ? undefined
        : `${planName} includes ${limit} trips and you have ${used}. Upgrade to add more — nothing you have recorded is affected.`,
  }
}

export interface MediaQuota {
  /** Photos already stored on this trip. */
  photosUsed: number
  photosLimit: number | null
  /** Bytes stored across the whole account — the real cost backstop. */
  storageUsed: number
  storageLimit: number | null
  /** Largest single upload the remaining pool can take. */
  bytesRemaining: number | null
}

/**
 * The trip's photo count and the account's storage pool, in one read.
 *
 * Counted live from `media` rather than from `trips.photo_count` and
 * `usage_counters.storage_bytes`: both are trigger-maintained and correct in
 * practice, but a quota gate should not depend on a denormalisation being in
 * sync. The counters stay useful for display.
 */
export async function getMediaQuota(tripId: string): Promise<MediaQuota> {
  const supabase = await createClient()
  const user = await requireUser()
  const { limits } = await getEntitlements()

  const [tripPhotos, stored] = await Promise.all([
    supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('trip_id', tripId)
      .eq('kind', 'image')
      .is('deleted_at', null),
    supabase.from('media').select('bytes').eq('user_id', user.id).is('deleted_at', null),
  ])

  const photosUsed = tripPhotos.count ?? 0
  const storageUsed = (stored.data ?? []).reduce((sum, m) => sum + (m.bytes ?? 0), 0)
  const storageLimit = limits.storage_bytes ?? null

  return {
    photosUsed,
    photosLimit: limits.photos_per_trip ?? null,
    storageUsed,
    storageLimit,
    bytesRemaining: storageLimit === null ? null : Math.max(0, storageLimit - storageUsed),
  }
}

export interface MediaQuotaCheck extends QuotaCheck {
  quota: MediaQuota
}

/**
 * Whether one more photo of `bytes` may be stored on this trip.
 *
 * Runs **before** a signed upload URL is issued, per the plan's rule that
 * client-side checks are UX and this is the enforcement. Both limits are
 * reported so the caller can say which one was hit — "5 of 5 photos" and "1 GB
 * full" call for different copy and a different upgrade prompt.
 */
export async function checkPhotoQuota(tripId: string, bytes: number): Promise<MediaQuotaCheck> {
  const { planName } = await getEntitlements()
  const quota = await getMediaQuota(tripId)

  if (quota.photosLimit !== null && quota.photosUsed >= quota.photosLimit) {
    return {
      allowed: false,
      used: quota.photosUsed,
      limit: quota.photosLimit,
      quota,
      reason: `${planName} includes ${quota.photosLimit} photos per trip and this trip has ${quota.photosUsed}. Upgrade to add more — nothing you have uploaded is affected.`,
    }
  }

  if (quota.bytesRemaining !== null && bytes > quota.bytesRemaining) {
    return {
      allowed: false,
      used: quota.storageUsed,
      limit: quota.storageLimit,
      quota,
      reason: `That photo does not fit in what is left of your ${planName} storage. Free some space or upgrade — nothing is deleted either way.`,
    }
  }

  return { allowed: true, used: quota.photosUsed, limit: quota.photosLimit, quota }
}

/** Convenience for read paths that only need the boolean. */
export async function canUseRegionDetail(): Promise<boolean> {
  const { limits } = await getEntitlements()
  return limits.globe_region_detail === true
}
