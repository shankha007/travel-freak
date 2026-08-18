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
 * **Trip photos on a published trip only.** A post's images used to come through
 * here too, and that was the mistake: they were written at upload rather than at
 * publication, so the world-readable bucket held them before anyone had decided
 * to publish. They are now a stripped copy in the *private* bucket served
 * through `/api/post-images/[mediaId]`, which checks the post's visibility per
 * request. This bucket is for things a public page is already showing.
 *
 * The transform itself lives in image-transform.ts, where it can be tested
 * against a real file rather than described in a comment.
 *
 * **When this runs.** At publish time, from `after()` on the trip's own update
 * action, and on a schedule from `/api/cron/build-derivatives` for anything that
 * missed — both in `derivative-jobs.ts`, which explains the split. The public
 * trip page still calls it, but as a fallback that normally finds `public_path`
 * already set: correctness cannot depend on a job having run. It used to be the
 * only path, which meant the first visitor to a published trip paid for a sharp
 * pipeline over the whole gallery.
 *
 * Idempotent by design — a row that already names a derivative returns early —
 * which is what lets three callers share it without coordinating.
 */

export interface DerivativeResult {
  path: string | null
  error?: string
}

/**
 * Ensures a public derivative exists, returning its object key.
 *
 * Uses the service role for both the read and the write, because the caller is
 * generating something on behalf of a visitor who has no rights to the
 * original. **Callers must have already established that the visitor may see
 * this image** — this function checks nothing, including where `target` points,
 * which is why `derivativePath` in `shared/media.ts` is the only thing that
 * produces one.
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
