import { describe, expect, it } from 'vitest'
import {
  MAX_UPLOAD_BYTES,
  displayPath,
  extensionFor,
  isAllowedImageMime,
  mayServePostImage,
  needsDisplayCopy,
  postImagePath,
  postImageUrl,
  rejectionFor,
  sniffImageMime,
  storagePath,
} from './media'

/** Builds a header: signature bytes, padded out to 32. */
function header(...bytes: number[]): Uint8Array {
  const buf = new Uint8Array(32)
  buf.set(bytes)
  return buf
}

function withAscii(offset: number, text: string, ...prefix: number[]): Uint8Array {
  const buf = header(...prefix)
  for (let i = 0; i < text.length; i++) buf[offset + i] = text.charCodeAt(i)
  return buf
}

describe('isAllowedImageMime', () => {
  it('accepts the formats a phone produces', () => {
    expect(isAllowedImageMime('image/jpeg')).toBe(true)
    expect(isAllowedImageMime('image/heic')).toBe(true)
  })

  it('rejects video and anything dressed up as an image', () => {
    expect(isAllowedImageMime('video/mp4')).toBe(false)
    expect(isAllowedImageMime('image/svg+xml')).toBe(false)
    expect(isAllowedImageMime('application/pdf')).toBe(false)
  })
})

describe('extensionFor', () => {
  it('maps known types', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('image/webp')).toBe('webp')
  })

  it('falls back rather than producing an empty extension', () => {
    expect(extensionFor('application/octet-stream')).toBe('bin')
  })
})

describe('storagePath', () => {
  it('puts the owner id first, which is what the storage policy checks', () => {
    const path = storagePath('user-1', 'trip-2', 'media-3', 'image/jpeg')

    expect(path).toBe('user-1/trip-2/media-3.jpg')
    expect(path.split('/')[0]).toBe('user-1')
  })
})

describe('needsDisplayCopy', () => {
  it('is true only for the formats a browser cannot be relied on to draw', () => {
    expect(needsDisplayCopy('image/heic')).toBe(true)
    expect(needsDisplayCopy('image/heif')).toBe(true)
    expect(needsDisplayCopy('image/jpeg')).toBe(false)
    expect(needsDisplayCopy('image/webp')).toBe(false)
    expect(needsDisplayCopy('image/avif')).toBe(false)
  })
})

describe('displayPath', () => {
  it('keeps the owner id first, so the same storage policy covers it', () => {
    const path = displayPath(storagePath('user-1', 'trip-2', 'media-3', 'image/heic'))

    expect(path).toBe('user-1/trip-2/display/media-3.webp')
    expect(path.split('/')[0]).toBe('user-1')
  })

  it('does not sit beside the original, which confirmUpload searches for', () => {
    // `confirmUpload` finds a new object with a non-recursive
    // list(folder, { search: '<id>.' }); a sibling would be a second match.
    const original = storagePath('u', 't', 'm', 'image/heic')
    const copy = displayPath(original)

    expect(copy.slice(0, copy.lastIndexOf('/'))).not.toBe(
      original.slice(0, original.lastIndexOf('/'))
    )
  })

  it('handles a post image, which lives in no trip folder', () => {
    expect(displayPath(postImagePath('user-1', 'post-2', 'media-3', 'image/heif'))).toBe(
      'user-1/posts/post-2/display/media-3.webp'
    )
  })
})

