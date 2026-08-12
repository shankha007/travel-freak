import type { Metadata } from 'next'
import Link from 'next/link'
import { MapExplorer } from '@/client/components/map/map-explorer'
import { getRegionDetail, getVisitedRegions } from '@/server/queries/globe'
import { canUseRegionDetail } from '@/server/entitlements'
import { Button } from '@/client/components/ui/button'

export const metadata: Metadata = {
  title: 'World map',
  description: 'Your travels, flat: visited, current and planned, country by country.',
}

// Per-user data behind auth — nothing to prerender, and dynamic rendering avoids
// the static-shell fallback that `useSearchParams` forces.
export const dynamic = 'force-dynamic'

export default async function WorldMapPage() {
  const [regions, showRegionDetail] = await Promise.all([getVisitedRegions(), canUseRegionDetail()])

  async function loadRegionDetail(countryCode: string) {
    'use server'
    // Re-read through RLS on every call, so a forged country code still cannot
    // reach someone else's data.
    return getRegionDetail(countryCode)
  }

  if (regions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Your map is empty</h1>
          <p className="text-sm text-muted-foreground">
            Add a trip with at least one place and it will fill in here. Wishlist entries show as
            planned.
          </p>
          <Button nativeButton={false} render={<Link href="/trips/new" />}>
            Add your first trip
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">World map</h1>
        <p className="text-sm text-muted-foreground">
          The same places as the globe, flat and zoomable. Toggle a layer to see one state at a
          time.
        </p>
      </header>

      <MapExplorer
        regions={regions}
        loadRegionDetail={loadRegionDetail}
        // The paywall: state and province polygons are the headline Voyager
        // feature, decided on the server so the client never sees the plan.
        showRegionDetail={showRegionDetail}
      />
    </div>
  )
}
