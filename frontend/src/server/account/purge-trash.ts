import 'server-only'

import { createAdminClient } from '@/server/supabase/server'
import { retentionCutoff } from '@/shared/retention'
import { displayPath } from '@/shared/media'

/**
 * Emptying the trash once its 30 days are up.
 *
 * Soft delete has kept half of its promise since it shipped: things came back
 * inside the window, and nothing ever went after the window closed. A trip
 * deleted forty days ago is unreachable to its owner and to the restore path
 * and is still every byte it ever was.
 *
 * The order is the same one account deletion uses, for the same reason. Storage
 * does not cascade, and the only record of where a photograph lives is the
 * `media` row that is about to be deleted — so the files go first, while the
 * rows naming them still exist. A failure between the two steps leaves objects
 * with no rows, which the next run cannot find; that is the trade, and it is the
 * right way round, because the alternative is deleting rows we then discover we
 * cannot act on.
 *
 * Idempotent: everything is chosen by a cutoff, so running it twice in a minute
 * does nothing the second time, and missing a day costs nothing but a day.
 */

export interface PurgeResult {
  /** The instant everything older than which was considered expired. */
  cutoff: string
  tripsPurged: number
  postsPurged: number
  filesRemoved: number
  /** Storage failures, reported rather than thrown — see below. */
  errors: string[]
}

/** How many object keys go in one `remove()` call. */
const REMOVE_BATCH = 100

export async function purgeExpiredTrash(now = Date.now()): Promise<PurgeResult> {
  const cutoff = retentionCutoff(now)
  const admin = createAdminClient()
  const errors: string[] = []

  const { data: media, error: listError } = await admin.rpc('expired_trash_media', {
    p_cutoff: cutoff,
  })

  if (listError) {
    // Nothing has been deleted yet, so stopping here is safe and the next run
    // finds exactly the same work waiting.
    return {
      cutoff,
      tripsPurged: 0,
      postsPurged: 0,
      filesRemoved: 0,
      errors: [`Could not list expired media: ${listError.message}`],
    }
  }

  const originals = (media ?? []).map((m) => m.storage_path).filter(Boolean)
  // The private display copy of a HEIC. Named from the original's key rather
  // than stored, so it is listed unconditionally — `remove` is untroubled by a
  // key that was never written, and the alternative is an orphan nothing can
  // ever find again once the row naming it is gone.
  const displayCopies = originals.map(displayPath)
  const derivatives = (media ?? []).map((m) => m.public_path).filter((p): p is string => Boolean(p))

  const removed =
    (await removeAll(admin.storage.from('media'), originals, errors)) +
    (await removeAll(admin.storage.from('media-public'), derivatives, errors))

  // Swept, but not counted: most originals never had a display copy, and
  // `remove` reports no error for a key that was never written — so counting
  // these would report a file removed for every HEIC that never existed.
  await removeAll(admin.storage.from('media'), displayCopies, errors)

  // Deliberately not gated on `errors.length === 0`. A single object that
  // refuses to go should not keep a whole day's expired trash in the database
  // for ever — the row is the thing a user was promised would disappear, and a
  // stranded file is a smaller problem than a broken promise.
  const { data: purged, error: purgeError } = await admin.rpc('purge_expired_trash', {
    p_cutoff: cutoff,
  })

  if (purgeError) {
    errors.push(`Could not purge rows: ${purgeError.message}`)
  }

  const counts = purged?.[0]

  return {
    cutoff,
    tripsPurged: counts?.trips_purged ?? 0,
    postsPurged: counts?.posts_purged ?? 0,
    filesRemoved: removed,
    errors,
  }
}

interface RemovableBucket {
  remove(paths: string[]): Promise<{ error: { message: string } | null }>
}

async function removeAll(
  bucket: RemovableBucket,
  paths: string[],
  errors: string[]
): Promise<number> {
  let removed = 0

  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH)
    const { error } = await bucket.remove(batch)
    if (error) errors.push(error.message)
    else removed += batch.length
  }

  return removed
}
