'use client'

import { useRouter } from 'next/navigation'
import type { VisitedRegion } from '@/shared/types/globe'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'
import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * The globe, small, on the dashboard.
 *
 * The query behind this — `getGlobePreviewRegions()` — has existed since the
 * dashboard was built and nothing rendered it; the card offered a link to
 * `/globe` instead, which is a description of a globe rather than a globe.
 *
 * **Lazy, like every other WebGL surface here.** `react-globe.gl` pulls in
 * three.js, and the dashboard is the first authenticated screen anybody lands
 * on — shipping that in the entry chunk would make the slowest paint in the app
 * the one that greets a new account. `useLazyComponent` loads it after the page
 * is interactive and shows a skeleton until it arrives, so the card has its
 * final size from the first frame and nothing below it jumps.
 *
 * **Presentation only, which is deliberate.** Clicking anywhere on it opens
 * `/globe`, where the region list, the filters and the modal live. WebGL is
 * unreachable by keyboard and screen reader, so this is a picture with a link
 * over it rather than a control — and the same rule the full globe follows,
 * that the canvas is never the only path to the data, is what makes a preview
 * safe to render at all.
 */
export function DashboardGlobe({ regions }: { regions: VisitedRegion[] }) {
  const router = useRouter()
  const { Component: GlobeView, failed } = useLazyComponent(
    async () => (await import('./globe-view')).GlobeView
  )

  // Nothing to show, and nothing worth loading three.js for. The card's
  // surrounding copy already says how far along the account is.
  if (regions.length === 0) return null

  return (
    <div className="relative h-44 overflow-hidden rounded-lg border bg-gradient-to-b from-sky-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {GlobeView ? (
        <GlobeView
          regions={regions}
          // Any country opens the full screen rather than a modal on a card
          // this size, where the modal would be larger than the globe.
          onSelectCountry={() => router.push('/globe')}
          className="absolute inset-0"
        />
      ) : failed ? (
        // Silent about the failure: the card's numbers are the information and
        // they are already on screen, so a broken preview is not worth a notice.
        <div className="absolute inset-0" />
      ) : (
        <Skeleton className="absolute inset-0 rounded-lg" />
      )}
    </div>
  )
}
