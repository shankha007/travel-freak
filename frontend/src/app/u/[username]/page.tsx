import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, Clock, MapPin } from 'lucide-react'
import { getProfileByUsername, getResumeData } from '@/server/queries/resume'
import { getSessionUser } from '@/server/auth'
import { BRAND, SITE_URL } from '@/shared/brand'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import { ResumeStatsGrid } from '@/client/components/resume/resume-stats'
import { PublicGlobe } from '@/client/components/resume/public-globe'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Public profile and Travel Resume — screens 33 and 36.
 *
 * Rendered per request rather than statically: RLS decides what is visible, so
 * a cached copy would be a cached copy of one visitor's permissions. The owner
 * viewing their own private profile sees it; everyone else gets a 404 for the
 * same URL, which is the same shape of answer as a username that does not
 * exist.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile || !profile.isPublic) {
    return { title: 'Profile not found', robots: { index: false, follow: false } }
  }

  const title = `${profile.displayName} — travel resume`
  const description =
    profile.bio || `Countries, trips and stories from ${profile.displayName} on ${BRAND.name}.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/u/${profile.username}` },
    openGraph: { type: 'profile', title, description },
  }
}

export default async function PublicProfilePage({ params }: PageProps<'/u/[username]'>) {
  const { username } = await params
  const [profile, viewer] = await Promise.all([getProfileByUsername(username), getSessionUser()])

  // RLS returns nothing for a private profile unless the caller owns it, so
  // this covers "no such user" and "not shared" with one answer.
  if (!profile) notFound()

  const isOwner = viewer?.id === profile.id
  if (!profile.isPublic && !isOwner) notFound()

  const resume = await getResumeData(profile, { viewerIsOwner: isOwner })
  const { stats, regions, trips, posts, showsBadge } = resume

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.displayName,
    alternateName: profile.username,
    description: profile.bio || undefined,
    image: profile.avatarUrl || undefined,
    url: `${SITE_URL}/u/${profile.username}`,
    homeLocation: profile.countryCode
      ? { '@type': 'Place', name: countryName(profile.countryCode) }
      : undefined,
  }

  const initials =
    profile.displayName
      .split(' ')
      .map((word) => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'T'

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 md:px-6">
        {/* Only the owner ever sees this: everyone else got a 404 above. */}
        {!profile.isPublic && isOwner && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            This is how your profile will look. It is private right now — turn it on from your{' '}
            <Link href="/resume" className="underline underline-offset-4">
              travel resume
            </Link>
            .
          </p>
        )}

        <section className="flex flex-wrap items-start gap-4">
          <Avatar className="size-16">
            {profile.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt={`${profile.displayName}'s avatar`} />
            )}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>

            {profile.bio && <p className="max-w-prose text-muted-foreground">{profile.bio}</p>}

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {profile.countryCode && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  {profile.city ? `${profile.city}, ` : ''}
                  {countryName(profile.countryCode)}
                </span>
              )}
              {profile.interests.slice(0, 4).map((interest) => (
                <Badge key={interest} variant="secondary" className="capitalize">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <ResumeStatsGrid stats={stats} />

        {regions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Where {profile.displayName} has been</h2>
            <PublicGlobe regions={regions} />
          </section>
        )}

        {trips.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Trips</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trips.slice(0, 9).map((trip) => (
                <li key={trip.id}>
                  <Card className="h-full overflow-hidden p-0">
                    {trip.coverUrl && (
                      <div className="relative aspect-[16/9] w-full bg-muted">
                        <Image
                          src={trip.coverUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, 320px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="space-y-1 p-4">
                      <p className="font-medium">{trip.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <span aria-hidden className="mr-1">
                          {trip.countryCodes.map(countryFlag).join(' ')}
                        </span>
                        {formatDateRange(trip.startDate, trip.endDate)}
                      </p>
                      {trip.summary && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{trip.summary}</p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
            {/* Public trip pages are screen 37 and not built yet, so these are
                cards rather than links — a dead link is worse than none. */}
          </section>
        )}

        {posts.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4" aria-hidden />
              Writing
            </h2>
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link href={`/b/${post.slug}`} className="group block">
                    <p className="font-medium underline-offset-4 group-hover:underline">
                      {post.title}
                    </p>
                    {post.excerpt && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {post.readingMinutes} min read
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {stats.trips === 0 && (
          <p className="text-sm text-muted-foreground">
            {profile.displayName} has not published any trips yet.
          </p>
        )}

        {/* The no-ads growth loop: free public pages carry the badge, and paid
            plans do not. `shows_branding_badge()` answers that without exposing
            anyone's subscription. */}
        {showsBadge && (
          <footer className="border-t pt-6">
            <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
              {BRAND.freePlanBadge}
            </Link>
          </footer>
        )}
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
