import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  Globe2,
  Images,
  ListChecks,
  MapPin,
  Pencil,
  Quote,
  Route,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { getTripDetail } from '@/server/queries/trip-detail'
import { getPlannerSummary } from '@/server/queries/planner'
import { formatMoney } from '@/shared/budget'
import { SITE_URL } from '@/shared/brand'
import { ShareTripCard } from '@/client/components/trips/share-trip-card'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card'
import { Separator } from '@/client/components/ui/separator'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/trips/[id]'>): Promise<Metadata> {
  const { id } = await params
  const trip = await getTripDetail(id)
  if (!trip) return { title: 'Trip not found' }
  return {
    title: trip.title,
    description: trip.summary || `A trip to ${trip.countryCodes.map(countryName).join(', ')}.`,
  }
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ongoing: 'default',
  completed: 'secondary',
  upcoming: 'outline',
  planning: 'outline',
}

const MEMORY_ICON: Record<string, typeof Quote> = {
  quote: Quote,
  favorite_location: MapPin,
  photo: Camera,
  note: Sparkles,
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default async function TripDetailPage({ params }: PageProps<'/trips/[id]'>) {
  const { id } = await params
  const trip = await getTripDetail(id)

  // Covers both "does not exist" and "not yours" — RLS returns nothing either
  // way, so the two are indistinguishable from here. That is deliberate.
  if (!trip) notFound()

  // Screens 21, 22 and 23 in three lines. Read after the trip rather than
  // alongside it, because there is nothing to summarise for a trip that turns
  // out not to be readable.
  const planner = await getPlannerSummary(trip.id)

  const plannerLinks = [
    {
      href: `/trips/${trip.id}/itinerary`,
      icon: Route,
      label: 'Itinerary',
      detail:
        planner.dayCount === 0
          ? 'Plan it day by day'
          : `${planner.dayCount} ${planner.dayCount === 1 ? 'day' : 'days'} · ${
              planner.itemCount
            } ${planner.itemCount === 1 ? 'entry' : 'entries'}`,
    },
    // Owners only, and omitted rather than disabled: `/budget` 404s for a
    // collaborator, and a card that leads to a 404 is worse than no card. It
    // also carried the planned figure in its own subtitle, so hiding the screen
    // while leaving the card would have leaked exactly what the screen hides.
    ...(trip.isOwner
      ? [
          {
            href: `/trips/${trip.id}/budget`,
            icon: Wallet,
            label: 'Budget',
            detail:
              planner.spent.length > 0
                ? `${planner.spent.map((s) => formatMoney(s.total, s.currency)).join(' + ')} spent`
                : trip.budgetPlanned !== null
                  ? `${formatMoney(trip.budgetPlanned, trip.currency)} planned, nothing spent yet`
                  : 'Set what it should cost',
          },
        ]
      : []),
    {
      href: `/trips/${trip.id}/packing`,
      icon: ListChecks,
      label: 'Packing',
      detail:
        planner.packing.total === 0
          ? 'Nothing to forget yet'
          : `${planner.packing.done} of ${planner.packing.total} done across ${
              planner.listCount
            } ${planner.listCount === 1 ? 'list' : 'lists'}`,
    },
    {
      href: `/trips/${trip.id}/people`,
      icon: Users,
      label: 'People',
      detail:
        planner.collaboratorCount === 0
          ? 'Plan it together'
          : `${planner.collaboratorCount} ${
              planner.collaboratorCount === 1 ? 'person' : 'people'
            } on this trip`,
    },
  ]

  // How much of the route can actually be drawn. A place recorded by name alone
  // carries no pin, and the note under the timeline says so rather than claiming
  // — as it used to, for every trip — that nothing here has coordinates at all.
  const pinnedPlaces = trip.places.filter((p) => p.lat !== null && p.lng !== null).length

  const stats = [
    { label: 'Countries', value: trip.countryCodes.length, icon: Globe2 },
    { label: 'Places', value: trip.places.length, icon: MapPin },
    {
      label: 'Days',
      value: trip.durationDays !== null ? trip.durationDays : '—',
      icon: Clock,
    },
    { label: 'Travellers', value: trip.travelerCount, icon: Users },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/trips" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Trips
        </Button>

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${trip.id}/edit`} />}
        >
          <Pencil className="size-4" aria-hidden />
          Edit
        </Button>
      </div>

      {/* Hero. A cover image goes here once media upload exists; until then the
          flags carry the identity of the trip. */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{trip.title}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[trip.status] ?? 'outline'} className="capitalize">
              {trip.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {trip.visibility}
            </Badge>
            {trip.tripType && (
              <Badge variant="outline" className="capitalize">
                {trip.tripType}
              </Badge>
            )}
          </div>
        </div>

        {trip.countryCodes.length > 0 && (
          <p className="text-sm">
            <span aria-hidden className="mr-1.5">
              {trip.countryCodes.map(countryFlag).join(' ')}
            </span>
            <span className="text-muted-foreground">
              {trip.countryCodes.map(countryName).join(' · ')}
            </span>
          </p>
        )}

        {trip.summary && <p className="max-w-2xl text-muted-foreground">{trip.summary}</p>}
      </header>

      {/* Stats */}
      <section aria-label="Trip stats">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <li key={label}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-1 p-4">
                  <span className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </span>
                  <span className="text-2xl leading-tight font-semibold tabular-nums">{value}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* The planner. Three screens that belong to this trip and are only
          reachable from it — a bin of sub-routes in the sidebar would be
          meaningless without a trip in hand. */}
      <section aria-label="Planner">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plannerLinks.map(({ href, icon: Icon, label, detail }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-accent"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block truncate text-sm text-muted-foreground">{detail}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Route */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route</CardTitle>
            </CardHeader>
            <CardContent>
              {trip.places.length ? (
                <ol className="relative space-y-4 border-l pl-6">
                  {trip.places.map((place) => (
                    <li key={place.id} className="relative">
                      {/* Timeline dot, pulled onto the border line. */}
                      <span
                        className="absolute top-1.5 -left-[27px] size-2.5 rounded-full bg-primary ring-4 ring-background"
                        aria-hidden
                      />
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          <span aria-hidden className="mr-1.5">
                            {countryFlag(place.countryCode)}
                          </span>
                          {place.cityName || countryName(place.countryCode)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {place.cityName ? `${countryName(place.countryCode)} · ` : ''}
                          <span className="capitalize">{place.placeKind.replace('_', ' ')}</span>
                          {place.regionCode ? ` · ${place.regionCode}` : ''}
                        </p>
                        {(place.arrivalDate || place.departureDate) && (
                          <p className="text-sm text-muted-foreground">
                            {formatDateRange(place.arrivalDate, place.departureDate)}
                          </p>
                        )}
                        {place.notes && <p className="pt-1 text-sm">{place.notes}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No places on this trip yet, so it paints nothing on the globe.
                </p>
              )}

              {trip.places.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {pinnedPlaces === 0 ? (
                    'No stop here carries a pin yet, so there is nothing to draw on a map. Add one from Edit.'
                  ) : (
                    <>
                      {pinnedPlaces === trip.places.length
                        ? 'Every stop carries a pin'
                        : `${pinnedPlaces} of ${trip.places.length} stops ${
                            pinnedPlaces === 1 ? 'carries' : 'carry'
                          } a pin`}
                      {' — the '}
                      <Link
                        href={`/trips/${trip.id}/vault`}
                        className="underline underline-offset-2"
                      >
                        vault&rsquo;s map
                      </Link>
                      {' draws them in visit order.'}
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Memories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Memories
                {trip.memories.length > 0 && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums">
                    {trip.memories.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trip.memories.length ? (
                <ul className="space-y-4">
                  {trip.memories.map((memory) => {
                    const Icon = MEMORY_ICON[memory.kind] ?? Sparkles
                    return (
                      <li key={memory.id} className="flex gap-3">
                        <Icon
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm">{memory.body}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="capitalize">{memory.kind.replace('_', ' ')}</span>
                            {memory.happenedAt && (
                              <>
                                {' · '}
                                <time dateTime={memory.happenedAt}>
                                  {new Date(memory.happenedAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </time>
                              </>
                            )}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing written down yet. Notes, quotes and favourite spots show up here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Gallery */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Gallery</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={`/trips/${trip.id}/vault`} />}
              >
                Open vault
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {trip.photos.length > 0 ? (
                <>
                  <ul className="grid grid-cols-3 gap-1.5">
                    {trip.photos.map((photo) => (
                      <li key={photo.id}>
                        <Link
                          href={`/trips/${trip.id}/vault`}
                          className="relative block aspect-square overflow-hidden rounded-md bg-muted"
                        >
                          <Image
                            src={photo.url}
                            alt={photo.altText || photo.caption || 'Trip photo'}
                            fill
                            sizes="120px"
                            className="object-cover"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Camera className="size-3.5" aria-hidden />
                        Photos
                      </span>
                      <span className="tabular-nums">{trip.photoCount}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">Storage used</span>
                      <span className="tabular-nums">{formatBytes(trip.mediaBytes)}</span>
                    </li>
                  </ul>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <Images className="size-6 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">No photos yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/trips/${trip.id}/vault`} />}
                  >
                    Add photos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <ShareTripCard
            tripId={trip.id}
            slug={trip.slug}
            visibility={trip.visibility}
            existingToken={trip.shareToken}
            siteUrl={SITE_URL}
          />

          {/* Linked blogs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Blogs</CardTitle>
            </CardHeader>
            <CardContent>
              {trip.blogs.length ? (
                <ul className="space-y-3">
                  {trip.blogs.map((blog) => (
                    <li key={blog.id} className="space-y-1">
                      {/* Drafts are linked too: the reader shows the author
                          their own unpublished posts behind a notice. */}
                      <p className="flex items-start gap-2 text-sm font-medium">
                        <BookOpen
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <Link
                          href={`/b/${blog.slug}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {blog.title}
                        </Link>
                      </p>
                      {blog.excerpt && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{blog.excerpt}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {blog.readingMinutes} min read ·{' '}
                        <span className="capitalize">{blog.visibility}</span>
                        {!blog.publishedAt && ' · draft'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No blog written for this trip yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden />
                    Dates
                  </dt>
                  <dd className="text-right">{formatDateRange(trip.startDate, trip.endDate)}</dd>
                </div>

                {trip.budgetPlanned !== null && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="size-3.5" aria-hidden />
                      Planned budget
                    </dt>
                    <dd className="tabular-nums">
                      {trip.currency} {trip.budgetPlanned.toLocaleString('en-IN')}
                    </dd>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Cities</dt>
                  <dd className="text-right">
                    {trip.cityNames.length ? trip.cityNames.join(', ') : '—'}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>
                    <time dateTime={trip.createdAt}>
                      {new Date(trip.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
