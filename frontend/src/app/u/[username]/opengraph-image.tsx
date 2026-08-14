import { ImageResponse } from 'next/og'
import { getProfileByUsername, getResumeData } from '@/server/queries/resume'
import { BRAND } from '@/shared/brand'
import { OG_CONTENT_TYPE, OG_SIZE, countLabel, factLine } from '@/shared/og'
import { Card } from '@/server/og/card'
import { worldPaths } from '@/server/og/world'

/**
 * A public profile's share card — screen 38, and the one the plan was written
 * for: somebody's actual globe, in a picture, in someone else's timeline.
 *
 * Painted from `visited_regions`, the same aggregate the globe on the page
 * reads, so the card and the page agree about which countries are green.
 *
 * A private profile returns nothing from `getProfileByUsername` — RLS again —
 * and gets the generic card. That matters more here than anywhere else: the
 * whole point of a private profile is that its existence is not a fact
 * strangers get to have, and an image endpoint that answered differently for
 * "no such user" and "user who would rather you did not know" would hand that
 * out to anyone who could guess a username.
 */
export const alt = 'A travel resume'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

function fallback() {
  return new ImageResponse(
    <Card
      eyebrow="Travel, mapped"
      title="Every place you have been, on one globe."
      subtitle={BRAND.description}
      footnote={BRAND.domain}
    />,
    OG_SIZE
  )
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile || !profile.isPublic) return fallback()

  const resume = await getResumeData(profile, { viewerIsOwner: false })

  const visited = resume.regions
    .filter((r) => r.state === 'visited' || r.state === 'current')
    .map((r) => r.countryCode)

  const world = await worldPaths(visited, { width: OG_SIZE.width, height: 560 })

  const subtitle = factLine([
    countLabel(resume.stats.countries, 'country', 'countries'),
    countLabel(resume.stats.trips, 'trip'),
    countLabel(resume.stats.travelDays, 'day away', 'days away'),
    countLabel(resume.stats.yearsTravelling, 'year travelling', 'years travelling'),
  ])

  return new ImageResponse(
    <Card
      eyebrow="Travel resume"
      title={profile.displayName || `@${profile.username}`}
      subtitle={subtitle || profile.bio}
      world={world}
      footnote={`${BRAND.domain}/u/${profile.username}`}
    />,
    size
  )
}
