/**
 * Rules about media files, shared by the uploader and the server.
 *
 * The client copy exists to fail fast and explain why; the server copy is the
 * one that decides. Both read from here so they cannot disagree about what a
 * valid photo is.
 */

/** What the uploader accepts today. Video and audio are Nomad, Phase 3. */
export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
] as const

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number]

/**
 * Per-file ceiling, independent of the plan's storage pool.
 *
 * A phone photo is 2–8 MB and a 45-megapixel RAW-ish JPEG lands near 25. This
 * is a guard against a mis-selected file, not a plan limit — those live in
 * `plans.limits`.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime)
}

/** File extension for a mime type, without the dot. */
export function extensionFor(mime: string): string {
  return EXTENSIONS[mime] ?? 'bin'
}

/**
 * Object key for a media file.
 *
 * The first path segment is the owner's id, because that is what the storage
 * policies check: `(storage.foldername(name))[1] = auth.uid()`. Changing this
 * shape means changing those policies too.
 */
export function storagePath(userId: string, tripId: string, mediaId: string, mime: string): string {
  return `${userId}/${tripId}/${mediaId}.${extensionFor(mime)}`
}

/**
 * Object key for a trip photo's public derivative, in the `media-public` bucket.
 *
 * Lives here with the other key builders rather than beside the code that writes
 * the object: it is the same kind of thing as `storagePath` and `displayPath`,
 * pure string arithmetic over ids, and keeping it importable without pulling in
 * the service-role client is what lets the batch logic be unit-tested.
 *
 * Always `.webp`, whatever the original was — the derivative is a re-encode and
 * the extension should not claim otherwise.
 */
export function derivativePath(userId: string, tripId: string, mediaId: string): string {
  return `${userId}/${tripId}/${mediaId}.webp`
}

/**
 * Object key for an image uploaded into a post.
 *
 * A post image belongs to no trip — `media.trip_id` is null — so it needs a
 * folder of its own. The first segment is still the owner's id, which is the only
 * part the storage policies read, so the same policies cover it unchanged.
 */
export function postImagePath(
  userId: string,
  postId: string,
  mediaId: string,
  mime: string
): string {
  return `${userId}/posts/${postId}/${mediaId}.${extensionFor(mime)}`
}

/**
 * Formats no browser can be relied on to decode.
 *
 * HEIC is what an iPhone writes by default, and outside Safari almost nothing
 * renders it. A public page never has the problem — publication re-encodes to
 * WebP — but the owner's own vault points at the original, so the person who
 * took the photograph is the one most likely to see an empty frame.
 */
const UNDISPLAYABLE_MIME = ['image/heic', 'image/heif']

export function needsDisplayCopy(mime: string): boolean {
  return UNDISPLAYABLE_MIME.includes(mime)
}

/**
 * Object key for a private, browser-readable copy of an original.
 *
 * The same folder as the original with a `display/` segment inserted, so the
 * first path segment is still the owner's id and the storage policies covering
 * the bucket cover this too, unchanged. The subfolder is not decoration:
 * `confirmUpload` finds a freshly uploaded object with a non-recursive
 * `list(folder, { search: '<id>.' })`, and a sibling `<id>.webp` would be a
 * second match for it.
 *
 * Derived from the original's key rather than stored on the row, so nothing has
 * to be migrated and every deletion path can compute what to remove.
 */
export function displayPath(originalPath: string): string {
  const cut = originalPath.lastIndexOf('/')
  const folder = originalPath.slice(0, cut)
  const file = originalPath.slice(cut + 1)
  const base = file.includes('.') ? file.slice(0, file.lastIndexOf('.')) : file
  return `${folder}/display/${base}.webp`
}

/**
 * The stable URL a post's stored HTML points an image at.
 *
 * Stable is the whole requirement. Whatever is written into `content_html` has
 * to keep resolving for as long as the post exists, which is why this cannot be
 * a signed URL — those expire within the hour — and why it names the media row
 * rather than an object key: the bytes can move between buckets without every
 * post that references them going stale.
 *
 * Relative on purpose. A post exported, re-imported, or read on a preview
 * deployment resolves against whatever origin is serving it, and no absolute
 * host gets baked into a database row.
 */
export function postImageUrl(mediaId: string): string {
  return `/api/post-images/${mediaId}`
}

/**
 * Whether a post's images may be served to this caller.
 *
 * Deliberately the same condition `resolve_post_share_link()` applies to the
 * post itself: published, not deleted, and not private. An image is part of the
 * post, so anything that can reach the post can reach its pictures and nothing
 * else can.
 *
 * The owner is the exception, and has to be: the studio renders the document
 * being written, and a draft whose pictures 404 for its own author is not a
 * draft anybody can edit.
 *
 * Note what is *not* here — an unpublished post is not readable by anyone but
 * its author, which is the whole point. Before this, the bytes sat in a
 * world-readable bucket from the moment they were uploaded.
 */
export function mayServePostImage(post: {
  isOwner: boolean
  visibility: 'private' | 'unlisted' | 'public'
  publishedAt: string | null
  deletedAt: string | null
}): boolean {
  if (post.isOwner) return post.deletedAt === null
  if (post.deletedAt !== null) return false
  if (post.publishedAt === null) return false
  return post.visibility !== 'private'
}

/**
 * Identifies an image from its leading bytes.
 *
 * A file's declared content type is a claim by whoever uploaded it — storage
 * records the header the client sent, nothing more. This reads the actual
 * signature, which is what the plan means by validating magic bytes rather than
 * the declared MIME. Returns null when the bytes are not an image this app
 * accepts, including the case that catches real mistakes: an HTML error page
 * uploaded under an image content type.
 *
 * 16 bytes is enough for every signature here; HEIC needs 12.
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)

  // JPEG: FF D8 FF
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'

  // RIFF....WEBP
  if (startsWith(0x52, 0x49, 0x46, 0x46) && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp'
  }

  // ISO base media: ....ftyp<brand>. AVIF and HEIC share the container.
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
  }

  return null
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

export interface FileRejection {
  fileName: string
  reason: string
}

/** Client-side pre-flight. The signing route repeats all of this. */
export function rejectionFor(file: { name: string; type: string; size: number }): string | null {
  if (!isAllowedImageMime(file.type)) {
    return 'Only images for now — JPEG, PNG, WebP, AVIF or HEIC.'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB per file.`
  }
  if (file.size === 0) {
    return 'That file is empty.'
  }
  return null
}
