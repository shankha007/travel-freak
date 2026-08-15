import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CalendarDays,
  Globe2,
  Luggage,
  MapPin,
  NotebookPen,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getDashboardStats, getRecentActivity, getUpcomingTrip } from '@/server/queries/dashboard'
import { formatDateRange } from '@/shared/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Progress } from '@/client/components/ui/progress'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your travel at a glance.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser()
  const [stats, upcoming, activity] = await Promise.all([
    getDashboardStats(),
    getUpcomingTrip(),
    getRecentActivity(),
  ])

  const cards = [
    { label: 'Countries', value: stats.countries, icon: Globe2 },
    { label: 'Cities', value: stats.cities, icon: MapPin },
    { label: 'Regions', value: stats.regions, icon: MapPin },
    { label: 'Trips', value: stats.trips, icon: Luggage },
    { label: 'Upcoming', value: stats.upcomingTrips, icon: CalendarDays },
    { label: 'Blogs', value: stats.blogs, icon: NotebookPen },
    { label: 'Memories', value: stats.memories, icon: Sparkles },
    { label: 'Travel days', value: stats.travelDays, icon: TrendingUp },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.displayName.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {stats.countries} {stats.countries === 1 ? 'country' : 'countries'} and {stats.cities}{' '}
          {stats.cities === 1 ? 'city' : 'cities'} so far — that is {stats.percentOfWorld}% of the
          world.
        </p>
      </header>

      <section aria-label="Overview">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">World progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={stats.percentOfWorld} />
            <p className="text-sm text-muted-foreground">
              {stats.countries} of 195 countries. {195 - stats.countries} to go.
            </p>
            <Button variant="outline" nativeButton={false} render={<Link href="/globe" />}>
              <Globe2 className="size-4" aria-hidden />
              Open the globe
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {upcoming?.status === 'ongoing' ? 'Currently travelling' : 'Next trip'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{upcoming.title}</p>
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {upcoming.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateRange(upcoming.startDate, upcoming.endDate)}
                </p>
                {upcoming.places.length > 0 && (
                  <p className="text-sm text-muted-foreground">{upcoming.places.join(' · ')}</p>
                )}
                {upcoming.daysUntil !== null && upcoming.daysUntil > 0 && (
                  <p className="text-sm font-medium">
                    {upcoming.daysUntil} {upcoming.daysUntil === 1 ? 'day' : 'days'} to go
                  </p>
                )}
                {upcoming.budgetPlanned !== null && (
                  <p className="text-xs text-muted-foreground">
                    Budget {upcoming.currency} {upcoming.budgetPlanned.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing planned. Add a trip and it will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length ? (
            <ul className="divide-y">
              {activity.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {item.kind === 'blog' ? (
                        <NotebookPen
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      ) : (
                        <Luggage className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span className="truncate">{item.title}</span>
                    </span>
                    <time
                      dateTime={item.at}
                      className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    >
                      {new Date(item.at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
