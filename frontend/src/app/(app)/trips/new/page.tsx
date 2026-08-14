import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { checkTripQuota } from '@/server/entitlements'
import { getDefaultTripVisibility } from '@/server/queries/settings'
import { TripForm } from '@/client/components/trips/trip-form'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

export const metadata: Metadata = {
  title: 'New trip',
  description: 'Record a trip and watch your globe fill in.',
}

export const dynamic = 'force-dynamic'

export default async function NewTripPage() {
  // Checked here as well as in the action: this turns the wall into a page the
  // user can read before filling in a form they cannot submit.
  const [quota, defaultVisibility] = await Promise.all([
    checkTripQuota(),
    getDefaultTripVisibility(),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/trips" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Trips
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New trip</h1>
        <p className="text-sm text-muted-foreground">
          Somewhere you have been, or somewhere you are going. Both fill in the globe.
        </p>
      </header>

      <div className="max-w-2xl">
        {quota.allowed ? (
          <TripForm
            mode="create"
            tripsUsed={quota.used}
            tripLimit={quota.limit}
            defaultVisibility={defaultVisibility}
          />
        ) : (
          <Card>
            <CardContent className="space-y-3 p-6">
              <h2 className="font-medium">You have used all your trips</h2>
              <p className="text-sm text-muted-foreground">{quota.reason}</p>
              <div className="flex gap-2">
                <Button nativeButton={false} render={<Link href="/pricing" />}>
                  See plans
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/trips" />}>
                  Back to trips
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
