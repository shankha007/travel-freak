import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BookOpen,
  CalendarDays,
  Clock,
  Globe2,
  LinkIcon,
  MapPin,
  Quote,
  Sparkles,
  Users,
} from 'lucide-react'
import { getPublicTrip, getSharedTrip, type PublicTrip } from '@/server/queries/public-trip'
import { BRAND, SITE_URL } from '@/shared/brand'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { TripRouteMap } from '@/client/components/trips/route-map'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Public trip — screen 37.
 *
 * Reached two ways: `/t/[slug]` for a published public trip, or the same URL
 * with `?k=<token>` for an unlisted one. The token path is what makes "anyone
 * with the link" real without making the trip public.
 *
 * Rendered per request. RLS decides what a visitor may see, so a cached copy
 * would be a cached copy of one visitor's permissions.
 */
export const dynamic = 'force-dynamic'

const MEMORY_ICON: Record<string, typeof Quote> = {
  quote: Quote,
  favorite_location: MapPin,
  note: Sparkles,
}

async function resolveTrip(
  params: Promise<{ slug: string }>,
  searchParams: Promise<{ k?: string }>
): Promise<PublicTrip | null> {
  const [{ slug }, { k }] = await Promise.all([params, searchParams])

  // The token wins when present: an unlisted trip has a slug too, and the link
  // is the only thing that authorises reading it.
  if (k) {
    const shared = await getSharedTrip(k)
    if (shared) return shared
  }

  return getPublicTrip(slug)
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/t/[slug]'>): Promise<Metadata> {
  const trip = await resolveTrip(params, searchParams)
  if (!trip) return { title: 'Trip not found', robots: { index: false, follow: false } }

  const isPublic = trip.visibility === 'public' && !trip.viaShareLink
  const description =
    trip.summary || `${trip.countryCodes.map(countryName).join(', ')} — a trip on ${BRAND.name}.`

  return {
    title: trip.title,
    description,
    alternates: isPublic ? { canonical: `${SITE_URL}/t/${trip.slug}` } : undefined,
    // An unlisted trip is shared, not published. It must never be indexed.
    robots: isPublic ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: trip.title,
      description,
      // The cover photo when there is one — a real picture of the place beats
      // any card we could draw. When there is not, the key is omitted entirely
      // rather than set to `undefined`: an explicit `images: undefined`
      // suppresses the colocated `opengraph-image.tsx`, which is how this page
      // ended up with no card at all for every trip without a cover.
      ...(trip.coverUrl ? { images: [trip.coverUrl] } : {}),
    },
  }
}

export default async function PublicTripPage({ params, searchParams }: PageProps<'/t/[slug]'>) {
  const trip = await resolveTrip(params, searchParams)

  // Covers "no such trip", "private", and "revoked link" with one answer.
  if (!trip) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: trip.title,
    description: trip.summary,
    image: trip.coverUrl ?? undefined,
    author: trip.author ? { '@type': 'Person', name: trip.author.displayName } : undefined,
    about: trip.countryCodes.map((code) => ({ '@type': 'Place', name: countryName(code) })),
    publisher: { '@type': 'Organization', name: BRAND.name },
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 md:px-6">
        {trip.viaShareLink && (
          <p className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <LinkIcon className="size-4 shrink-0" aria-hidden />
            Shared with you by link. This trip is not listed publicly.
          </p>
        )}

        <article className="space-y-8">
          <header className="space-y-3">
            <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance">
              {trip.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden />
                {formatDateRange(trip.startDate, trip.endDate)}
              </span>
              {trip.durationDays !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  {trip.durationDays} {trip.durationDays === 1 ? 'night' : 'nights'}
                </span>
              )}
              {trip.travelerCount > 1 && (
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden />
                  {trip.travelerCount} travellers
                </span>
              )}
              {trip.author && (
                <Link
                  href={`/u/${trip.author.username}`}
                  className="underline-offset-4 hover:underline"
                >
                  {trip.author.displayName}
                </Link>
              )}
            </div>

            {trip.countryCodes.length > 0 && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Globe2 className="size-3.5 text-muted-foreground" aria-hidden />
                <span aria-hidden>{trip.countryCodes.map(countryFlag).join(' ')}</span>
                <span className="text-muted-foreground">
                  {trip.countryCodes.map(countryName).join(' · ')}
                </span>
              </p>
            )}

            {trip.summary && <p className="text-lg text-muted-foreground">{trip.summary}</p>}
          </header>

          {trip.photos.length > 0 && (
            <section className="space-y-3">
              <h2 className="sr-only">Photos</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trip.photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                  >
                    <Image
                      src={photo.url}
                      alt={photo.altText || photo.caption || `Photo from ${trip.title}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 300px"
                      className="object-cover"
                    />
                    {photo.caption && (
                      <span className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
                        {photo.caption}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {/* Stated plainly: these are re-encoded copies, and the location
                  data the camera wrote never left the owner's account. */}
              <p className="text-xs text-muted-foreground">
                Photos are published as copies with their location data removed.
              </p>
            </section>
          )}

          {trip.places.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Route</h2>
              {/* The same map the owner sees on their own trip page, drawn from
                  the stops they pinned. Renders nothing when none of them is. */}
              <TripRouteMap stops={trip.places} />
              <ol className="relative space-y-4 border-l pl-6">
                {trip.places.map((place) => (
                  <li key={place.id} className="relative">
                    <span
                      className="absolute top-1.5 -left-[27px] size-2.5 rounded-full bg-primary ring-4 ring-background"
                      aria-hidden
                    />
                    <p className="font-medium">
                      <span aria-hidden className="mr-1.5">
                        {countryFlag(place.countryCode)}
                      </span>
                      {place.cityName || countryName(place.countryCode)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {place.cityName ? `${countryName(place.countryCode)} · ` : ''}
                      <span className="capitalize">{place.placeKind.replace('_', ' ')}</span>
                    </p>
                    {(place.arrivalDate || place.departureDate) && (
                      <p className="text-sm text-muted-foreground">
                        {formatDateRange(place.arrivalDate, place.departureDate)}
                      </p>
                    )}
                    {place.notes && <p className="pt-1 text-sm">{place.notes}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {trip.memories.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Notes</h2>
              <ul className="space-y-3">
                {trip.memories.map((memory) => {
                  const Icon = MEMORY_ICON[memory.kind] ?? Sparkles
                  return (
                    <li key={memory.id}>
                      <Card>
                        <CardContent className="flex gap-3 p-4">
                          <Icon
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <p className="text-sm">{memory.body}</p>
                        </CardContent>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {trip.posts.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="size-4" aria-hidden />
                Written about this trip
              </h2>
              <ul className="space-y-3">
                {trip.posts.map((post) => (
                  <li key={post.id}>
                    <Link href={`/b/${post.slug}`} className="group block">
                      <p className="font-medium underline-offset-4 group-hover:underline">
                        {post.title}
                      </p>
                      {post.excerpt && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {post.readingMinutes} min read
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm">
          {trip.author ? (
            <Link
              href={`/u/${trip.author.username}`}
              className="underline-offset-4 hover:underline"
            >
              <Badge variant="secondary">More from {trip.author.displayName}</Badge>
            </Link>
          ) : (
            <span />
          )}
          {trip.showsBadge && (
            <Link href="/" className="text-muted-foreground underline underline-offset-4">
              {BRAND.freePlanBadge}
            </Link>
          )}
        </footer>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
