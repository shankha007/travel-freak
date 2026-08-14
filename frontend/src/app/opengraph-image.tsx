import { ImageResponse } from 'next/og'
import { DEMO_REGIONS } from '@/client/features/globe/fixtures'
import { BRAND } from '@/shared/brand'
import { OG_CONTENT_TYPE, OG_SIZE } from '@/shared/og'
import { Card } from '@/server/og/card'
import { worldPaths } from '@/server/og/world'

/**
 * The card every page without one of its own gets — screen 38.
 *
 * `opengraph-image.tsx` rather than a route under `/api/og`, which is what the
 * plan called it: the file convention generates the absolute URL, the size and
 * type metadata and the cache headers, and wires them into every page beneath
 * it. Hand-rolling that meant hand-rolling the metadata too, and a share card
 * nobody references is a share card nobody sees.
 *
 * Painted with the same demo regions as the landing page's globe, so the card
 * and the page a visitor lands on are showing the same world.
 */
export const alt = `${BRAND.name} — ${BRAND.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  const world = await worldPaths(
    DEMO_REGIONS.filter((r) => r.state === 'visited' || r.state === 'current').map(
      (r) => r.countryCode
    ),
    { width: OG_SIZE.width, height: 560 }
  )

  return new ImageResponse(
    <Card
      eyebrow="Travel, mapped"
      title="Every place you have been, on one globe."
      subtitle={BRAND.description}
      world={world}
      footnote={BRAND.domain}
    />,
    size
  )
}
