import type { Metadata } from 'next'
import Link from 'next/link'
import { GlobeExplorer } from '@/client/components/globe/globe-explorer'
import { getRegionDetail, getVisitedRegions } from '@/server/queries/globe'
import { canUseRegionDetail } from '@/server/entitlements'
import { Button } from '@/client/components/ui/button'

export const metadata: Metadata = {
  title: 'Globe',
  description: 'Every country you have been to, on one globe.',
}

// Per-user data behind auth — there is nothing to prerender, and rendering
// dynamically avoids the static-shell fallback that `useSearchParams` forces.
export const dynamic = 'force-dynamic'

export default async function GlobePage() {
  const [regions, showRegionDetail] = await Promise.all([getVisitedRegions(), canUseRegionDetail()])

  async function loadRegionDetail(countryCode: string) {
    'use server'
    // Re-reads through RLS on every call, so this cannot be used to fetch a
    // region belonging to someone else even with a forged country code.
    return getRegionDetail(countryCode)
  }

  if (regions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Your globe is empty</h1>
          <p className="text-sm text-muted-foreground">
            Add a trip with at least one place and it will light up here. Wishlist entries show as
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
        <h1 className="text-2xl font-semibold tracking-tight">Your globe</h1>
        <p className="text-sm text-muted-foreground">
          Spin it, or pick a place from the list. Every country you have visited is filled in.
        </p>
      </header>

      <GlobeExplorer
        regions={regions}
        loadRegionDetail={loadRegionDetail}
        // State/province detail is the headline paid feature; free plans see
        // country fills only. Read from plans.limits via entitlements, and
        // decided on the server — the client component never sees the plan.
        showRegionDetail={showRegionDetail}
      />
    </div>
  )
}
