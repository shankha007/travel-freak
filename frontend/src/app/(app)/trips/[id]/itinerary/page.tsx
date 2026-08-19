import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock, Wallet } from 'lucide-react'
import { getItinerary } from '@/server/queries/itinerary'
import { formatMoney } from '@/shared/budget'
import { formatDateRange } from '@/shared/format'
import { ItineraryBoard } from '@/client/components/itinerary/itinerary-board'
import { Button } from '@/client/components/ui/button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/trips/[id]/itinerary'>): Promise<Metadata> {
  const { id } = await params
  const itinerary = await getItinerary(id)
  return { title: itinerary ? `${itinerary.tripTitle} · Itinerary` : 'Trip not found' }
}

export default async function ItineraryPage({ params }: PageProps<'/trips/[id]/itinerary'>) {
  const { id } = await params
  const itinerary = await getItinerary(id)

  // This is where you plan, so somebody else's trip is a 404 here even when its
  // photos are readable elsewhere.
  if (!itinerary) notFound()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${id}`} />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {itinerary.tripTitle}
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Itinerary</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(itinerary.startDate, itinerary.endDate)}
          </p>
        </div>

        {itinerary.totals.length > 0 && (
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
              <Wallet className="size-3.5" aria-hidden />
              Planned cost
            </p>
            {/* One line per currency, never a sum: there is no exchange rate in
                this codebase and adding ₹40,000 to $400 would invent one. */}
            {itinerary.totals.map((total) => (
              <p key={total.currency} className="font-semibold tabular-nums">
                {formatMoney(total.total, total.currency)}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              <Link href={`/trips/${id}/budget`} className="underline underline-offset-2">
                Compare it against what you spend
              </Link>
            </p>
          </div>
        )}
      </header>

      {!itinerary.full && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Days, activities, notes and the map are free on every plan. Times, costs, booking
            references, links and dragging entries into order come with Voyager —{' '}
            <Link href="/upgrade" className="underline underline-offset-2">
              what that changes
            </Link>
            .
          </span>
        </p>
      )}

      <ItineraryBoard itinerary={itinerary} />
    </div>
  )
}
