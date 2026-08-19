'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import { Globe2 } from 'lucide-react'
import type { RegionDetail, VisitedRegion } from '@/shared/types/globe'
import { rollUpToCountries } from '@/shared/types/globe'
import { TOTAL_COUNTRIES } from '@/shared/geo/countries'
import { NO_REGION_FILTER, filterRegions, type RegionFilter } from '@/shared/geo/region-filter'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'
import { useWebglSupport } from '@/client/hooks/use-webgl-support'
import { RegionFilterNote, RegionFilters } from './region-filters'
import { RegionLegend } from './region-legend'
import { RegionList } from './region-list'
import { RegionModal } from './region-modal'
import { Skeleton } from '@/client/components/ui/skeleton'

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

  /**
   * Which of the two renderers this browser gets. `null` until the effect behind
   * `useWebglSupport` has run, which is why the placeholder below covers three
   * cases rather than two — drawing the flat map for a frame and then replacing it
   * with a globe would be worse than a moment of nothing.
   *
   * The choice is made by *mounting* one of two components rather than by
   * selecting between two loaded modules, and that is the point: `useLazyComponent`
   * imports on mount, so a component that is never mounted is a chunk that is
   * never fetched. A browser without WebGL does not download three.js at all —
   * the fallback is not only a different picture, it is half a megabyte the device
   * that could least afford it never pays for.
   */
  const webgl = useWebglSupport()

  const [detail, setDetail] = useState<{
    forCountry: string
    data: RegionDetail | null
  } | null>(null)

  const [filter, setFilter] = useState<RegionFilter>(NO_REGION_FILTER)

  // The filter is applied before the paywall roll-up, so both the globe and the
  // list beside it are narrowed by exactly the same rows.
  const visibleRegions = useMemo(() => filterRegions(regions, filter), [regions, filter])

  // Free plans render country fills only, even when the stored data carries
  // subdivision rows. The paywall changes the view, never the underlying data.
  const displayRegions = useMemo(
    () => (showRegionDetail ? visibleRegions : rollUpToCountries(visibleRegions)),
    [visibleRegions, showRegionDetail]
  )

  // Counted from the country roll-up, never from `displayRegions`. On a plan
  // with subdivision detail the display rows are states, so counting those
  // would report "13 countries" for someone who has visited six.
  //
  // Counted from the *filtered* rows, because these three numbers sit on the
  // globe itself and would otherwise describe a globe nobody is looking at.
  const stats = useMemo(() => {
    const countryLevel = rollUpToCountries(visibleRegions)
    const visited = countryLevel.filter((r) => r.state === 'visited' || r.state === 'current')
    return {
      countries: visited.length,
      cities: new Set(visibleRegions.flatMap((r) => r.cityNames)).size,
      percentOfWorld: Math.round((visited.length / TOTAL_COUNTRIES) * 100),
    }
  }, [visibleRegions])

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
        {webgl === null ? (
          <Skeleton className="absolute inset-0 rounded-xl" />
        ) : webgl ? (
          <LazyGlobe regions={displayRegions} onSelectCountry={selectCountry} />
        ) : (
          <LazyFlatMap regions={displayRegions} onSelectCountry={selectCountry} />
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

        {/* Above the list, not over the globe: the globe is a canvas with no
            room for chrome, and the filter narrows both halves at once. */}
        <RegionFilters regions={regions} filter={filter} onChange={setFilter} />
        <RegionFilterNote
          filter={filter}
          shown={rollUpToCountries(visibleRegions).length}
          total={rollUpToCountries(regions).length}
        />

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

interface RendererProps {
  regions: VisitedRegion[]
  onSelectCountry: (countryCode: string) => void
}

/**
 * The 3D globe, imported on mount — and **falling back to the flat map when the
 * import fails**, which is a change from the sentence that used to be here.
 *
 * A chunk that will not load is not different, from the visitor's side, from a
 * browser that cannot run it: in both cases there is no globe and there is a map
 * to draw instead. The old copy ("The globe could not load. Your places are still
 * listed alongside.") described the failure accurately and left the largest
 * element on the screen empty, when the data behind it was already in hand.
 */
function LazyGlobe({ regions, onSelectCountry }: RendererProps) {
  const { Component: GlobeView, failed } = useLazyComponent(
    async () => (await import('./globe-view')).GlobeView
  )

  if (failed) return <LazyFlatMap regions={regions} onSelectCountry={onSelectCountry} />
  if (!GlobeView) return <Skeleton className="absolute inset-0 rounded-xl" />

  return (
    <GlobeView regions={regions} onSelectCountry={onSelectCountry} className="absolute inset-0" />
  )
}

/**
 * The flat SVG world — §6's fallback.
 *
 * `inset-6` rather than `inset-0`: the globe fills its container because a sphere
 * has no corners, and a rectangular map pressed against a rounded border looks
 * like a mistake. This is the last renderer, so its own failure is the one case
 * left with nothing to offer but a sentence — and the region list beside it still
 * carries every country this would have coloured.
 */
function LazyFlatMap({ regions, onSelectCountry }: RendererProps) {
  const { Component: StaticChoropleth, failed } = useLazyComponent(
    async () => (await import('./static-choropleth')).StaticChoropleth
  )

  if (failed) {
    return (
      <p className="max-w-xs px-6 text-center text-sm text-muted-foreground">
        The map could not load. Your places are still listed alongside.
      </p>
    )
  }
  if (!StaticChoropleth) return <Skeleton className="absolute inset-0 rounded-xl" />

  return (
    <StaticChoropleth
      regions={regions}
      onSelectCountry={onSelectCountry}
      className="absolute inset-6"
    />
  )
}
