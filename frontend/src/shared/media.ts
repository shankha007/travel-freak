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
