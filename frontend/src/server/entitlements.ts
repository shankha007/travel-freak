import 'server-only'

import { cache } from 'react'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import {
  bytesRemaining,
  decideChecklistQuota,
  decideCollaboratorQuota,
  decidePhotoQuota,
  decideStorageQuota,
  decideTripQuota,
  type MediaQuotaDecision,
  type QuotaDecision,
} from '@/shared/entitlement-rules'

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
 * Every create and upload path must call the relevant `check*` here **before**
 * doing any work. Client-side checks exist for UX only; this is the enforcement.
 *
 * Each function below is the same two steps: count what exists, then decide. The
 * counting is here because it needs a database; the deciding is in
 * `shared/entitlement-rules.ts` because it needed a test — the plan asks for
 * boundary coverage over every plan × resource, and that could not be written
 * while the arithmetic only existed inside a function that opens a connection.
 */

export interface PlanLimits {
  trips: number | null
  photos_per_trip: number | null
  videos_per_trip: number | null
  audios_per_trip: number | null
  storage_bytes: number | null
  globe_region_detail: boolean
  analytics_advanced: boolean
  itinerary_full: boolean
  budget_full: boolean
  /** Checklists per trip. null → unlimited. */
  checklists: number | null
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

  // One round trip, not two: `subscriptions.plan_code` is a foreign key into
  // `plans`, so PostgREST can embed the plan with the subscription that names it.
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_code, plans ( name, limits )')
    .maybeSingle()

  if (subscription) {
    return {
      planCode: subscription.plan_code,
      planName: subscription.plans?.name ?? 'Explorer',
      limits: (subscription.plans?.limits ?? {}) as PlanLimits,
    }
  }

  // Falling back to the free plan rather than throwing: a missing subscription
  // row should degrade to the most restrictive tier, never to unrestricted. This
  // costs the extra query the common path no longer pays.
  const { data: plan } = await supabase
    .from('plans')
    .select('name, limits')
    .eq('code', 'explorer')
    .maybeSingle()

  return {
    planCode: 'explorer',
    planName: plan?.name ?? 'Explorer',
    limits: (plan?.limits ?? {}) as PlanLimits,
  }
})

/**
 * The answer a quota gate gives.
 *
 * An alias rather than a second declaration: the shape is decided in
 * `shared/entitlement-rules.ts`, which is where the decision is made, and two
 * copies of it would be free to drift. Re-exported here because this file is the
 * only one features import from.
 */
export type QuotaCheck = QuotaDecision

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

  return decideTripQuota({ limit, used: count ?? 0, planName })
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
    bytesRemaining: bytesRemaining(storageLimit, storageUsed),
  }
}

export interface MediaQuotaCheck extends MediaQuotaDecision {
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

  return { ...decidePhotoQuota({ ...quota, bytes, planName }), quota }
}

/**
 * Whether `bytes` fit in what is left of the account's storage pool.
 *
 * The pool without the per-trip photo cap, for images that belong to no trip:
 * one placed inside a post costs storage like any other file, but "photos per
 * trip" is not a question a standalone post can answer. The pool is the limit the
 * plan actually charges for, so it is the one that has to hold.
 */
export async function checkStorageQuota(bytes: number): Promise<MediaQuotaCheck> {
  const supabase = await createClient()
  const user = await requireUser()
  const { limits, planName } = await getEntitlements()

  const { data } = await supabase
    .from('media')
    .select('bytes')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  const storageUsed = (data ?? []).reduce((sum, m) => sum + (m.bytes ?? 0), 0)
  const storageLimit = limits.storage_bytes ?? null

  const quota: MediaQuota = {
    // No trip, so no per-trip count to report. Null limit reads as "not
    // applicable" to the meter rather than as "unlimited photos".
    photosUsed: 0,
    photosLimit: null,
    storageUsed,
    storageLimit,
    bytesRemaining: bytesRemaining(storageLimit, storageUsed),
  }

  return { ...decideStorageQuota({ storageUsed, storageLimit, bytes, planName }), quota }
}

/** Convenience for read paths that only need the boolean. */
export async function canUseRegionDetail(): Promise<boolean> {
  const { limits } = await getEntitlements()
  return limits.globe_region_detail === true
}

/**
 * The deeper half of `/analytics` — the heatmap, the breakdowns, the budgets.
 *
 * The pricing table already sells "Advanced analytics" as a paid row, so this
 * is not a decision being made here; it is the same row, read from the same
 * column, so the two cannot come apart.
 */
export async function canUseAdvancedAnalytics(): Promise<boolean> {
  const { limits } = await getEntitlements()
  return limits.analytics_advanced === true
}

/**
 * The paid half of the itinerary builder — screen 21.
 *
 * The pricing table sells the free tier as "days, activities, notes" and the
 * paid one as "times, costs, bookings". So this gates four fields on an entry
 * rather than the screen: a free plan is a real plan, and walling off the
 * builder entirely would take away a tool people use before they pay for
 * anything.
 */
