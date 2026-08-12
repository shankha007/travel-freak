import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/server/supabase/server'
import { getSessionUser } from '@/server/auth'
import { checkPhotoQuota, checkStorageQuota } from '@/server/entitlements'
import { MAX_UPLOAD_BYTES, isAllowedImageMime, postImagePath, storagePath } from '@/shared/media'

/**
 * Issues a short-lived signed upload URL for one photo.
 *
 * This is the quota gate. The browser PUTs the file straight to Supabase
 * Storage afterwards, so this handler is the last point at which the server can
 * say no — and the only one that runs before bytes are spent. Nothing here
 * trusts the client: the trip is re-checked for ownership, the declared size
 * and type are validated, and the plan's limits are counted live.
 *
 * The declared size is still a claim. `confirmUpload` re-reads the object's
 * real size from storage before the media row is written, so a client that
 * under-reports gains nothing but a rejected upload.
 */

/**
 * Exactly one target, and the union is what enforces it.
 *
 * A trip photo is capped per trip *and* against the pool; an image inside a post
 * belongs to no trip, so only the pool applies. Accepting both ids in one object
 * would leave a request that names neither — and one that names both — as
 * something this handler had to decide about at runtime.
 */
const signRequest = z.union([
  z.object({
    tripId: z.uuid(),
    mime: z.string().min(1),
    bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  }),
  z.object({
    postId: z.uuid(),
    mime: z.string().min(1),
    bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  }),
])

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to upload.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const parsed = signRequest.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Malformed request.' },
      { status: 400 }
    )
  }

  const { mime, bytes } = parsed.data
  const tripId = 'tripId' in parsed.data ? parsed.data.tripId : null
  const postId = 'postId' in parsed.data ? parsed.data.postId : null

  if (!isAllowedImageMime(mime)) {
    return NextResponse.json(
      { error: 'Only images for now — JPEG, PNG, WebP, AVIF or HEIC.' },
      { status: 415 }
    )
  }

  const supabase = await createClient()

  // Ownership, not just readability: a collaborator on someone else's trip must
  // not be able to spend the owner's storage, and RLS on `trips` would happily
  // return a public trip belonging to a stranger. The same reasoning applies to
  // a post, which RLS will return to anyone once it is published.
  const owned = tripId
    ? await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
    : await supabase
        .from('blog_posts')
        .select('id')
        .eq('id', postId as string)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

  if (!owned.data) {
    return NextResponse.json(
      { error: tripId ? 'That trip is not yours to add photos to.' : 'That post is not yours.' },
      { status: 404 }
    )
  }

  const quota = tripId ? await checkPhotoQuota(tripId, bytes) : await checkStorageQuota(bytes)
  if (!quota.allowed) {
    // 402 rather than 403: this is a plan limit, not a permission problem, and
    // the uploader shows an upgrade card rather than an error.
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true, quota: quota.quota },
      { status: 402 }
    )
  }

  // The media id is minted here so the storage key and the future row agree,
  // and so a client cannot choose its own path inside another user's folder.
  const mediaId = crypto.randomUUID()
  const path = tripId
    ? storagePath(user.id, tripId, mediaId, mime)
    : postImagePath(user.id, postId as string, mediaId, mime)

  const { data, error } = await supabase.storage.from('media').createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json(
      { error: `Could not start the upload: ${error?.message ?? 'unknown error'}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    mediaId,
    path: data.path,
    token: data.token,
    quota: quota.quota,
  })
}
