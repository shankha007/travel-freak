import 'server-only'

import { createAdminClient } from '@/server/supabase/server'
import { toPublicDerivative } from '@/server/media/image-transform'

/**
 * Public image derivatives.
 *
 * A public page never serves an original. Originals carry EXIF, and EXIF
 * carries GPS: a photo taken at home pins the photographer's front door, which
 * the plan treats as a safety issue rather than a nicety. So the first time a
 * photo needs to be public, it is re-encoded here — resized, converted, and
 * stripped of every metadata block — and the result is written to a separate
 * public bucket. The original never moves and never loses its metadata.
 *
 * The transform itself lives in image-transform.ts, where it can be tested
 * against a real file rather than described in a comment.
 *
 * Generation is lazy: the first request for a public page pays for it, and the
 * `public_path` on the row means nothing pays for it twice. A background job at
 * publish time would be better and is what the plan eventually wants; this is
 * the same output without the queue.
 */

export interface DerivativeResult {
  path: string | null
  error?: string
}

/** Object key for a trip photo's public derivative. */
export function derivativePath(userId: string, tripId: string, mediaId: string): string {
  return `${userId}/${tripId}/${mediaId}.webp`
}

/**
 * Object key for an image placed inside a post.
 *
 * A separate shape because a post image belongs to no trip: its `media.trip_id`
 * is null, so there is no trip folder to put it in. The `posts/` segment keeps
 * the two kinds of derivative from ever colliding on a key.
 */
export function postDerivativePath(userId: string, postId: string, mediaId: string): string {
  return `${userId}/posts/${postId}/${mediaId}.webp`
}

/**
 * Ensures a public derivative exists, returning its object key.
 *
 * Uses the service role for both the read and the write, because the caller is
 * generating something on behalf of a visitor who has no rights to the
 * original. **Callers must have already established that the visitor may see
 * this image** — this function checks nothing, including where `target` points,
 * which is why the two path builders above are the only things that produce one.
 */
export async function ensurePublicDerivative(media: {
  id: string
  userId: string
  storagePath: string
  publicPath: string | null
  /** Object key to write to, from `derivativePath` or `postDerivativePath`. */
  target: string
}): Promise<DerivativeResult> {
  if (media.publicPath) return { path: media.publicPath }

  const admin = createAdminClient()
  const target = media.target

  const { data: original, error: downloadError } = await admin.storage
    .from('media')
    .download(media.storagePath)

  if (downloadError || !original) {
    return { path: null, error: `Could not read the original: ${downloadError?.message}` }
  }

  let derivative: Buffer
  try {
    derivative = await toPublicDerivative(Buffer.from(await original.arrayBuffer()))
  } catch (error) {
    return {
      path: null,
      error: `Could not process the image: ${error instanceof Error ? error.message : 'unknown'}`,
    }
  }

  const { error: uploadError } = await admin.storage
    .from('media-public')
    .upload(target, derivative, { contentType: 'image/webp', upsert: true })

  if (uploadError) {
    return { path: null, error: `Could not store the derivative: ${uploadError.message}` }
  }

  const { error: updateError } = await admin
    .from('media')
    .update({ public_path: target })
    .eq('id', media.id)

  if (updateError) {
    // The object exists, so the page can still show it; the next request will
    // simply regenerate rather than serve something stale.
    return { path: target, error: updateError.message }
  }

  return { path: target }
}

/** Public URL for a derivative. The bucket is public, so this needs no signing. */
export function publicMediaUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/media-public/${path}`
}
