import { describe, expect, it } from 'vitest'
import {
  bytesRemaining,
  decideChecklistQuota,
  decideCollaboratorQuota,
  decidePhotoQuota,
  decideStorageQuota,
  decideTripQuota,
  isUnavailable,
  isUnlimited,
  type Limit,
} from '@/shared/entitlement-rules'

/**
 * Entitlement tests, as §10 of the plan asks for: every plan × every resource, at
 * the boundary, plus the downgrade case.
 *
 * The limits below are copied from the plans migration
 * (`20260807000300_plans_and_storage.sql`) rather than read from it, and that is
 * deliberate — the point of a boundary test is to fail when the arithmetic
 * changes, and reading the numbers from the same place the code does would make
 * every case tautological. `PLANS` here is the specification; the migration is the
 * implementation, and `pricing.test.ts` is what checks the table sells what the
 * database holds.
 */

const GB = 1024 ** 3

const PLANS = {
  explorer: {
    name: 'Explorer',
    trips: 15 as Limit,
    photosPerTrip: 5 as Limit,
    storage: (1 * GB) as Limit,
    checklists: 3 as Limit,
    collaborators: 0 as Limit,
  },
  voyager: {
    name: 'Voyager',
    trips: null as Limit,
    photosPerTrip: 200 as Limit,
    storage: (30 * GB) as Limit,
    checklists: null as Limit,
    collaborators: 3 as Limit,
  },
  nomad: {
    name: 'Nomad',
    trips: null as Limit,
    photosPerTrip: 500 as Limit,
    storage: (100 * GB) as Limit,
    checklists: null as Limit,
    collaborators: null as Limit,
  },
} as const

describe('the limits convention', () => {
  it('reads null as unlimited and 0 as unavailable, and never confuses them', () => {
    // The whole convention. Conflating these produces "you have used 0 of 0
    // collaborators — upgrade to add more" on a plan that does not have the
    // feature at all.
    expect(isUnlimited(null)).toBe(true)
    expect(isUnlimited(0)).toBe(false)
    expect(isUnavailable(0)).toBe(true)
    expect(isUnavailable(null)).toBe(false)
  })
})

describe('trips', () => {
  it('allows the fifteenth on Explorer and refuses the sixteenth', () => {
    // The plan's own example. `used` is what exists now, so the fifteenth trip is
    // created while fourteen exist.
    const { trips, name } = PLANS.explorer
    expect(decideTripQuota({ limit: trips, used: 14, planName: name }).allowed).toBe(true)
    expect(decideTripQuota({ limit: trips, used: 15, planName: name }).allowed).toBe(false)
  })

  it('allows the first trip on every plan', () => {
    for (const plan of Object.values(PLANS)) {
      expect(
        decideTripQuota({ limit: plan.trips, used: 0, planName: plan.name }).allowed,
        plan.name
      ).toBe(true)
    }
  })

  it('never refuses on the unlimited plans', () => {
    for (const plan of [PLANS.voyager, PLANS.nomad]) {
      const decision = decideTripQuota({ limit: plan.trips, used: 5_000, planName: plan.name })
      expect(decision.allowed, plan.name).toBe(true)
      // And no reason: a reason on an allowed decision would be rendered as an
      // upgrade prompt to somebody who already paid.
      expect(decision.reason, plan.name).toBeUndefined()
    }
  })

  it('names the plan and the counts in the refusal', () => {
    const decision = decideTripQuota({ limit: 15, used: 15, planName: 'Explorer' })
    expect(decision.reason).toContain('Explorer')
    expect(decision.reason).toContain('15')
    // The sentence people actually need at that moment.
    expect(decision.reason).toContain('nothing you have recorded is affected')
  })

  describe('downgrade with more trips than the new plan allows', () => {
    // §10: "downgrade-with-over-quota → read-only, nothing deleted."
    const over = decideTripQuota({ limit: 15, used: 40, planName: 'Explorer' })

    it('refuses the next one', () => {
      expect(over.allowed).toBe(false)
    })

    it('reports the real count rather than clamping it to the limit', () => {
      // Clamping would show "15 of 15" and hide the fact that 40 are safe.
      expect(over.used).toBe(40)
      expect(over.reason).toContain('40')
    })

    it('promises nothing is affected', () => {
      expect(over.reason).toContain('nothing you have recorded is affected')
    })
  })
})

