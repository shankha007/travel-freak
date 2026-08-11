import type { Metadata } from 'next'
import { Camera, MapPin, Users } from 'lucide-react'
import { getTrips, groupTrips, type TripListItem } from '@/server/queries/trips'
import { countryFlag } from '@/shared/geo/countries'
import { formatDateRange } from '@/shared/format'
import { Card, CardContent } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'

export const metadata: Metadata = {
  title: 'Trips',
  description: 'Every trip you have planned and taken.',
}

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  ongoing: 'default',
  completed: 'secondary',
  upcoming: 'outline',
  planning: 'outline',
}

function TripCard({ trip }: { trip: TripListItem }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="leading-tight font-medium">{trip.title}</h3>
          <Badge variant={STATUS_VARIANT[trip.status] ?? 'outline'} className="shrink-0 capitalize">
            {trip.status}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>

        {trip.summary && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{trip.summary}</p>
        )}

        {trip.places.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              <span aria-hidden>{trip.countryCodes.map(countryFlag).join(' ')} </span>
              {trip.places.join(' · ')}
            </span>
          </p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {trip.travelerCount}
          </span>
          <span className="flex items-center gap-1">
            <Camera className="size-3.5" aria-hidden />
            {trip.photoCount}
          </span>
          <span className="ml-auto capitalize">{trip.visibility}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function TripGrid({ trips }: { trips: TripListItem[] }) {
  if (!trips.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {trips.map((trip) => (
        <li key={trip.id}>
          <TripCard trip={trip} />
        </li>
      ))}
    </ul>
  )
}

export default async function TripsPage() {
  const trips = await getTrips()
  const grouped = groupTrips(trips)

  const tabs = [
    { value: 'all', label: 'All', trips: grouped.all },
    { value: 'past', label: 'Past', trips: grouped.past },
    { value: 'ongoing', label: 'Ongoing', trips: grouped.ongoing },
    { value: 'upcoming', label: 'Upcoming', trips: grouped.upcoming },
    { value: 'drafts', label: 'Drafts', trips: grouped.drafts },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
        <p className="text-sm text-muted-foreground">
          {trips.length} {trips.length === 1 ? 'trip' : 'trips'} recorded.
        </p>
      </header>

      <Tabs defaultValue="all">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {t.trips.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <TripGrid trips={t.trips} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
