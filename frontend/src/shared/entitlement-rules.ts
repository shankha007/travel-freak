/**
 * The decisions `server/entitlements.ts` makes, with the database taken out.
 *
 * Split out for one reason: the plan asks for unit tests over every plan × every
 * resource, at the boundary — the fifth photo allowed and the sixth refused, the
 * fifteenth trip allowed and the sixteenth refused — and none of that could be
 * written while each rule was interleaved with the Supabase read that counts for
 * it. The reads stay there; the arithmetic and the sentences live here.
 *
 * `server/entitlements.ts` remains the only entry point any feature calls. This
 * file is deliberately not imported anywhere else: a screen that wanted to decide
 * an entitlement for itself would be a second source of truth, which is the exact
 * thing that file exists to prevent.
 *
 * ## The `limits` convention, restated because everything here depends on it
 *
 *   `null` → unlimited
 *   `0`    → not available on this plan
 *
 * Those two are not degrees of the same thing, and conflating them is the bug
 * this convention exists to make impossible: `collaborators_per_trip` is 0 on
 * Explorer, and reading that as "a limit of none" would produce "you have used 0
 * of 0 collaborators — upgrade to add more", where the truth is that planning
 * together is not part of that plan at all.
 */

/** A plan limit. See the convention above — both special cases are meaningful. */
export type Limit = number | null

export function isUnlimited(limit: Limit): boolean {
  return limit === null
}

export function isUnavailable(limit: Limit): boolean {
  return limit === 0
}

export interface QuotaDecision {
  allowed: boolean
  /** Current usage against the limit, for the meter and the upgrade copy. */
  used: number
  limit: Limit
  /** User-facing explanation when `allowed` is false. */
  reason?: string
}

export interface CountQuotaInput {
  limit: Limit
  used: number
  /** Named in the copy, so the sentence says "Explorer" rather than "your plan". */
  planName: string
}

/**
 * Whether the user may create another trip.
 *
 * Note the comparison is `used < limit` rather than `used <= limit`: `used` is
 * what exists now, so on a limit of fifteen the fifteenth trip is created while
 * fourteen exist and the sixteenth is refused while fifteen do.
 *
 * **Over quota is refused, never corrected.** A downgrade from unlimited to
 * fifteen leaves an account with more trips than the plan allows, and this says
 * no to the next one while touching nothing that exists — the copy says so
 * explicitly, because the fear at that moment is that something will be deleted.
 */
export function decideTripQuota({ limit, used, planName }: CountQuotaInput): QuotaDecision {
  if (isUnlimited(limit)) return { allowed: true, used, limit }

  const allowed = used < (limit as number)
  return {
    allowed,
    used,
    limit,
    reason: allowed
      ? undefined
      : `${planName} includes ${limit} trips and you have ${used}. Upgrade to add more — nothing you have recorded is affected.`,
  }
}

/**
 * Whether another checklist may be added to a trip — screen 23.
 *
 * `limits.checklists` is read **per trip**, which is the only reading the screen
 * it gates makes sense under: three lists spread across fifteen trips would mean
 * twelve trips with nothing to pack into.
 */
export function decideChecklistQuota({ limit, used, planName }: CountQuotaInput): QuotaDecision {
  if (isUnlimited(limit)) return { allowed: true, used, limit }

  const allowed = used < (limit as number)
  return {
    allowed,
    used,
    limit,
    reason: allowed
      ? undefined
      : `${planName} includes ${limit} ${limit === 1 ? 'list' : 'lists'} per trip and this trip has ${used}. Upgrade for as many as you like — nothing you have written is affected.`,
  }
}

/**
 * Whether another person may be invited to a trip — screen 24.
 *
 * The one rule where 0 gets its own sentence rather than falling through the
 * arithmetic, because the arithmetic would produce a limit message for a feature
 * the plan does not have. The pricing table sells it as a ✗ against Explorer, and
 * this says the same thing in words.
 */
