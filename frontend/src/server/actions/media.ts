'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { checkPhotoQuota, checkStorageQuota } from '@/server/entitlements'
import { toPublicDerivative } from '@/server/media/image-transform'
import { displayKeysFor } from '@/server/media/display'
import {
  displayPath,
  isAllowedImageMime,
  needsDisplayCopy,
  postImagePath,
  postImageUrl,
  sniffImageMime,
  storagePath,
} from '@/shared/media'

/**
 * Media Server Actions.
 *
 * The upload itself never touches this server — the browser PUTs to Storage
 * with a signed URL from `/api/uploads/sign`. What happens here is everything
 * after: verifying that what landed is what was promised, and writing the row
 * that makes it part of a trip.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const confirmInput = z.object({
  mediaId: z.uuid(),
  tripId: z.uuid(),
  mime: z.string().min(1),
  /** Pixel dimensions, read from the decoded image in the browser. */
  width: z.number().int().positive().max(100_000).nullable(),
  height: z.number().int().positive().max(100_000).nullable(),
  /** EXIF DateTimeOriginal, when the file carries one. */
  takenAt: z.string().datetime().nullable(),
  /** EXIF GPS. Owner-visible only; never served on a public derivative. */
  exifLat: z.number().min(-90).max(90).nullable(),
  exifLng: z.number().min(-180).max(180).nullable(),
})

export type ConfirmUploadInput = z.input<typeof confirmInput>

export interface ConfirmUploadResult {
  ok: boolean
  error?: string
}

/**
 * Records an uploaded object as a photo on a trip.
 *
 * Size and content type come from Storage, not from the client. The browser
 * declared both when it asked for the signed URL; this reads what the object
 * actually is, re-checks the quota against that real size, and deletes the
 * object rather than keeping something the plan does not allow.
 */
export async function confirmUpload(input: ConfirmUploadInput): Promise<ConfirmUploadResult> {
  const user = await requireUser()

  const parsed = confirmInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Something went wrong finishing that upload.' }
  }

  const { mediaId, tripId, mime, width, height, takenAt, exifLat, exifLng } = parsed.data

  if (!isAllowedImageMime(mime)) {
    return { ok: false, error: 'That file type is not allowed.' }
  }

  const supabase = await createClient()
  const path = storagePath(user.id, tripId, mediaId, mime)

  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) {
    return { ok: false, error: 'That trip is not yours to add photos to.' }
  }

  // Ask storage what it actually stored. `list` on the file's own folder is the
  // portable way to read an object's metadata.
  const { data: objects } = await supabase.storage.from('media').list(`${user.id}/${tripId}`, {
    search: `${mediaId}.`,
  })

  const object = objects?.[0]
  if (!object) {
    return { ok: false, error: 'That upload did not arrive. Try again.' }
  }

  const actualBytes = Number(object.metadata?.size ?? 0)

  // The mimetype storage recorded is just the header the browser sent, so it is
  // still the client's word. Read the object's leading bytes and identify it
  // from the signature instead — this is what stops an HTML error page, or
  // anything else, being stored and later served as an image.
  const sniffed = await sniffStoredImage(path)
  if (!sniffed) {
    await removeObject(path)
    return { ok: false, error: 'That file is not an image the app can store.' }
  }
  const actualMime = sniffed

  // Re-check against the real size: the quota gate before the upload only had
  // the client's word for it.
  const quota = await checkPhotoQuota(tripId, actualBytes)
  if (!quota.allowed) {
    await removeObject(path)
    return { ok: false, error: quota.reason ?? 'That photo does not fit in your plan.' }
  }

  const { error } = await supabase.from('media').insert({
    id: mediaId,
    user_id: user.id,
    trip_id: tripId,
    kind: 'image',
    storage_path: path,
    mime: actualMime,
    bytes: actualBytes,
    width,
    height,
    taken_at: takenAt,
    exif_lat: exifLat,
    exif_lng: exifLng,
    processing_status: 'ready',
  })

  if (error) {
    // An orphaned object would count against the pool forever without ever
    // appearing in the vault.
    await removeObject(path)
    return { ok: false, error: `Could not save that photo: ${error.message}` }
  }

  // A HEIC's browser-readable copy, built now rather than the first time the
  // owner opens their own vault. Same reasoning as the public derivatives: the
  // work belongs to the moment the file arrives, not to a page load. `after()`
  // keeps it off this response, and `displayKeysFor()` remains the fallback —
  // it finds the copy already written and signs it.
  //
  // Best-effort throughout. If it fails the vault behaves exactly as it did
  // before, which is to say it tries again on first view.
  if (needsDisplayCopy(actualMime)) {
    after(async () => {
      await displayKeysFor([{ storagePath: path, mime: actualMime }])
    })
  }

  revalidatePath(`/trips/${tripId}/vault`)
  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Deletes a storage object with the service role.
 *
 * Used only on failure paths, where the caller has already proven ownership of
 * the path it is passing — the key is built from the session's own user id.
 */