export async function canUseFullItinerary(): Promise<boolean> {
  const { limits } = await getEntitlements()
  return limits.itinerary_full === true
}

/**
 * The paid half of the budget planner — screen 22.
 *
 * Free gets the totals: planned, spent, what is left. Paid gets the category
 * breakdown and its chart. Recording an expense is free on every plan, because
 * a budget you cannot add to is not a budget.
 */
export async function canUseFullBudget(): Promise<boolean> {
  const { limits } = await getEntitlements()
  return limits.budget_full === true
}

/**
 * Whether another person may be invited to this trip — screen 24.
 *
 * `collaborators_per_trip` is 0 on the free plan, which the convention at the
 * top of this file reads as "not available" rather than as a limit of none —
 * and the pricing table already sells it that way, as a ✗ against Explorer.
 *
 * Counts pending and accepted rows together. An invitation that has been sent
 * and not yet answered is a seat taken: counting only acceptances would let
 * somebody on a three-seat plan send thirty invitations and find out which
 * limit was real when the fourth person clicked.
 *
 * A declined row costs nothing — it is kept only so the address cannot be
 * re-invited in a loop, and so the owner can see the answer.
 */
export async function checkCollaboratorQuota(tripId: string): Promise<QuotaCheck> {
  const supabase = await createClient()
  // Not for the id — the count below is scoped by trip — but because a quota
  // check reached without a session should redirect rather than answer.
  await requireUser()
  const { limits, planName } = await getEntitlements()

  const limit = limits.collaborators_per_trip ?? null

  // Scoped by trip alone, and correct because of who asks: only an owner
  // invites, and `collaborators_select` shows an owner every row on their own
  // trip. Filtering by `user_id` here would count the wrong thing — an
  // invitation by email has no user_id at all until it is accepted.
  const { count } = await supabase
    .from('trip_collaborators')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .is('declined_at', null)

  return decideCollaboratorQuota({ limit, used: count ?? 0, planName })
}

/**
 * Whether another checklist may be added to this trip — screen 23.
 *
 * `limits.checklists` is read as **per trip**, which is the reading the screen
 * it gates makes sense under: the packing screen belongs to one trip, and
 * "3 lists" spent across an account's fifteen trips would mean twelve trips
 * with nothing to pack into.
 *
 * Counted live, and filtered by `user_id` as well as `trip_id`, for the same
 * reason `checkTripQuota()` is: a quota gate should not depend on a
 * denormalisation, and it should not charge anyone for rows that are not theirs.
 */
export async function checkChecklistQuota(tripId: string): Promise<QuotaCheck> {
  const supabase = await createClient()
  const user = await requireUser()
  const { limits, planName } = await getEntitlements()

  const limit = limits.checklists ?? null
  const { count } = await supabase
    .from('checklists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('trip_id', tripId)

  return decideChecklistQuota({ limit, used: count ?? 0, planName })
}

export interface AccountUsage {
  planCode: string
  planName: string
  trips: { used: number; limit: number | null }
  storage: { used: number; limit: number | null }
}

/**
 * What the account has used of its plan, for the sidebar meter.
 *
 * A read, not a gate. Every `check*Quota` above answers "may this specific
 * write proceed" and is the enforcement; this answers "how much is left" and is
 * allowed to be approximate at the edges — it is rendered in chrome on every
 * authenticated page, so it must stay cheap.
 *
 * Two counts, chosen because they are the two limits somebody actually runs
 * into: trips, which walls off the create button, and storage, which is what
 * costs money. The per-trip photo cap is deliberately absent — it belongs to a
 * trip, and the sidebar does not know which one you are looking at.
 *
 * `count: 'exact', head: true` for trips so the rows never travel. Storage has
 * to sum a column PostgREST will not aggregate for us, so it reads `bytes`
 * alone — one small integer per photo, and the same read `checkStorageQuota`
 * already does.
 *
 * Cached per render pass: the sidebar renders once, but `getEntitlements()`
 * inside it is shared with whatever the page itself asked about the plan.
 */
export const getAccountUsage = cache(async (): Promise<AccountUsage> => {
  const supabase = await createClient()
  const user = await requireUser()
  const { limits, planCode, planName } = await getEntitlements()

  const [tripsResult, mediaResult] = await Promise.all([
    supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      // Load-bearing, for the reason `checkTripQuota` gives: `trips` has a
      // policy exposing every published public trip, so counting on RLS alone
      // would charge this account for strangers' holidays.
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase.from('media').select('bytes').eq('user_id', user.id).is('deleted_at', null),
  ])

  return {
    planCode,
    planName,
    trips: { used: tripsResult.count ?? 0, limit: limits.trips ?? null },
    storage: {
      used: (mediaResult.data ?? []).reduce((sum, m) => sum + (m.bytes ?? 0), 0),
      limit: limits.storage_bytes ?? null,
    },
  }
})
