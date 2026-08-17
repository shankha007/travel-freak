import 'server-only'

import { createAdminClient } from '@/server/supabase/server'
import { ensurePublicDerivative } from '@/server/media/derivatives'
import {
  EMPTY_RESULT,
  derivativeJobsFor,
  runDerivativeBatch,
  type DerivativeJobResult,
} from '@/server/media/derivative-batch'

/**
 * Finding the photos that need a public derivative, away from the request that
 * needs them.
 *
 * Publishing a trip has always been the moment a photograph *becomes* public, but
 * the re-encode happened on the first request for the public page — so the first
 * visitor, quite possibly a stranger following a link, paid for a sharp pipeline
 * over every photo in the gallery. Four at a time rather than one after another
 * shortened that and did not move it.
 *
 * It runs in two places now, neither of them a visitor's request:
 *
 *  - **At publish time**, through `after()` in the trip's update action, so the
 *    work starts once the owner's own response has been sent. They pressed a
 *    button and something happened; they do not wait for it.
 *  - **On a schedule**, through `/api/cron/build-derivatives`, sweeping up
 *    whatever the first pass did not finish — a function that timed out mid
 *    gallery, a trip published before any of this existed, a transform that failed
 *    on a bad byte and deserves another try.
 *
 * The lazy path in `public-trip.ts` stays behind both, as *correctness* rather
 * than as the plan: once these have run it finds `public_path` already set and
 * does nothing, which is what it always did from the second request onwards.
 *
 * Everything here uses the service role, and everything here is idempotent —
 * `ensurePublicDerivative` returns early on a row that already names a
 * derivative, so a double run costs two queries and no re-encoding. The batch
 * loop itself lives in `derivative-batch.ts`, which is testable because it holds
 * none of this.
 */

/**
 * How many photos one scheduled run will take on.
 *
 * A backlog is worked through over several runs rather than in one that hits the
 * platform's timeout and leaves nothing to show for itself. Work is chosen by a
 * predicate rather than a cursor, so the next run simply finds whatever is still
 * outstanding.
 */
const SWEEP_LIMIT = 200

/** The columns the batch needs. */
const SELECT_MEDIA = 'id, user_id, trip_id, storage_path, public_path'

/**
 * Builds every missing derivative for one trip.
 *
 * Takes a trip id rather than a list of photos, because the caller is a Server
 * Action that has just written a trip row and has no business also knowing which
 * of its photographs need re-encoding.
 *
 * Deliberately does not re-check the trip's visibility: the only caller has just
 * set it public, and reading the row back to confirm what it wrote would be a
 * round trip to answer its own question. The scheduled sweep, which trusts
 * nobody, checks.
 */
export async function buildTripDerivatives(tripId: string): Promise<DerivativeJobResult> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('media')
    .select(SELECT_MEDIA)
    .eq('trip_id', tripId)
    .eq('kind', 'image')
    .is('deleted_at', null)
    .is('public_path', null)

  if (error) {
    return { ...EMPTY_RESULT, errors: [`Could not list photos: ${error.message}`] }
  }

  return runDerivativeBatch(derivativeJobsFor(data ?? []), ensurePublicDerivative)
}

/**
 * Builds missing derivatives across every published public trip.
 *
 * `!inner` makes the embedded trip a join condition rather than a decoration, so
 * the filters on it actually narrow the media rows: a photo on a private trip, an
 * unpublished one, or one in the trash is not selected at all. That matters
 * because this runs with the service role, and RLS is not going to say no on its
 * behalf — a bug here would publish a derivative of a private photograph.
 *
 * The embed is hinted by constraint name because `media` and `trips` are related
 * twice: `media.trip_id` points at the trip, and `trips.cover_media_id` points
 * back at a photo. PostgREST refuses to guess between them, and it refuses at
 * runtime — the generated types accept the unhinted form quite happily, so this
 * is one of the few places here where a green typecheck proves nothing.
 */
export async function buildPendingDerivatives(
  limit = SWEEP_LIMIT
): Promise<DerivativeJobResult & { scanned: number }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('media')
    .select(
      `${SELECT_MEDIA}, trips!media_trip_id_fkey!inner ( visibility, published_at, deleted_at )`
    )
    .eq('kind', 'image')
    .is('deleted_at', null)
    .is('public_path', null)
    .eq('trips.visibility', 'public')
    .not('trips.published_at', 'is', null)
    .is('trips.deleted_at', null)
    // Oldest first, so a photo that has been waiting does not stay behind a
    // steady trickle of newer ones for ever.
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return {
      ...EMPTY_RESULT,
      errors: [`Could not list pending photos: ${error.message}`],
      scanned: 0,
    }
  }

  const rows = data ?? []
  const result = await runDerivativeBatch(derivativeJobsFor(rows), ensurePublicDerivative)

  return { ...result, scanned: rows.length }
}
