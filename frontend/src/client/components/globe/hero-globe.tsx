'use client'

import { useEffect, useState } from 'react'
import type { VisitedRegion } from '@/shared/types/globe'
import { Skeleton } from '@/client/components/ui/skeleton'

type GlobeViewComponent = typeof import('./globe-view').GlobeView

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
  const [component, setComponent] = useState<{ Component: GlobeViewComponent } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('./globe-view')
      .then((m) => {
        // Wrapped in an object: a bare setState(fn) would be treated as an
        // updater function rather than the value.
        if (!cancelled) setComponent({ Component: m.GlobeView })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  if (!component) {
    return <Skeleton className={className} />
  }

  const { Component } = component
  // No-op selection: the hero is a demo, and a modal on the marketing page
  // would interrupt the path to sign-up.
  return <Component regions={regions} onSelectCountry={() => {}} className={className} />
}
