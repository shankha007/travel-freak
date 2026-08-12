import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/server/supabase/server'
import { getSessionUser } from '@/server/auth'
import { checkPhotoQuota } from '@/server/entitlements'
import { MAX_UPLOAD_BYTES, isAllowedImageMime, storagePath } from '@/shared/media'

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

const signRequest = z.object({
  tripId: z.uuid(),
  mime: z.string().min(1),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
})

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

  const { tripId, mime, bytes } = parsed.data

  if (!isAllowedImageMime(mime)) {
    return NextResponse.json(
      { error: 'Only images for now — JPEG, PNG, WebP, AVIF or HEIC.' },
      { status: 415 }
    )
  }

  const supabase = await createClient()

  // Ownership, not just readability: a collaborator on someone else's trip must
  // not be able to spend the owner's storage, and RLS on `trips` would happily
  // return a public trip belonging to a stranger.
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) {
    return NextResponse.json({ error: 'That trip is not yours to add photos to.' }, { status: 404 })
  }

  const quota = await checkPhotoQuota(tripId, bytes)
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
  const path = storagePath(user.id, tripId, mediaId, mime)

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