describe('sniffImageMime', () => {
  it('identifies a JPEG', () => {
    expect(sniffImageMime(header(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  })

  it('identifies a PNG', () => {
    expect(sniffImageMime(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
  })

  it('identifies WebP by its RIFF container', () => {
    expect(sniffImageMime(withAscii(8, 'WEBP', 0x52, 0x49, 0x46, 0x46))).toBe('image/webp')
  })

  it('tells AVIF and HEIC apart by brand', () => {
    const avif = withAscii(8, 'avif')
    avif.set([0x66, 0x74, 0x79, 0x70], 4)
    expect(sniffImageMime(avif)).toBe('image/avif')

    const heic = withAscii(8, 'heic')
    heic.set([0x66, 0x74, 0x79, 0x70], 4)
    expect(sniffImageMime(heic)).toBe('image/heic')
  })

  it('rejects an HTML page uploaded under an image content type', () => {
    // The real failure this exists to catch: a 404 page saved as a .png.
    const html = new TextEncoder().encode('<!DOCTYPE html><html><head><title>404')
    expect(sniffImageMime(html)).toBeNull()
  })

  it('rejects an SVG, which is script-capable and deliberately not allowed', () => {
    expect(sniffImageMime(new TextEncoder().encode('<svg xmlns="http://www.w3'))).toBeNull()
  })

  it('rejects an empty or truncated header', () => {
    expect(sniffImageMime(new Uint8Array(0))).toBeNull()
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })
})

describe('rejectionFor', () => {
  const ok = { name: 'leh.jpg', type: 'image/jpeg', size: 2_000_000 }

  it('passes an ordinary photo', () => {
    expect(rejectionFor(ok)).toBeNull()
  })

  it('rejects the wrong type', () => {
    expect(rejectionFor({ ...ok, type: 'video/mp4' })).toMatch(/Only images/)
  })

  it('rejects a file over the per-file ceiling', () => {
    expect(rejectionFor({ ...ok, size: MAX_UPLOAD_BYTES + 1 })).toMatch(/Too large/)
  })

  it('rejects an empty file', () => {
    expect(rejectionFor({ ...ok, size: 0 })).toMatch(/empty/)
  })
})

describe('postImageUrl', () => {
  it('names the media row, not an object key', () => {
    // The bytes have to be free to move between buckets without every post that
    // references them going stale, and the URL lives in stored HTML for ever.
    expect(postImageUrl('8b1d6a2c-0f4e-4a7b-9c3d-5e6f7a8b9c0d')).toBe(
      '/api/post-images/8b1d6a2c-0f4e-4a7b-9c3d-5e6f7a8b9c0d'
    )
  })

  it('stays relative, so no host is baked into a database row', () => {
    expect(postImageUrl('x')).not.toMatch(/^https?:/)
  })
})

describe('mayServePostImage', () => {
  const published = {
    isOwner: false,
    visibility: 'public' as const,
    publishedAt: '2026-08-01T00:00:00Z',
    deletedAt: null,
  }

  it('serves a published public post to anyone', () => {
    expect(mayServePostImage(published)).toBe(true)
  })

  it('serves a published unlisted post, the same as its share link does', () => {
    // `resolve_post_share_link()` resolves while the post is unlisted-or-public
    // and published. An image is part of the post, so the conditions match: a
    // stricter rule here would break every picture in a shared draft-turned-link.
    expect(mayServePostImage({ ...published, visibility: 'unlisted' })).toBe(true)
  })

  it('refuses an unpublished post — the gap this closes', () => {
    expect(mayServePostImage({ ...published, publishedAt: null })).toBe(false)
  })

  it('refuses a private post even once published', () => {
    expect(mayServePostImage({ ...published, visibility: 'private' })).toBe(false)
  })

  it('refuses a deleted post', () => {
    expect(mayServePostImage({ ...published, deletedAt: '2026-08-02T00:00:00Z' })).toBe(false)
  })

  it('serves the author their own draft', () => {
    // The studio renders the document being written. A draft whose pictures 404
    // for its own author is not a draft anybody can edit.
    expect(
      mayServePostImage({
        isOwner: true,
        visibility: 'private',
        publishedAt: null,
        deletedAt: null,
      })
    ).toBe(true)
  })

  it('refuses even the author once the post is in the trash', () => {
    expect(
      mayServePostImage({
        isOwner: true,
        visibility: 'public',
        publishedAt: '2026-08-01T00:00:00Z',
        deletedAt: '2026-08-02T00:00:00Z',
      })
    ).toBe(false)
  })
})
