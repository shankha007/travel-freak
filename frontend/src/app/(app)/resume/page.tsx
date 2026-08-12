import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Luggage, MapPin } from 'lucide-react'
import { getOwnProfile, getResumeData } from '@/server/queries/resume'
import { requireUser } from '@/server/auth'
import { SITE_URL } from '@/shared/brand'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import { ResumeStatsGrid } from '@/client/components/resume/resume-stats'
import { SharePanel } from '@/client/components/resume/share-panel'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

export const metadata: Metadata = {
  title: 'Travel resume',
  description: 'Everything you have travelled, on one page you can share.',
}

export const dynamic = 'force-dynamic'

/**
 * The Travel Resume — screen 33, owner's view.
 *
 * The same numbers a visitor sees at `/u/[username]`, plus the controls that
 * decide whether that page exists at all. Keeping both on one screen means the
 * thing being shared and the decision to share it are never in two places.
 */
export default async function ResumePage() {
  const user = await requireUser()
  const profile = await getOwnProfile(user.id)

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Your profile could not be loaded.</p>
      </div>
    )
  }

  const resume = await getResumeData(profile, { viewerIsOwner: true })
  const { stats, trips, posts } = resume

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Travel resume</h1>
        <p className="text-sm text-muted-foreground">
          {stats.trips > 0
            ? `${stats.countries} ${stats.countries === 1 ? 'country' : 'countries'} across ${stats.trips} ${stats.trips === 1 ? 'trip' : 'trips'}, and counting.`
            : 'Add a trip and this fills in. It is the page worth sharing.'}
        </p>
      </header>

      <SharePanel
        username={profile.username}
        isPublic={profile.isPublic}
        displayName={profile.displayName}
        bio={profile.bio}
        siteUrl={SITE_URL}
      />

      <ResumeStatsGrid stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Luggage className="size-4" aria-hidden />
              Trips
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {trips.length}
              </span>
            </h2>

            {trips.length ? (
              <ul className="space-y-3">
                {trips.slice(0, 8).map((trip) => (
                  <li key={trip.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {trip.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span aria-hidden className="mr-1">
                          {trip.countryCodes.map(countryFlag).join(' ')}
                        </span>
                        {formatDateRange(trip.startDate, trip.endDate)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {trip.visibility}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No trips yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4" aria-hidden />
              Published posts
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {posts.length}
              </span>
            </h2>

            {posts.length ? (
              <ul className="space-y-3">
                {posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/b/${post.slug}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {post.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{post.readingMinutes} min read</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Nothing published yet. Published posts appear on your public page.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/blogs/new" />}
                >
                  Write a post
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {profile.countryCode && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          Based in {profile.city ? `${profile.city}, ` : ''}
          {countryName(profile.countryCode)}
        </p>
      )}
    </div>
  )
}