async function removeObject(path: string): Promise<void> {
  const admin = createAdminClient()
  await admin.storage.from('media').remove([path])
}

/**
 * Reads the first bytes of a stored object and identifies the image format.
 *
 * Fetched as a range request rather than a full download: 32 bytes settles
 * every signature the app accepts, and pulling a 20 MB photo back through the
 * server to look at its header would undo the point of uploading directly to
 * storage.
 */
async function sniffStoredImage(path: string) {
  const supabase = await createClient()
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 60)
  if (!data?.signedUrl) return null

  try {
    const response = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-31' } })
    if (!response.ok) return null
    return sniffImageMime(new Uint8Array(await response.arrayBuffer()))
  } catch {
    return null
  }
}

const postImageInput = z.object({
  mediaId: z.uuid(),
  postId: z.uuid(),
  mime: z.string().min(1),
  width: z.number().int().positive().max(100_000).nullable(),
  height: z.number().int().positive().max(100_000).nullable(),
  altText: z.string().trim().max(300),
})

export interface PostImageResult {
  ok: boolean
  /** Public URL of the stripped derivative, ready to insert into the document. */
  url?: string
  error?: string
}

/**
 * Records an image uploaded into a post and returns a URL the post can use.
 *
 * The checks are the ones `confirmUpload` makes — real size from storage, magic
 * bytes rather than the declared type, quota re-run against what actually landed
 * — because the client's word is worth the same here as it is there.
 *
 * Two things differ, both because a post image is not a trip photo:
 *
 *  - **`trip_id` stays null.** The image belongs to a post, and counting it
 *    against a trip's photo cap would charge the wrong quota for it. The storage
 *    pool still applies, which is the limit that costs money.
 *  - **The derivative is generated now, not on first publication.** A post's HTML
 *    has to contain a URL that keeps working, and a signed URL expires in an
 *    hour. So the image is re-encoded immediately — which strips the EXIF, GPS
 *    included — and the document references the stripped copy. The original stays
 *    private and is never what a reader sees.
 *
 * The stripped copy goes into the **private** bucket, beside the original under
 * the owner's own prefix, and the document points at `/api/post-images/<id>`,
 * which checks the post's visibility on every request. It used to go into the
 * world-readable bucket instead, which made the picture fetchable from the
 * moment it was uploaded — unguessable, but unguarded, and readable before
 * anybody had decided to publish anything.
 */
export async function confirmPostImage(
  input: z.input<typeof postImageInput>
): Promise<PostImageResult> {
  const user = await requireUser()

  const parsed = postImageInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Something went wrong finishing that upload.' }
  }

  const { mediaId, postId, mime, width, height, altText } = parsed.data

  if (!isAllowedImageMime(mime)) {
    return { ok: false, error: 'That file type is not allowed.' }
  }

  const supabase = await createClient()
  const path = postImagePath(user.id, postId, mediaId, mime)

  const { data: post } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('id', postId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) {
    return { ok: false, error: 'That post is not yours.' }
  }

  const { data: objects } = await supabase.storage
    .from('media')
    .list(`${user.id}/posts/${postId}`, { search: `${mediaId}.` })

  const object = objects?.[0]
  if (!object) {
    return { ok: false, error: 'That upload did not arrive. Try again.' }
  }

  const actualBytes = Number(object.metadata?.size ?? 0)

  const sniffed = await sniffStoredImage(path)
  if (!sniffed) {
    await removeObject(path)
    return { ok: false, error: 'That file is not an image the app can store.' }
  }

  const quota = await checkStorageQuota(actualBytes)
  if (!quota.allowed) {
    await removeObject(path)
    return { ok: false, error: quota.reason ?? 'That image does not fit in your plan.' }
  }

  const { error } = await supabase.from('media').insert({
    id: mediaId,
    user_id: user.id,
    trip_id: null,
    // The post this image belongs to. Without it the row's only link to the
    // post is the object key, which the database cannot follow — so purging an
    // expired post left its pictures behind. Cascades, so the post taking them
    // with it needs no code.
    post_id: postId,
    kind: 'image',
    storage_path: path,
    mime: sniffed,
    bytes: actualBytes,
    width,
    height,
    alt_text: altText,
    processing_status: 'ready',
  })

  if (error) {
    await removeObject(path)
    return { ok: false, error: `Could not save that image: ${error.message}` }
  }

  const stripped = await writeStrippedCopy(path)

  if (!stripped) {
    // Nothing readable came out of the transform, so there is no image to point
    // the document at. The row and the original are removed rather than left as
    // a file the writer can neither see nor account for — and this is also what
    // lets the serving route treat "the row exists" as "the copy exists".
    await supabase.from('media').delete().eq('id', mediaId).eq('user_id', user.id)
    await removeObject(path)
    return { ok: false, error: 'Could not prepare that image.' }
  }

  revalidatePath(`/blogs/${postId}/edit`)
  return { ok: true, url: postImageUrl(mediaId) }
}

