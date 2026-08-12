'use client'

import type { VisitedRegion } from '@/shared/types/globe'
import { RegionLegend } from '@/client/components/globe/region-legend'
import { RegionList } from '@/client/components/globe/region-list'
import { Skeleton } from '@/client/components/ui/skeleton'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'

/**
 * The globe on a public profile: look, do not touch.
 *
 * Reuses the same renderer as `/globe` but drops the modal — a visitor has no
 * business opening someone else's trip list from a country, and the detail
 * query is scoped to the signed-in user anyway. Selecting a country does
 * nothing here on purpose.
 *
 * The region list beside it is not decoration: WebGL is unreachable by keyboard
 * and screen readers, so the list is how this data is actually navigable.
 */
export function PublicGlobe({ regions }: { regions: VisitedRegion[] }) {
  const { Component: GlobeView, failed } = useLazyComponent(
    async () => (await import('@/client/components/globe/globe-view')).GlobeView
  )

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-sky-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        {GlobeView ? (
          <GlobeView regions={regions} onSelectCountry={() => {}} className="absolute inset-0" />
        ) : failed ? (
          <p className="max-w-xs px-6 text-center text-sm text-muted-foreground">
            The globe could not load. The countries are listed alongside.
          </p>
        ) : (
          <Skeleton className="absolute inset-0 rounded-xl" />
        )}

        <RegionLegend className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/85 px-3 py-2 backdrop-blur dark:bg-black/60" />
      </div>

      <div className="lg:w-72">
        <RegionList regions={regions} selectedCountry={null} className="max-h-80" />
      </div>
    </div>
  )
}
