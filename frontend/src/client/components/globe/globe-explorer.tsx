'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import { Globe2 } from 'lucide-react'
import type { RegionDetail, VisitedRegion } from '@/shared/types/globe'
import { rollUpToCountries } from '@/shared/types/globe'
import { TOTAL_COUNTRIES } from '@/shared/geo/countries'
import { RegionLegend } from './region-legend'
import { RegionList } from './region-list'
import { RegionModal } from './region-modal'
import { Skeleton } from '@/client/components/ui/skeleton'

type GlobeViewComponent = typeof import('./globe-view').GlobeView

/**
 * Loads the WebGL globe on the client only.
 *
 * three.js and react-globe.gl are ~500 KB and touch `window` at module scope,
 * so the module must never be evaluated during SSR. An explicit effect-driven
 * import keeps that guarantee while still code-splitting the chunk, and unlike
 * a lazy/Suspense boundary it surfaces load failures instead of leaving the
 * page silently stuck on a placeholder.
 */
function useGlobeView() {
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

  return { GlobeView: component?.Component ?? null, failed }
}

interface GlobeExplorerProps {
  regions: VisitedRegion[]
  /** Resolves the modal contents for a country. */
  loadRegionDetail: (countryCode: string) => Promise<RegionDetail | null>
  /** Country-level only unless the viewer's plan includes subdivision detail. */
  showRegionDetail?: boolean
}

/**
 * Composes the globe, the legend, the accessible region list and the modal, and
 * owns the selected-region state.
 *
 * Selection lives in the URL (`?region=IND`) rather than in component state, so
 * any individual country is a shareable link and the back button behaves.
 */
export function GlobeExplorer({
  regions,
  loadRegionDetail,
  showRegionDetail = false,
}: GlobeExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('region')
  const { GlobeView, failed } = useGlobeView()

  const [detail, setDetail] = useState<{
    forCountry: string
    data: RegionDetail | null
  } | null>(null)

  // Free plans render country fills only, even when the stored data carries
  // subdivision rows. The paywall changes the view, never the underlying data.
  const displayRegions = useMemo(
    () => (showRegionDetail ? regions : rollUpToCountries(regions)),
    [regions, showRegionDetail]
  )

  // Counted from the country roll-up, never from `displayRegions`. On a plan
  // with subdivision detail the display rows are states, so counting those
  // would report "13 countries" for someone who has visited six.
  const stats = useMemo(() => {
    const countryLevel = rollUpToCountries(regions)
    const visited = countryLevel.filter((r) => r.state === 'visited' || r.state === 'current')
    return {
      countries: visited.length,
      cities: new Set(regions.flatMap((r) => r.cityNames)).size,
      percentOfWorld: Math.round((visited.length / TOTAL_COUNTRIES) * 100),
    }
  }, [regions])

  useEffect(() => {
    if (!selected) return

    let cancelled = false
    loadRegionDetail(selected).then((result) => {
      if (!cancelled) setDetail({ forCountry: selected, data: result })
    })

    return () => {
      cancelled = true
    }
  }, [selected, loadRegionDetail])

  // Both derived rather than tracked in state: tagging the cached detail with
  // the country it belongs to means switching countries never shows the previous
  // one's photo and trips for a frame, and makes a separate loading flag — which
  // would have to be set inside the effect — unnecessary.
  const hasDetailForSelection = selected !== null && detail?.forCountry === selected
  const activeDetail = hasDetailForSelection ? (detail?.data ?? null) : null
  const isLoading = selected !== null && !hasDetailForSelection

  const selectCountry = useCallback(
    (countryCode: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('region', countryCode)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('region')
    const query = params.toString()
    router.push(query ? `?${query}` : '?', { scroll: false })
  }, [router, searchParams])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-sky-50 to-slate-100 lg:min-h-0 dark:from-slate-900 dark:to-slate-950">
        {/* Positioned rather than sized: `h-full` collapses to zero inside a
            centring flex parent, which leaves the WebGL canvas with no viewport. */}
        {GlobeView ? (
          <GlobeView
            regions={displayRegions}
            onSelectCountry={selectCountry}
            className="absolute inset-0"
          />
        ) : failed ? (
          <p className="max-w-xs px-6 text-center text-sm text-muted-foreground">
            The globe could not load. Your places are still listed alongside.
          </p>
        ) : (
          <Skeleton className="absolute inset-0 rounded-xl" />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-black/25 to-transparent p-4">
          <RegionLegend className="pointer-events-auto rounded-lg bg-white/85 px-3 py-2 backdrop-blur dark:bg-black/60" />
          <dl className="pointer-events-auto flex gap-4 rounded-lg bg-white/85 px-3 py-2 backdrop-blur dark:bg-black/60">
            <div>
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Countries
              </dt>
              <dd className="text-lg leading-tight font-semibold tabular-nums">
                {stats.countries}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">Cities</dt>
              <dd className="text-lg leading-tight font-semibold tabular-nums">{stats.cities}</dd>
            </div>
            <div>
              <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Of the world
              </dt>
              <dd className="text-lg leading-tight font-semibold tabular-nums">
                {stats.percentOfWorld}%
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <aside className="flex min-h-0 shrink-0 flex-col gap-3 lg:w-80">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe2 className="size-4" aria-hidden />
          Your places
        </h2>
        <RegionList
          regions={displayRegions}
          selectedCountry={selected}
          onSelectCountry={selectCountry}
          className="min-h-0 flex-1"
        />
      </aside>

      <RegionModal
        countryCode={selected}
        detail={activeDetail}
        isLoading={isLoading}
        onClose={closeModal}
      />
    </div>
  )
}
