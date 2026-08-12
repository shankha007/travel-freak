import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import exifr from 'exifr'
import { PUBLIC_MAX_EDGE_PX, toPublicDerivative } from './image-transform'

/**
 * These tests exist for one reason: a photo published to the web must not carry
 * what the camera recorded about where it was taken. Everything else here is
 * incidental.
 *
 * The check is done with exifr, the same parser the uploader uses to *read* GPS
 * off a photo on the way in. If the tool that finds coordinates cannot find any,
 * neither can anyone else using the same approach.
 */

/**
 * What exifr can find, or nothing.
 *
 * exifr throws rather than returning empty when a file has no metadata segment
 * at all, which is itself the answer we are looking for.
 */
async function readMetadata(buffer: Buffer): Promise<Record<string, unknown> | undefined> {
  try {
    // A Uint8Array, not the Buffer: these tests run in the jsdom environment,
    // where exifr takes its browser path and rejects Node buffers outright.
    return await exifr.parse(Uint8Array.from(buffer), {
      pick: ['Make', 'Software', 'latitude', 'longitude'],
    })
  } catch {
    return undefined
  }
}

/** A JPEG carrying an EXIF block — the container GPS travels in. */
async function photoWithExif(width = 60, height = 40): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#4488cc' } })
    .withExif({ IFD0: { Make: 'TestCam', Copyright: 'Test', Software: 'GPSWriter' } })
    .jpeg()
    .toBuffer()
}

describe('toPublicDerivative', () => {
  it('strips the EXIF block, which is where GPS lives', async () => {
    const original = await photoWithExif()

    // Guard the guard: if the fixture stopped carrying EXIF, the assertions
    // below would pass while proving nothing.
    expect((await sharp(original).metadata()).exif).toBeInstanceOf(Buffer)
    expect(await readMetadata(original)).toMatchObject({ Make: 'TestCam' })

    const derivative = await toPublicDerivative(original)

    expect((await sharp(derivative).metadata()).exif).toBeUndefined()
    expect(await readMetadata(derivative)).toBeUndefined()
  })

  it('leaves none of the original metadata in the bytes', async () => {
    const derivative = await toPublicDerivative(await photoWithExif())

    expect(derivative.includes(Buffer.from('TestCam'))).toBe(false)
    expect(derivative.includes(Buffer.from('GPSWriter'))).toBe(false)
  })

  it('converts to webp so HEIC and friends become displayable', async () => {
    const meta = await sharp(await toPublicDerivative(await photoWithExif())).metadata()

    expect(meta.format).toBe('webp')
  })

  it('caps the long edge', async () => {
    const large = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#123456' },
    })
      .jpeg()
      .toBuffer()

    const meta = await sharp(await toPublicDerivative(large)).metadata()

    expect(meta.width).toBe(PUBLIC_MAX_EDGE_PX)
    expect(meta.height).toBe(Math.round((2000 / 3000) * PUBLIC_MAX_EDGE_PX))
  })

  it('does not upscale a small photo', async () => {
    const small = await sharp({
      create: { width: 120, height: 80, channels: 3, background: '#654321' },
    })
      .jpeg()
      .toBuffer()

    const meta = await sharp(await toPublicDerivative(small)).metadata()

    expect(meta.width).toBe(120)
    expect(meta.height).toBe(80)
  })

  it('applies the orientation tag before discarding it', async () => {
    // Orientation 6 means "rotate 90°": a 60×40 photo is really 40×60. Once the
    // tag is stripped the pixels have to have been rotated already, or every
    // portrait phone photo would publish on its side.
    //
    // Set through `withMetadata`, not `withExif`: the latter writes the tag into
    // the EXIF block without sharp treating it as the image's orientation, so
    // the fixture would claim to be rotated while nothing read it.
    const rotated = await sharp({
      create: { width: 60, height: 40, channels: 3, background: '#abcdef' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()

    expect((await sharp(rotated).metadata()).orientation).toBe(6)

    const meta = await sharp(await toPublicDerivative(rotated)).metadata()

    expect(meta.width).toBe(40)
    expect(meta.height).toBe(60)
    expect(meta.orientation).toBeUndefined()
  })
})
