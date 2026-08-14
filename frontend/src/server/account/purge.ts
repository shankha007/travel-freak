/**
 * Finding and removing every file one account owns — screen 44.
 *
 * Deleting the `auth.users` row cascades through the database, because every
 * table keys on `user_id` with `on delete cascade`. Storage is not the database:
 * the objects are not rows, nothing cascades to them, and a deleted account
 * whose photographs are still sitting in a bucket has not been deleted. This is
 * that half.
 *
 * Both buckets key objects under `<userId>/` — `media` holds the originals and
 * `media-public` the stripped derivatives — so one prefix finds all of them.
 * The walk is recursive rather than a single `list()`, because the keys are two
 * and three segments deep (`<user>/<trip>/<file>` and
 * `<user>/posts/<post>/<file>`) and Supabase's list returns one level at a
 * time. Walking the tree rather than reading paths out of the `media` table is
 * deliberate: an upload that was signed and never confirmed has an object and
 * no row, and it is exactly the kind of thing a deletion must not miss.
 *
 * Written against a minimal interface rather than the Supabase client so the
 * recursion can be tested without a bucket.
 */

/** One entry as Supabase's storage `list()` returns it. A folder has a null id. */
export interface StorageEntry {
  name: string
  id: string | null
}

export interface StorageLister {
  list(
    prefix: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ data: StorageEntry[] | null; error: { message: string } | null }>
}

/** How many entries one `list()` call asks for. Supabase caps this at 100 by default. */
const PAGE = 100

/**
 * Guards against a cycle or a pathological tree.
 *
 * The real depth is three. Anything past this is a bug somewhere else, and a
 * recursion that keeps going is worse than one that stops and says so.
 */
const MAX_DEPTH = 6

/**
 * Every object key under a prefix, recursively.
 *
 * Paginates, because a prolific account has more than one page of photographs
 * in a single trip folder and a partial list here means files left behind.
 */
export async function listObjects(
  storage: StorageLister,
  prefix: string,
  depth = 0
): Promise<string[]> {
  if (depth >= MAX_DEPTH) return []

  const keys: string[] = []
  let offset = 0

  for (;;) {
    const { data, error } = await storage.list(prefix, { limit: PAGE, offset })
    if (error || !data || data.length === 0) break

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // `id: null` is how Supabase reports a folder rather than an object.
      if (entry.id === null) {
        keys.push(...(await listObjects(storage, path, depth + 1)))
      } else {
        keys.push(path)
      }
    }

    if (data.length < PAGE) break
    offset += PAGE
  }

  return keys
}

export interface BucketClient extends StorageLister {
  remove(paths: string[]): Promise<{ error: { message: string } | null }>
}

/** How many keys go in one `remove()` call. */
const REMOVE_BATCH = 100

/**
 * Removes everything under `<userId>/` in one bucket.
 *
 * Returns what it managed rather than throwing. A file that refuses to go is
 * worth reporting, but it must not stop the account deletion — leaving someone
 * with an account they have asked to be rid of because one object errored is
 * the worse of the two failures.
 */
export async function purgeBucket(
  bucket: BucketClient,
  userId: string
): Promise<{ removed: number; errors: string[] }> {
  const keys = await listObjects(bucket, userId)
  if (keys.length === 0) return { removed: 0, errors: [] }

  const errors: string[] = []
  let removed = 0

  for (let i = 0; i < keys.length; i += REMOVE_BATCH) {
    const batch = keys.slice(i, i + REMOVE_BATCH)
    const { error } = await bucket.remove(batch)
    if (error) {
      errors.push(error.message)
    } else {
      removed += batch.length
    }
  }

  return { removed, errors }
}
