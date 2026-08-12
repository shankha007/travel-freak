'use client'

import type { VisitedRegion } from '@/shared/types/globe'
import { Skeleton } from '@/client/components/ui/skeleton'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'

interface HeroGlobeProps {
  regions: VisitedRegion[]
  className?: string
}

/**
 * The landing page's globe.
 *
 * Same component the app uses, with demo data and no click target — a marketing
 * screenshot would drift from the real thing, and this cannot.
 *
 * three.js and react-globe.gl are ~500 KB and touch `window` at module scope,
 * so the import happens in an effect. That keeps them out of the initial
 * bundle, which is what holds the landing page inside its Lighthouse budget.
 */
export function HeroGlobe({ regions, className }: HeroGlobeProps) {
  const { Component: GlobeView, failed } = useLazyComponent(
    async () => (await import('./globe-view')).GlobeView
  )

  if (failed) {
    return (
      <div className={className}>
        <div className="flex size-full items-center justify-center p-6">
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            The globe could not load here, but it works inside the app.
          </p>
        </div>
      </div>
    )
  }

  if (!GlobeView) {
    return <Skeleton className={className} />
  }

  // No-op selection: the hero is a demo, and a modal on the marketing page
  // would interrupt the path to sign-up.
  return <GlobeView regions={regions} onSelectCountry={() => {}} className={className} />
}