/**
 * Re-encodes an upload into a stripped WebP beside it in the private bucket.
 *
 * The same transform, the same key and the same bucket the vault's HEIC display
 * copies use — `displayPath()` says why the shape is what it is, and both
 * deletion paths already sweep it, so a post image needs no cleanup of its own.
 *
 * Through the owner's own client, never the service role: the storage policies
 * key on the first path segment being the caller's id, so the person whose
 * upload this is can read it and write beside it, and nobody else can do either.
 */
async function writeStrippedCopy(originalPath: string): Promise<boolean> {
  const supabase = await createClient()
  const bucket = supabase.storage.from('media')

  const { data: original } = await bucket.download(originalPath)
  if (!original) return false

  try {
    const converted = await toPublicDerivative(Buffer.from(await original.arrayBuffer()))
    const { error } = await bucket.upload(displayPath(originalPath), converted, {
      contentType: 'image/webp',
      upsert: true,
    })
    return !error
  } catch {
    // sharp refuses what it cannot decode — a HEIC variant, a truncated upload.
    return false
  }
}

const detailsInput = z.object({
  mediaId: z.uuid(),
  caption: z.string().trim().max(300),
  altText: z.string().trim().max(300),
})

export interface MediaActionResult {
  ok: boolean
  error?: string
}

/** Caption and alt text. Alt text is what makes a gallery readable at all. */
export async function updateMediaDetails(
  input: z.input<typeof detailsInput>
): Promise<MediaActionResult> {
  const user = await requireUser()

  const parsed = detailsInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check those details.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media')
    .update({ caption: parsed.data.caption, alt_text: parsed.data.altText })
    .eq('id', parsed.data.mediaId)
    .eq('user_id', user.id)
    .select('trip_id')
    .maybeSingle()

  if (error) return { ok: false, error: `Could not save: ${error.message}` }
  if (!data) return { ok: false, error: 'That photo no longer exists.' }

  if (data.trip_id) revalidatePath(`/trips/${data.trip_id}/vault`)
  return { ok: true }
}

/**
 * Makes a photo the trip's cover.
 *
 * One action sets two things on purpose: `trips.cover_media_id`, which is the
 * trip's hero, and `media.is_featured`, which is what
 * `refresh_visited_regions()` picks up as the region's photo on the globe.
 * Splitting them into two buttons would ask the writer to understand the
 * aggregate.
 */
