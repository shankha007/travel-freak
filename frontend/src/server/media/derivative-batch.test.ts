import { describe, expect, it, vi } from 'vitest'
import {
  CONCURRENCY,
  derivativeJobsFor,
  runDerivativeBatch,
  type ConvertMedia,
  type MediaRow,
} from './derivative-batch'

/**
 * What is worth testing here is not the sharp pipeline — `image-transform.test.ts`
 * does that against a real file — but the loop's promises, which are the three
 * reasons this work moved off a page request: a failure is counted rather than
 * thrown, one bad photograph does not abandon the rest, and the concurrency cap
 * is a cap.
 */

function row(overrides: Partial<MediaRow> = {}): MediaRow {
  const id = overrides.id ?? 'm1'
  const userId = overrides.user_id ?? 'u1'
  const tripId = overrides.trip_id === undefined ? 't1' : overrides.trip_id

  return {
    id,
    user_id: userId,
    trip_id: tripId,
    // Derived from the ids like a real key, so an overridden id does not leave a
    // row whose path belongs to a different photo.
    storage_path: `${userId}/${tripId ?? 'posts'}/${id}.jpg`,
    public_path: null,
    ...overrides,
  }
}

/** Converts everything, and records what it was asked for. */
function fakeConvert() {
  const seen: { target: string; publicPath: string | null }[] = []
  const convert: ConvertMedia = vi.fn(async (job) => {
    seen.push({ target: job.target, publicPath: job.publicPath })
    return { path: job.publicPath ?? job.target }
  })
  return { convert, seen }
}

describe('derivativeJobsFor', () => {
  it('names the derivative from the owner, the trip and the photo', async () => {
    expect(derivativeJobsFor([row({ id: 'photo' })])).toEqual([
      {
        id: 'photo',
        userId: 'u1',
        storagePath: 'u1/t1/photo.jpg',
        publicPath: null,
        target: 'u1/t1/photo.webp',
      },
    ])
  })

  it('skips a post image rather than putting it in the public bucket', () => {
    // `trip_id` null means the row belongs to a blog post. Those are stripped at
    // upload into the *private* bucket and served through a resolver that checks
    // the post's visibility; converting one here would undo that.
    expect(derivativeJobsFor([row({ id: 'post', trip_id: null })])).toEqual([])
  })

  it('still takes the trip photos alongside a post image', () => {
    const jobs = derivativeJobsFor([row({ id: 'post', trip_id: null }), row({ id: 'photo' })])

    expect(jobs.map((job) => job.id)).toEqual(['photo'])
  })

  it('carries the stored public_path over, so a built one can return early', () => {
    // The idempotence all three callers rely on lives in `ensurePublicDerivative`,
    // which returns early when the row already names a derivative. This function's
    // part of that bargain is handing the stored value over rather than null.
    expect(derivativeJobsFor([row({ public_path: 'u1/t1/m1.webp' })])[0].publicPath).toBe(
      'u1/t1/m1.webp'
    )
  })
})

describe('runDerivativeBatch', () => {
  it('converts every job and reports what it built', async () => {
    const { convert, seen } = fakeConvert()

    const result = await runDerivativeBatch(
      derivativeJobsFor([row({ id: 'a' }), row({ id: 'b' })]),
      convert
    )

    expect(result).toEqual({ built: 2, failed: 0, errors: [] })
    expect(seen.map((s) => s.target)).toEqual(['u1/t1/a.webp', 'u1/t1/b.webp'])
  })

  it('has nothing to do for an empty batch', async () => {
    const { convert } = fakeConvert()

    expect(await runDerivativeBatch([], convert)).toEqual({ built: 0, failed: 0, errors: [] })
    expect(convert).not.toHaveBeenCalled()
  })

  it('counts a failure instead of throwing, and finishes the rest', async () => {
    // One photograph whose bytes sharp will not read must not cost the other two
    // their derivatives — that would turn a single bad upload into a gallery
    // nobody converts.
    const convert: ConvertMedia = async (job) =>
      job.id === 'bad' ? { path: null, error: 'unsupported image' } : { path: job.target }

    const result = await runDerivativeBatch(
      derivativeJobsFor([row({ id: 'a' }), row({ id: 'bad' }), row({ id: 'c' })]),
      convert
    )

    expect(result.built).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors).toEqual(['bad: unsupported image'])
  })

  it('names the row when a failure gives no reason', async () => {
    const convert: ConvertMedia = async () => ({ path: null })

    const result = await runDerivativeBatch(derivativeJobsFor([row({ id: 'quiet' })]), convert)

    expect(result.errors).toEqual(['quiet: unknown'])
  })

  it('never runs more conversions at once than the cap allows', async () => {
    // The cap is a memory ceiling, not a speed setting: each conversion holds an
    // original and a sharp pipeline, and a gallery going at once trades a slow
    // job for an exhausted container.
    let inFlight = 0
    let peak = 0

    const convert: ConvertMedia = async (job) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return { path: job.target }
    }

    const rows = Array.from({ length: 12 }, (_, i) => row({ id: `m${i}` }))
    const result = await runDerivativeBatch(derivativeJobsFor(rows), convert)

    expect(result.built).toBe(12)
    expect(peak).toBeLessThanOrEqual(CONCURRENCY)
    // Guards the test itself: with a cap of 12 or more this would prove nothing.
    expect(CONCURRENCY).toBeLessThan(12)
  })
})
