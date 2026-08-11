import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import { Button } from '@/client/components/ui/button'

/**
 * Shown when a trip id does not resolve.
 *
 * The copy deliberately does not distinguish "no such trip" from "not yours" —
 * RLS returns nothing in both cases, and saying which would confirm that a
 * given trip exists.
 */
export default function TripNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <MapPinOff className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Trip not found</h1>
          <p className="text-sm text-muted-foreground">
            This trip either does not exist or is not shared with you.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button nativeButton={false} render={<Link href="/trips" />}>
            Back to trips
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/trips/new" />}>
            New trip
          </Button>
        </div>
      </div>
    </div>
  )
}
