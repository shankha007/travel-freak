import type { Metadata } from 'next'
import { GlobeExplorer } from '@/components/globe/globe-explorer'
import { DEMO_REGIONS, demoRegionDetail } from '@/features/globe/fixtures'

export const metadata: Metadata = {
  title: 'Globe',
  description: 'Every country you have been to, on one globe.',
}

// Per-user data behind auth — there is nothing to prerender, and rendering
// dynamically avoids the static-shell fallback that `useSearchParams` forces.
export const dynamic = 'force-dynamic'

export default function GlobePage() {
  // TODO(db): replace with the visited_regions query and a real region-detail
  // loader once migrations are applied. The component contract does not change.
  async function loadRegionDetail(countryCode: string) {
    'use server'
    return demoRegionDetail(countryCode)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your globe</h1>
        <p className="text-sm text-muted-foreground">
          Spin it, or pick a place from the list. Every country you have visited is filled in.
        </p>
      </header>

      <GlobeExplorer regions={DEMO_REGIONS} loadRegionDetail={loadRegionDetail} />
    </div>
  )
}
