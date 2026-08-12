import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  ImageOff,
  MapPin,
  NotebookPen,
  Trash2,
} from 'lucide-react'
import { getTrash } from '@/server/queries/trash'
import { formatDateRange } from '@/shared/format'
import { RETENTION_DAYS } from '@/shared/retention'
import { RestoreTripButton } from '@/client/components/trips/restore-trip-button'
import { RestoreBlogButton } from '@/client/components/blogs/restore-blog-button'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'

export const metadata: Metadata = {
  title: 'Trash',
  description: `Trips and posts you deleted in the last ${RETENTION_DAYS} days.`,
}

export const dynamic = 'force-dynamic'

/**
 * The trash — the screen the delete dialogs were promising.
 *
 * `restore_trip()` shipped with the trip screens and nothing called it, which
 * made "recoverable for 30 days" a claim the product could not keep. This is the
 * other half, for trips and posts.
 *
 * Photos are the deliberate exception, and the page ends by saying so: deleting
 * a photo releases its bytes immediately, because storage is what the plan
 * charges for, so there is nothing left to restore it from.
 */

function DaysLeft({ days }: { days: number }) {
  return (
    <Badge variant="outline" className="shrink-0 gap-1.5">
      <CalendarClock className="size-3" aria-hidden />
      {days} {days === 1 ? 'day' : 'days'} left
    </Badge>
  )
}

export default async function TrashPage() {
  const { trips, posts } = await getTrash()
  const empty = trips.length === 0 && posts.length === 0

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/trips" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Trips
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Trash2 className="size-5 text-muted-foreground" aria-hidden />
          Trash
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Deleting is reversible for {RETENTION_DAYS} days. A restored trip keeps everything it held
          — places, photos, notes and posts — repaints your globe, and counts against your plan
          again.
        </p>
      </header>

      {empty ? (
        <Card>
          <CardContent className="space-y-1 p-6 text-center">
            <p className="font-medium">Nothing here</p>
            <p className="text-sm text-muted-foreground">
              Trips and posts you delete show up here for {RETENTION_DAYS} days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {trips.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Trips
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {trips.map((trip) => (
                  <li key={trip.id}>
                    <Card className="h-full">
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h3 className="leading-tight font-medium">{trip.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {formatDateRange(trip.startDate, trip.endDate)}
                            </p>
                          </div>
                          <DaysLeft days={trip.daysLeft} />
                        </div>

                        {trip.summary && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {trip.summary}
                          </p>
                        )}

                        {/* What comes back with it. Counted server-side, because
                            a deleted trip's places are unreadable through RLS. */}
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <li className="flex items-center gap-1.5">
                            <MapPin className="size-3.5" aria-hidden />
                            {trip.placeCount} {trip.placeCount === 1 ? 'place' : 'places'}
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Camera className="size-3.5" aria-hidden />
                            {trip.photoCount} {trip.photoCount === 1 ? 'photo' : 'photos'}
                          </li>
                          <li className="flex items-center gap-1.5">
                            <NotebookPen className="size-3.5" aria-hidden />
                            {trip.postCount} {trip.postCount === 1 ? 'post' : 'posts'}
                          </li>
                        </ul>

                        <div className="mt-auto">
                          <RestoreTripButton tripId={trip.id} title={trip.title} />
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {posts.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                Posts
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {posts.map((post) => (
                  <li key={post.id}>
                    <Card className="h-full">
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h3 className="leading-tight font-medium">{post.title}</h3>
                            {/* Restoring does not change published_at, so a post
                                that was live goes back to being live. Better said
                                before the press than discovered after it. */}
                            <p className="text-sm text-muted-foreground">
                              {post.publishedAt
                                ? `Was published · goes back live as ${post.visibility}`
                                : 'Draft'}
                            </p>
                          </div>
                          <DaysLeft days={post.daysLeft} />
                        </div>

                        {post.excerpt && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {post.excerpt}
                          </p>
                        )}

                        <div className="mt-auto">
                          <RestoreBlogButton postId={post.id} title={post.title} />
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="flex max-w-2xl items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <ImageOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        Photos deleted one at a time are not here. Deleting a photo releases its storage immediately
        — that is what stops it counting against your plan — so there is no copy left to restore.
        Deleting a whole trip leaves its photos untouched.
      </p>
    </div>
  )
}
