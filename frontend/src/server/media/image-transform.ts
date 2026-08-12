import sharp from 'sharp'

/**
 * The image transform behind every public derivative.
 *
 * Deliberately not marked `server-only`, unlike the module that uses it: sharp
 * is a native dependency that could never run in a browser anyway, and keeping
 * this importable means the safety property below can be tested directly rather
 * than asserted in a comment.
 *
 * That property is the point of the whole file. A photo published to the web
 * must not carry the metadata the camera wrote — EXIF GPS on a holiday photo
 * taken at home pins the photographer's front door, which the plan treats as a
 * safety issue rather than a nicety. Re-encoding drops every metadata block,
 * which is stronger than editing the original's container: there is no
 * format-specific parsing to get subtly wrong, and HEIC — which most browsers
 * cannot display — comes out as something they can.
 */

/** Long edge of a public derivative. Fills a hero, small enough to send. */
export const PUBLIC_MAX_EDGE_PX = 1600

/** Survives a full-width hero without doubling the bytes. */
const WEBP_QUALITY = 82

/**
 * Re-encodes an image for publication: resized, rotated upright, and stripped.
 *
 * Rotation is applied *before* the EXIF is discarded, so a portrait photo does
 * not come out on its side once the orientation tag it depended on is gone.
 */
export async function toPublicDerivative(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: PUBLIC_MAX_EDGE_PX,
      height: PUBLIC_MAX_EDGE_PX,
      fit: 'inside',
      // A small photo should not be upscaled into a blurry one to hit the target.
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}
