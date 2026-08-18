import { derivativePath } from '@/shared/media'
import { mapWithConcurrency } from '@/shared/concurrency'

/**
 * The loop that converts a batch of photos, and the promises it makes.
 *
 * Deliberately not marked `server-only`, unlike `derivative-jobs.ts` which reads
 * the database around it — the same trade `image-transform.ts` makes and for the
 * same reason. Nothing here touches storage, a client or a service-role key; the
 * one side effect is a parameter. That keeps the properties the publish path and
 * the cron both depend on testable directly rather than asserted in a comment.
 *
 * Those properties are: a failure is counted, not thrown; one bad photograph does
 * not abandon the rest; and no more than `CONCURRENCY` conversions ever run at
 * once.
 */

/**
 * How many photos are converted at once.
 *
 * A memory ceiling as much as a speed setting — each conversion holds an original
 * and a sharp pipeline, so a gallery of two dozen going at once trades a slow job
 * for an exhausted container. Four is what the request path settled on and there
 * is no reason for a background job to be greedier.
 */
export const CONCURRENCY = 4

/** A media row, as much of it as this needs. */
export interface MediaRow {
  id: string
  user_id: string
  /** Null for an image inside a blog post, which is not this bucket's business. */
  trip_id: string | null
  storage_path: string
  public_path: string | null
}

/** One unit of work: a photo, and the key its derivative belongs at. */
export interface DerivativeJob {
  id: string
  userId: string
  storagePath: string
  publicPath: string | null
  target: string
}

/**
 * The one thing this module does to a photo, as a parameter.
 *
 * Production passes `ensurePublicDerivative`; a test passes a function. Matches
 * the shape `purge.ts` uses for its bucket.
 */
export type ConvertMedia = (job: DerivativeJob) => Promise<{ path: string | null; error?: string }>

export interface DerivativeJobResult {
  /** Photos that came out of this run with a derivative they did not have. */
  built: number
  /** Photos that could not be converted. Reported rather than thrown. */
  failed: number
  errors: string[]
}

export const EMPTY_RESULT: DerivativeJobResult = { built: 0, failed: 0, errors: [] }

/**
 * Turns media rows into work, dropping the ones that are not this job's business.
 *
 * A row with no `trip_id` is a blog post's image. Those have their own path —
 * stripped at upload into the *private* bucket and served through a resolver that
 * checks the post's visibility — and converting one into the world-readable
 * bucket here would quietly undo that. The queries in `derivative-jobs.ts` cannot
 * return one; this is the belt to their braces.
 */
export function derivativeJobsFor(rows: MediaRow[]): DerivativeJob[] {
  return rows
    .filter((row): row is MediaRow & { trip_id: string } => row.trip_id !== null)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      storagePath: row.storage_path,
      // Handed over rather than nulled, because the idempotence all three callers
      // rely on lives in `ensurePublicDerivative` returning early when the row
      // already names a derivative. Passing null would re-encode what exists.
      publicPath: row.public_path,
      target: derivativePath(row.user_id, row.trip_id, row.id),
    }))
}

/**
 * Runs a batch, bounded, collecting failures instead of raising them.
 *
 * A photograph whose bytes sharp refuses to read must not cost the other
 * nineteen their derivatives — that would turn one bad upload into a gallery
 * nobody converts. The failing row keeps `public_path` null, so the next
 * scheduled sweep tries again: free when it works, cheap when it does not.
 */
export async function runDerivativeBatch(
  jobs: DerivativeJob[],
  convert: ConvertMedia
): Promise<DerivativeJobResult> {
  if (jobs.length === 0) return EMPTY_RESULT

  const results = await mapWithConcurrency(jobs, CONCURRENCY, (job) => convert(job))

  const errors = results
    .map((result, i) => (result.path ? null : `${jobs[i].id}: ${result.error ?? 'unknown'}`))
    .filter((message): message is string => message !== null)

  return {
    built: results.filter((result) => result.path).length,
    failed: errors.length,
    errors,
  }
}