export function decideCollaboratorQuota({ limit, used, planName }: CountQuotaInput): QuotaDecision {
  if (isUnlimited(limit)) return { allowed: true, used, limit }

  if (isUnavailable(limit)) {
    return {
      allowed: false,
      used,
      limit,
      reason: `Planning together comes with the paid plans. On ${planName} a trip is yours alone — everything you have recorded stays exactly as it is.`,
    }
  }

  const allowed = used < (limit as number)
  return {
    allowed,
    used,
    limit,
    reason: allowed
      ? undefined
      : `${planName} includes ${limit} ${
          limit === 1 ? 'collaborator' : 'collaborators'
        } per trip and this trip has ${used}. Upgrade to add more — nobody already on it is affected.`,
  }
}

/** What is left of the storage pool. Null when the pool is unlimited. */
export function bytesRemaining(limit: Limit, used: number): number | null {
  // Clamped at zero: an account that is over its pool after a downgrade has
  // nothing left rather than a negative allowance, and "-4 GB remaining" is a
  // number no meter can draw.
  return isUnlimited(limit) ? null : Math.max(0, (limit as number) - used)
}

export interface MediaQuotaInput {
  /** Photos already on this trip, and the plan's per-trip cap. */
  photosUsed: number
  photosLimit: Limit
  /** Bytes stored across the whole account, and the plan's pool. */
  storageUsed: number
  storageLimit: Limit
  /** Size of the upload being asked about. */
  bytes: number
  planName: string
}

export interface MediaQuotaDecision extends QuotaDecision {
  /**
   * Which limit refused, so the caller can say so. "5 of 5 photos" and "1 GB
   * full" want different copy and a different upgrade prompt, and a boolean would
   * make the uploader guess.
   */
  hit: 'photos' | 'storage' | null
}

/**
 * Whether one more photo of `bytes` may be stored on a trip.
 *
 * The count is checked before the pool, deliberately: on the free plan the
 * per-trip cap is what a user meets first and the one they can act on, and being
 * told about storage when the real answer is "this trip is full" sends them to
 * delete files that were not the problem.
 */
export function decidePhotoQuota({
  photosUsed,
  photosLimit,
  storageUsed,
  storageLimit,
  bytes,
  planName,
}: MediaQuotaInput): MediaQuotaDecision {
  if (!isUnlimited(photosLimit) && photosUsed >= (photosLimit as number)) {
    return {
      allowed: false,
      used: photosUsed,
      limit: photosLimit,
      hit: 'photos',
      reason: `${planName} includes ${photosLimit} photos per trip and this trip has ${photosUsed}. Upgrade to add more — nothing you have uploaded is affected.`,
    }
  }

  const remaining = bytesRemaining(storageLimit, storageUsed)
  if (remaining !== null && bytes > remaining) {
    return {
      allowed: false,
      used: storageUsed,
      limit: storageLimit,
      hit: 'storage',
      reason: `That photo does not fit in what is left of your ${planName} storage. Free some space or upgrade — nothing is deleted either way.`,
    }
  }

  return { allowed: true, used: photosUsed, limit: photosLimit, hit: null }
}

export interface StorageQuotaInput {
  storageUsed: number
  storageLimit: Limit
  bytes: number
  planName: string
}

/**
 * Whether `bytes` fit in what is left of the pool, with no per-trip cap involved.
 *
 * For an image that belongs to no trip: one placed inside a post costs storage
 * like any other file, but "photos per trip" is not a question a standalone post
 * can answer. The pool is what the plan actually charges for, so it is the one
 * that has to hold.
 */
export function decideStorageQuota({
  storageUsed,
  storageLimit,
  bytes,
  planName,
}: StorageQuotaInput): MediaQuotaDecision {
  const remaining = bytesRemaining(storageLimit, storageUsed)

  if (remaining !== null && bytes > remaining) {
    return {
      allowed: false,
      used: storageUsed,
      limit: storageLimit,
      hit: 'storage',
      reason: `That image does not fit in what is left of your ${planName} storage. Free some space or upgrade — nothing is deleted either way.`,
    }
  }

  return { allowed: true, used: storageUsed, limit: storageLimit, hit: null }
}
