import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import { BRAND } from '@/shared/brand'
import { Button } from '@/client/components/ui/button'

/**
 * Shown when a trip URL does not resolve.
 *
 * One answer for "no such trip", "not published", and "that link was revoked" —
 * distinguishing them would turn the page into a way to probe what exists.
 */
export default function PublicTripNotFound() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <MapPinOff className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Trip not found</h1>
          <p className="text-sm text-muted-foreground">
            This trip either does not exist, has not been shared, or its link is no longer active.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          Go to {BRAND.name}
        </Button>
      </div>
    </div>
  )
}
