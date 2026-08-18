import 'server-only'

import { createClient } from '@/server/supabase/server'
import { toPublicDerivative } from '@/server/media/image-transform'
import { displayPath, needsDisplayCopy } from '@/shared/media'

/**
 * Private, browser-readable copies of originals a browser cannot decode.
 *
 * The public pages have never had this problem: publication re-encodes every
 * photograph to WebP, which is the same step that strips its EXIF. The owner's
 * own screens do not go through that — the vault, the trip page and the region
 * modal all sign the original — so an iPhone's HEIC upload showed the person
 * who took it an empty frame, in the one place they were most likely to look.
 *
 * The fix is the same transform, into the **private** bucket. Not the public
 * one: that bucket is world-readable by design, and a photograph on a trip
 * nobody has published has no business being fetchable from it. The copy lives
 * beside the original under the owner's own path prefix, so the storage policy
 * that guards one guards the other, and the URL handed out is still a signed
 * link that expires.
 *
 * **When this runs.** `confirmUpload` calls it through `after()` as soon as a
 * HEIC lands, so the work belongs to the upload rather than to the first vault
 * view. This is still the lazy path and still correct on its own — it is what
 * covers a photo uploaded before that existed, and what makes the eager call
 * safe to fail — but it should rarely have anything to do.
 *
 * Deliberately best-effort either way: if it fails, the caller gets the
 * original's key back and the page renders exactly as badly as it did before. A
 * broken thumbnail is not worth a 500.
 *
 * Everything is done through the **caller's own client**, never the service
 * role. The storage policies key on the first path segment being the user's id,
 * so an owner can read the original and write the copy, and anybody else can do
 * neither — which is the correct answer, since nobody but the owner should be
 * causing this work to happen.
 */

export interface DisplayableMedia {
  storagePath: string
  mime: string
}

/**
 * Maps each original's key to the key that should actually be signed.
 *
 * Originals in a format browsers handle map to themselves, so the common case
 * costs nothing but a `filter`.
 */
export async function displayKeysFor(media: DisplayableMedia[]): Promise<Map<string, string>> {
  const keys = new Map(media.map((m) => [m.storagePath, m.storagePath]))

  const undisplayable = media.filter((m) => needsDisplayCopy(m.mime))
  if (undisplayable.length === 0) return keys

  const supabase = await createClient()
  const bucket = supabase.storage.from('media')

  // Which copies already exist, asked one folder at a time rather than one
  // object at a time: a vault of forty HEIC photos is one `list` call, not
  // forty round trips guessing at each key.
  const folders = new Set(
    undisplayable.map((m) => {
      const target = displayPath(m.storagePath)
      return target.slice(0, target.lastIndexOf('/'))
    })
  )

  const existing = new Set<string>()
  await Promise.all(
    [...folders].map(async (folder) => {
      const { data } = await bucket.list(folder, { limit: 1000 })
      for (const object of data ?? []) existing.add(`${folder}/${object.name}`)
    })
  )

  await Promise.all(
    undisplayable.map(async (item) => {
      const target = displayPath(item.storagePath)

      if (existing.has(target)) {
        keys.set(item.storagePath, target)
        return
      }

      const { data: original } = await bucket.download(item.storagePath)
      if (!original) return

      try {
        const converted = await toPublicDerivative(Buffer.from(await original.arrayBuffer()))
        const { error } = await bucket.upload(target, converted, {
          contentType: 'image/webp',
          upsert: true,
        })
        if (error) return
      } catch {
        // sharp refuses a file it cannot decode — a HEIC variant, a truncated
        // upload. Leaving the original mapped to itself is what it already was.
        return
      }

      keys.set(item.storagePath, target)
    })
  )

  return keys
}
