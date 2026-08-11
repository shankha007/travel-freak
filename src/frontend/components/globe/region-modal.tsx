'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, ImageOff, MapPin, Plane } from 'lucide-react'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { REGION_STATE_META } from '@/shared/geo/region-state'
import type { RegionDetail } from '@/shared/types/globe'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/frontend/components/ui/dialog'
import { Badge } from '@/frontend/components/ui/badge'
import { Button } from '@/frontend/components/ui/button'
import { Skeleton } from '@/frontend/components/ui/skeleton'
import { formatDateRange } from '@/shared/format'
import { cn } from '@/shared/utils'

interface RegionModalProps {
  countryCode: string | null
  detail: RegionDetail | null
  isLoading: boolean
  onClose: () => void
}

/**
 * The payoff for clicking a country: hero photo, what you did there, and a way
 * into the full trip or blog post.
 *
 * Opened from the globe, the region list, and directly via `?region=XXX` — the
 * deep link is what makes an individual country shareable.
 */
export function RegionModal({ countryCode, detail, isLoading, onClose }: RegionModalProps) {
  const open = countryCode !== null
  const name = detail?.countryName ?? countryName(countryCode)
  const flag = countryFlag(countryCode)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden p-0 sm:max-w-xl">
        <div className="relative aspect-[16/9] w-full bg-muted">
          {isLoading ? (
            <Skeleton className="size-full rounded-none" />
          ) : detail?.featuredMediaUrl ? (
            <Image
              src={detail.featuredMediaUrl}
              alt={`Photo from ${name}`}
              fill
              sizes="(max-width: 640px) 100vw, 576px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="size-7" aria-hidden />
              <p className="text-xs">No photo yet</p>
            </div>
          )}
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              {flag && (
                <span aria-hidden className="text-xl">
                  {flag}
                </span>
              )}
              {name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Your trips and memories from {name}.
            </DialogDescription>

            {isLoading ? (
              <Skeleton className="h-5 w-40" />
            ) : detail ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <span
                    className={cn('size-2 rounded-full', REGION_STATE_META[detail.state].fillClass)}
                    aria-hidden
                  />
                  {REGION_STATE_META[detail.state].label}
                </Badge>
                {detail.visitCount > 0 && (
                  <Badge variant="outline" className="gap-1.5">
                    <Plane className="size-3" aria-hidden />
                    {detail.visitCount} {detail.visitCount === 1 ? 'trip' : 'trips'}
                  </Badge>
                )}
                {(detail.firstVisit || detail.lastVisit) && (
                  <Badge variant="outline" className="gap-1.5">
                    <CalendarDays className="size-3" aria-hidden />
                    {formatDateRange(detail.firstVisit, detail.lastVisit)}
                  </Badge>
                )}
              </div>
            ) : null}
          </DialogHeader>

          {!isLoading && detail && detail.cityNames.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Places
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {detail.cityNames.map((city) => (
                  <li
                    key={city}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                  >
                    <MapPin className="size-3" aria-hidden />
                    {city}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!isLoading && detail && detail.trips.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {/* A country with several visits reads as a timeline, newest first. */}
                {detail.trips.length > 1 ? 'Your trips here' : 'Your trip'}
              </h3>
              <ul className="space-y-2">
                {detail.trips.map((trip) => (
                  <li key={trip.id}>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <p className="text-sm font-medium">{trip.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(trip.startDate, trip.endDate)}
                      </p>
                      {trip.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {trip.summary}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!isLoading && detail && detail.memories.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Memories
              </h3>
              <ul className="space-y-2">
                {detail.memories.slice(0, 4).map((memory) => (
                  <li
                    key={memory.id}
                    className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic"
                  >
                    {memory.body}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!isLoading && detail && detail.trips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Base UI composes via `render`, not Radix's `asChild`. These
                  render as links, so nativeButton must be false — otherwise Base
                  UI applies native button semantics to an <a>, which breaks
                  keyboard and screen-reader behaviour. */}
              {detail.trips[0].blogSlug && (
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/b/${detail.trips[0].blogSlug}`} />}
                >
                  Read the blog
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/trips/${detail.trips[0].id}/vault`} />}
              >
                View gallery
              </Button>
            </div>
          )}

          {!isLoading && detail && detail.trips.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded here yet.{' '}
              <Link href="/trips/new" className="text-primary underline underline-offset-4">
                Add a trip
              </Link>
              .
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
