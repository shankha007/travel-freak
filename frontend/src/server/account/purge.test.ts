import { describe, expect, it, vi } from 'vitest'
import { listObjects, purgeBucket, type StorageEntry } from './purge'

/**
 * A bucket, as a tree of paths. Folders are inferred from the keys, which is
 * what Supabase does too — storage has no real directories.
 */
function fakeBucket(keys: string[]) {
  const list = vi.fn(async (prefix: string, options?: { limit?: number; offset?: number }) => {
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const base = prefix ? `${prefix}/` : ''

    const children = new Map<string, StorageEntry>()
    for (const key of keys) {
      if (!key.startsWith(base)) continue
      const rest = key.slice(base.length)
      if (!rest) continue
      const [head, ...tail] = rest.split('/')
      // A folder is anything with something after it; Supabase reports those
      // with a null id and no further detail.
      children.set(head, { name: head, id: tail.length > 0 ? null : `id-${key}` })
    }

    const all = [...children.values()]
    return { data: all.slice(offset, offset + limit), error: null }
  })

  const removed: string[] = []
  // Typed as the interface rather than inferred from the happy path, so a test
  // can override it with a failure without TypeScript deciding `error` is
  // permanently null.
  const remove = vi.fn(async (paths: string[]): Promise<{ error: { message: string } | null }> => {
    removed.push(...paths)
    return { error: null }
  })

  return { list, remove, removed }
}

const USER = 'aaaa-1111'

describe('listObjects', () => {
  it('finds objects nested at both of the depths the app writes', async () => {
    const bucket = fakeBucket([
      `${USER}/trip-1/photo-a.jpg`,
      `${USER}/trip-1/photo-b.jpg`,
      `${USER}/posts/post-1/image.webp`,
    ])

    // Sorted for comparison only: the order files come back in decides nothing,
    // since every one of them is about to be deleted.
    await expect(listObjects(bucket, USER).then((k) => k.sort())).resolves.toEqual([
      `${USER}/posts/post-1/image.webp`,
      `${USER}/trip-1/photo-a.jpg`,
      `${USER}/trip-1/photo-b.jpg`,
    ])
  })

  it('does not stray outside the prefix it was given', async () => {
    const bucket = fakeBucket([`${USER}/trip-1/mine.jpg`, 'bbbb-2222/trip-9/theirs.jpg'])
    const keys = await listObjects(bucket, USER)

    // Deleting one account must never reach into another's folder.
    expect(keys).toEqual([`${USER}/trip-1/mine.jpg`])
  })

  it('pages, so a trip with more than one page of photos is fully listed', async () => {
    const many = Array.from({ length: 250 }, (_, i) => `${USER}/trip-1/photo-${i}.jpg`)
    const bucket = fakeBucket(many)

    const keys = await listObjects(bucket, USER)

    // A partial list here is files left behind on a deleted account.
    expect(keys).toHaveLength(250)
    expect(bucket.list).toHaveBeenCalledWith(`${USER}/trip-1`, { limit: 100, offset: 200 })
  })

  it('gives up rather than recursing forever on a tree that lies', async () => {
    // A bucket that reports the same folder inside itself would otherwise be an
    // infinite loop holding an account deletion open.
    const bucket = {
      list: vi.fn(async () => ({ data: [{ name: 'loop', id: null }], error: null })),
    }

    const keys = await listObjects(bucket, USER)
    expect(keys).toEqual([])
    expect(bucket.list.mock.calls.length).toBeLessThan(10)
  })

  it('returns what it has when the bucket errors rather than throwing', async () => {
    const bucket = {
      list: vi.fn(async () => ({ data: null, error: { message: 'storage is down' } })),
    }
    await expect(listObjects(bucket, USER)).resolves.toEqual([])
  })
})

describe('purgeBucket', () => {
  it('removes every object it found', async () => {
    const bucket = fakeBucket([
      `${USER}/trip-1/a.jpg`,
      `${USER}/trip-1/b.jpg`,
      `${USER}/posts/p/c.webp`,
    ])

    const result = await purgeBucket(bucket, USER)

    expect(result).toEqual({ removed: 3, errors: [] })
    expect(bucket.removed.sort()).toEqual(
      [`${USER}/posts/p/c.webp`, `${USER}/trip-1/a.jpg`, `${USER}/trip-1/b.jpg`].sort()
    )
  })

  it('removes in batches rather than one enormous call', async () => {
    const bucket = fakeBucket(Array.from({ length: 150 }, (_, i) => `${USER}/t/f${i}.jpg`))
    await purgeBucket(bucket, USER)
    expect(bucket.remove).toHaveBeenCalledTimes(2)
  })

  it('does nothing at all when there is nothing there', async () => {
    const bucket = fakeBucket([])
    await expect(purgeBucket(bucket, USER)).resolves.toEqual({ removed: 0, errors: [] })
    expect(bucket.remove).not.toHaveBeenCalled()
  })

  it('reports a batch that failed and keeps going', async () => {
    const bucket = fakeBucket(Array.from({ length: 150 }, (_, i) => `${USER}/t/f${i}.jpg`))
    bucket.remove
      .mockImplementationOnce(async () => ({ error: { message: 'nope' } }))
      .mockImplementationOnce(async () => ({ error: null }))

    const result = await purgeBucket(bucket, USER)

    // One stubborn file must not leave someone stuck with an account they asked
    // to be rid of.
    expect(result.errors).toEqual(['nope'])
    expect(result.removed).toBe(50)
  })
})