describe('photos per trip', () => {
  it('allows the fifth on Explorer and refuses the sixth', () => {
    // The plan's other example, and the boundary a free account meets first.
    const plan = PLANS.explorer
    const input = {
      photosLimit: plan.photosPerTrip,
      storageUsed: 0,
      storageLimit: plan.storage,
      bytes: 2_000_000,
      planName: plan.name,
    }

    expect(decidePhotoQuota({ ...input, photosUsed: 4 }).allowed).toBe(true)
    const sixth = decidePhotoQuota({ ...input, photosUsed: 5 })
    expect(sixth.allowed).toBe(false)
    expect(sixth.hit).toBe('photos')
  })

  it('holds at each paid plan boundary too', () => {
    for (const plan of [PLANS.voyager, PLANS.nomad]) {
      const limit = plan.photosPerTrip as number
      const input = {
        photosLimit: plan.photosPerTrip,
        storageUsed: 0,
        storageLimit: plan.storage,
        bytes: 2_000_000,
        planName: plan.name,
      }
      expect(decidePhotoQuota({ ...input, photosUsed: limit - 1 }).allowed, plan.name).toBe(true)
      expect(decidePhotoQuota({ ...input, photosUsed: limit }).allowed, plan.name).toBe(false)
    }
  })

  it('says which limit refused, because the two want different copy', () => {
    const plan = PLANS.explorer
    // Pool full, count fine.
    const storageBound = decidePhotoQuota({
      photosUsed: 1,
      photosLimit: plan.photosPerTrip,
      storageUsed: plan.storage as number,
      storageLimit: plan.storage,
      bytes: 1,
      planName: plan.name,
    })
    expect(storageBound.allowed).toBe(false)
    expect(storageBound.hit).toBe('storage')
    expect(storageBound.reason).toContain('storage')
  })

  it('reports the count first when both limits are exhausted', () => {
    // Deliberate order: on the free plan the per-trip cap is what the user can
    // act on, and being told about storage sends them to delete files that were
    // not the problem.
    const decision = decidePhotoQuota({
      photosUsed: 5,
      photosLimit: 5,
      storageUsed: 1 * GB,
      storageLimit: 1 * GB,
      bytes: 1,
      planName: 'Explorer',
    })
    expect(decision.hit).toBe('photos')
  })

  it('allows an upload that exactly fills the pool', () => {
    // `bytes > remaining` and not `>=`: a file of exactly the free space fits,
    // and off-by-one here rejects a legitimate upload with a storage message.
    const decision = decidePhotoQuota({
      photosUsed: 0,
      photosLimit: 5,
      storageUsed: 1 * GB - 1000,
      storageLimit: 1 * GB,
      bytes: 1000,
      planName: 'Explorer',
    })
    expect(decision.allowed).toBe(true)
  })

  it('refuses the byte after that', () => {
    const decision = decidePhotoQuota({
      photosUsed: 0,
      photosLimit: 5,
      storageUsed: 1 * GB - 1000,
      storageLimit: 1 * GB,
      bytes: 1001,
      planName: 'Explorer',
    })
    expect(decision.allowed).toBe(false)
    expect(decision.hit).toBe('storage')
  })

  it('allows any count when the per-trip cap is unlimited', () => {
    const decision = decidePhotoQuota({
      photosUsed: 100_000,
      photosLimit: null,
      storageUsed: 0,
      storageLimit: null,
      bytes: 5_000_000,
      planName: 'Nomad',
    })
    expect(decision.allowed).toBe(true)
  })
})

describe('the storage pool on its own, for an image inside a post', () => {
  it('refuses a file larger than what is left', () => {
    const decision = decideStorageQuota({
      storageUsed: 1 * GB - 500,
      storageLimit: 1 * GB,
      bytes: 5_000,
      planName: 'Explorer',
    })
    expect(decision.allowed).toBe(false)
    expect(decision.hit).toBe('storage')
  })

  it('never refuses on an unlimited pool', () => {
    const decision = decideStorageQuota({
      storageUsed: 900 * GB,
      storageLimit: null,
      bytes: 100 * GB,
      planName: 'Nomad',
    })
    expect(decision.allowed).toBe(true)
  })
})

describe('bytesRemaining', () => {
  it('is null when the pool is unlimited', () => {
    expect(bytesRemaining(null, 5_000)).toBeNull()
  })

  it('never goes negative after a downgrade', () => {
    // An account over its new pool has nothing left rather than a negative
    // allowance — "-4 GB remaining" is a number no meter can draw.
    expect(bytesRemaining(1 * GB, 5 * GB)).toBe(0)
  })

  it('is exact in the ordinary case', () => {
    expect(bytesRemaining(1000, 400)).toBe(600)
  })
})

