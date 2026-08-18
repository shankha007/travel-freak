import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTripDetail } from '@/server/queries/trip-detail'
import { getTripCoverOptions } from '@/server/queries/vault'
import { TripForm, type TripFormInitial } from '@/client/components/trips/trip-form'
import { DeleteTripDialog } from '@/client/components/trips/delete-trip-dialog'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/trips/[id]/edit'>): Promise<Metadata> {
  const { id } = await params
  const trip = await getTripDetail(id)
  return { title: trip ? `Edit ${trip.title}` : 'Trip not found' }
}

export default async function EditTripPage({ params }: PageProps<'/trips/[id]/edit'>) {
  const { id } = await params
  const [trip, cover] = await Promise.all([getTripDetail(id), getTripCoverOptions(id)])

  // Same 404 for "no such trip" and "not yours": RLS returns nothing either way.
  if (!trip) notFound()

  const initial: TripFormInitial = {
    title: trip.title,
    summary: trip.summary,
    tripType: trip.tripType ?? '',
    travelerCount: String(trip.travelerCount),
    startDate: trip.startDate ?? '',
    endDate: trip.endDate ?? '',
    status: trip.status,
    visibility: trip.visibility,
    budgetPlanned: trip.budgetPlanned !== null ? String(trip.budgetPlanned) : '',
    places: trip.places.map((p) => ({
      id: p.id,
      countryCode: p.countryCode,
      regionCode: p.regionCode ?? '',
      cityName: p.cityName ?? '',
      lng: p.lng,
      lat: p.lat,
    })),
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${id}`} />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {trip.title}
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit trip</h1>
        <p className="text-sm text-muted-foreground">
          Changing places repaints your globe. The public link stays the same.
        </p>
      </header>

      <div className="max-w-2xl space-y-4">
        <TripForm
          mode="edit"
          tripId={id}
          initial={initial}
          photos={cover.photos}
          coverId={cover.coverId}
        />

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-medium">Delete this trip</h2>
              <p className="text-sm text-muted-foreground">
                Removes it from your trips and your globe. Recoverable for 30 days.
              </p>
            </div>
            <DeleteTripDialog tripId={id} title={trip.title} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