export async function setCoverPhoto(mediaId: string): Promise<MediaActionResult> {
  const user = await requireUser()

  if (!UUID_RE.test(mediaId)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { data: photo } = await supabase
    .from('media')
    .select('id, trip_id')
    .eq('id', mediaId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!photo?.trip_id) {
    return { ok: false, error: 'That photo is not attached to a trip.' }
  }

  // One featured photo per trip, so the previous one steps down first.
  await supabase
    .from('media')
    .update({ is_featured: false })
    .eq('user_id', user.id)
    .eq('trip_id', photo.trip_id)
    .neq('id', mediaId)

  const [{ error: featureError }, { error: coverError }] = await Promise.all([
    supabase.from('media').update({ is_featured: true }).eq('id', mediaId).eq('user_id', user.id),
    supabase
      .from('trips')
      .update({ cover_media_id: mediaId })
      .eq('id', photo.trip_id)
      .eq('user_id', user.id),
  ])

  if (featureError || coverError) {
    return { ok: false, error: `Could not set the cover: ${(featureError ?? coverError)!.message}` }
  }

  revalidatePath(`/trips/${photo.trip_id}/vault`)
  revalidatePath(`/trips/${photo.trip_id}`)
  revalidatePath('/globe')
  return { ok: true }
}

/**
 * Takes the cover off a trip, leaving the photograph alone.
 *
 * The other half of `setCoverPhoto`, and it has to exist for the cover picker
 * in the trip wizard to be a control rather than a one-way door: without it the
 * only way out of a cover you regret is choosing a different one, and a trip
 * that should simply have no hero has no way back.
 *
 * Clears both things `setCoverPhoto` sets, for the same reason it sets both —
 * `trips.cover_media_id` is the trip's hero and `media.is_featured` is what
 * `refresh_visited_regions()` reads for the region's photo on the globe, and
 * leaving one behind would put the two out of step in a way nothing on screen
 * would explain.
 */
export async function clearCoverPhoto(tripId: string): Promise<MediaActionResult> {
  const user = await requireUser()

  if (!UUID_RE.test(tripId)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('trips')
    .update({ cover_media_id: null })
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (error) return { ok: false, error: `Could not remove the cover: ${error.message}` }

  // Best-effort, and after the trip row: a stranded `is_featured` only affects
  // which photo the globe picks, while a cover pointing at nothing is what the
  // trip page would render as a broken hero.
  await supabase
    .from('media')
    .update({ is_featured: false })
    .eq('user_id', user.id)
    .eq('trip_id', tripId)

  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/edit`)
  revalidatePath(`/trips/${tripId}/vault`)
  revalidatePath('/globe')
  return { ok: true }
}

/**
 * Soft-deletes a photo and removes the stored object.
 *
 * The row is kept so the counters can be recomputed and the trip's history still
 * knows a photo was there, but the bytes go immediately, because storage is the
 * thing being paid for and "deleted" should stop costing the user their pool.
 *
 * That trade is why a photo is **not** restorable while a trip is: there is no
 * object left to point at. `/trash` says so rather than offering a button that
 * would produce a broken image, and the vault asks before it deletes.
 *
 * It goes through `soft_delete_media()` for the same reason trips do: a direct
 * update setting `deleted_at` is refused by RLS, because the updated row no
 * longer satisfies `media_select_own`. See migration 20260812000300.
 */
export async function deleteMedia(mediaId: string): Promise<MediaActionResult> {
  const user = await requireUser()

  if (!UUID_RE.test(mediaId)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { data: photo } = await supabase
    .from('media')
    .select('id, trip_id, storage_path')
    .eq('id', mediaId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!photo) {
    return { ok: false, error: 'That photo no longer exists.' }
  }

  const { data: deleted, error } = await supabase.rpc('soft_delete_media', {
    p_media_id: mediaId,
  })

  if (error) {
    return { ok: false, error: `Could not delete: ${error.message}` }
  }

  if (!deleted) {
    return { ok: false, error: 'That photo no longer exists.' }
  }

  // The object is the user's own — the storage policy keys on the first path
  // segment being their id — so this needs no elevated client. The display copy
  // goes with it: it is derived from the original's key, so it can always be
  // named, and `remove` ignores a key that was never written.
  await supabase.storage.from('media').remove([photo.storage_path, displayPath(photo.storage_path)])

  if (photo.trip_id) {
    revalidatePath(`/trips/${photo.trip_id}/vault`)
    revalidatePath(`/trips/${photo.trip_id}`)
  }
  revalidatePath('/dashboard')
  revalidatePath('/globe')
  return { ok: true }
}

const memoryInput = z.object({
  tripId: z.uuid(),
  kind: z.enum(['note', 'quote', 'favorite_location']),
  body: z.string().trim().min(1, { error: 'Write something first' }).max(2000),
  happenedAt: z.string().nullable(),
})

/** Text memories: the part of the vault that costs nothing and is unlimited. */
export async function addMemory(input: z.input<typeof memoryInput>): Promise<MediaActionResult> {
  const user = await requireUser()

  const parsed = memoryInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check that note.' }
  }

  const { tripId, kind, body, happenedAt } = parsed.data
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) {
    return { ok: false, error: 'That trip is not yours to write in.' }
  }

  const { error } = await supabase.from('memories').insert({
    user_id: user.id,
    trip_id: tripId,
    kind,
    body,
    happened_at: happenedAt || null,
  })

  if (error) {
    return { ok: false, error: `Could not save that note: ${error.message}` }
  }

  revalidatePath(`/trips/${tripId}/vault`)
  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/globe')
  return { ok: true }
}

export async function deleteMemory(memoryId: string): Promise<MediaActionResult> {
  const user = await requireUser()

  if (!UUID_RE.test(memoryId)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memories')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', user.id)
    .select('trip_id')
    .maybeSingle()

  if (error) return { ok: false, error: `Could not delete: ${error.message}` }
  if (!data) return { ok: false, error: 'That note no longer exists.' }

  revalidatePath(`/trips/${data.trip_id}/vault`)
  revalidatePath(`/trips/${data.trip_id}`)
  return { ok: true }
}
