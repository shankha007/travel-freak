import { ImageResponse } from 'next/og'
import { getPublicTrip } from '@/server/queries/public-trip'
import { countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import { BRAND } from '@/shared/brand'
import { OG_CONTENT_TYPE, OG_SIZE, countLabel, factLine } from '@/shared/og'
import { Card } from '@/server/og/card'
import { worldPaths } from '@/server/og/world'

/**
 * A public trip's share card — screen 38.
 *
 * Painted with the countries the trip actually reached, so the card for two
 * weeks in Japan is a different picture from the card for a road trip through
 * India.
 *
 * `getPublicTrip` reads through the visitor's client, so RLS decides whether
 * there is anything here at all. A private trip, or an unlisted one whose URL
 * somebody guessed, yields nothing and gets the generic card — the fallback is
 * not a nicety, it is what stops the title of a private trip being published in
 * an image by a route that never renders the page.
 *
 * Deliberately does *not* use the trip's cover photo: `generateMetadata` on the
 * page already prefers that when there is one, and this fills in when there is
 * not.
 */
export const alt = 'A trip'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const trip = await getPublicTrip(slug)

  // No trip means no permission to know one exists. Say nothing about it.
  if (!trip) {
    return new ImageResponse(
      <Card
        eyebrow="Travel, mapped"
        title="Every place you have been, on one globe."
        subtitle={BRAND.description}
        footnote={BRAND.domain}
      />,
      size
    )
  }

  const world = await worldPaths(trip.countryCodes, { width: OG_SIZE.width, height: 560 })

  const countries = trip.countryCodes.map(countryName)
  const subtitle = factLine([
    // Only when there are dates: `formatDateRange` answers "Dates not set",
    // which is a useful thing to say on a trip page and a strange thing to
    // publish on a share card.
    (trip.startDate || trip.endDate) && formatDateRange(trip.startDate, trip.endDate),
    countries.length <= 3
      ? countries.join(', ')
      : countLabel(countries.length, 'country', 'countries'),
    countLabel(trip.photos.length, 'photo'),
  ])

  return new ImageResponse(
    <Card
      eyebrow="Trip"
      title={trip.title}
      subtitle={subtitle}
      world={world}
      footnote={trip.author ? `${BRAND.domain} · @${trip.author.username}` : BRAND.domain}
    />,
    size
  )
}