describe('collaborators per trip', () => {
  it('is unavailable on Explorer, not a limit of none', () => {
    const decision = decideCollaboratorQuota({
      limit: PLANS.explorer.collaborators,
      used: 0,
      planName: 'Explorer',
    })
    expect(decision.allowed).toBe(false)
    // The distinction the whole convention exists for: the copy sells a plan,
    // it does not report a count.
    expect(decision.reason).toContain('comes with the paid plans')
    expect(decision.reason).not.toContain('0 of 0')
  })

  it('allows the third on Voyager and refuses the fourth', () => {
    const limit = PLANS.voyager.collaborators
    expect(decideCollaboratorQuota({ limit, used: 2, planName: 'Voyager' }).allowed).toBe(true)
    expect(decideCollaboratorQuota({ limit, used: 3, planName: 'Voyager' }).allowed).toBe(false)
  })

  it('never refuses on Nomad', () => {
    expect(
      decideCollaboratorQuota({ limit: PLANS.nomad.collaborators, used: 50, planName: 'Nomad' })
        .allowed
    ).toBe(true)
  })

  it('says collaborator in the singular when the limit is one', () => {
    const decision = decideCollaboratorQuota({ limit: 1, used: 1, planName: 'Voyager' })
    expect(decision.reason).toContain('1 collaborator per trip')
  })

  it('promises the people already on the trip are unaffected', () => {
    // Downgrade over quota again: three collaborators on a plan that now allows
    // one must not read as a threat to remove two of them.
    const decision = decideCollaboratorQuota({ limit: 1, used: 3, planName: 'Voyager' })
    expect(decision.allowed).toBe(false)
    expect(decision.used).toBe(3)
    expect(decision.reason).toContain('nobody already on it is affected')
  })
})

describe('checklists per trip', () => {
  it('allows the third on Explorer and refuses the fourth', () => {
    const limit = PLANS.explorer.checklists
    expect(decideChecklistQuota({ limit, used: 2, planName: 'Explorer' }).allowed).toBe(true)
    expect(decideChecklistQuota({ limit, used: 3, planName: 'Explorer' }).allowed).toBe(false)
  })

  it('is unlimited on both paid plans', () => {
    for (const plan of [PLANS.voyager, PLANS.nomad]) {
      expect(
        decideChecklistQuota({ limit: plan.checklists, used: 99, planName: plan.name }).allowed,
        plan.name
      ).toBe(true)
    }
  })

  it('promises nothing written is affected', () => {
    const decision = decideChecklistQuota({ limit: 3, used: 3, planName: 'Explorer' })
    expect(decision.reason).toContain('nothing you have written is affected')
  })
})

describe('every refusal', () => {
  it('carries a reason, and every approval carries none', () => {
    // A refusal with no sentence renders as a dead button, and a reason on an
    // approval renders as an upgrade prompt to somebody who already paid.
    const decisions = [
      decideTripQuota({ limit: 15, used: 15, planName: 'Explorer' }),
      decideChecklistQuota({ limit: 3, used: 3, planName: 'Explorer' }),
      decideCollaboratorQuota({ limit: 0, used: 0, planName: 'Explorer' }),
      decideCollaboratorQuota({ limit: 3, used: 3, planName: 'Voyager' }),
      decidePhotoQuota({
        photosUsed: 5,
        photosLimit: 5,
        storageUsed: 0,
        storageLimit: 1 * GB,
        bytes: 1,
        planName: 'Explorer',
      }),
      decideStorageQuota({
        storageUsed: 1 * GB,
        storageLimit: 1 * GB,
        bytes: 1,
        planName: 'Explorer',
      }),
    ]

    for (const decision of decisions) {
      expect(decision.allowed).toBe(false)
      expect(decision.reason, JSON.stringify(decision)).toBeTruthy()
    }

    const approvals = [
      decideTripQuota({ limit: 15, used: 0, planName: 'Explorer' }),
      decideChecklistQuota({ limit: null, used: 99, planName: 'Nomad' }),
      decideCollaboratorQuota({ limit: null, used: 99, planName: 'Nomad' }),
    ]

    for (const decision of approvals) {
      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBeUndefined()
    }
  })
})
