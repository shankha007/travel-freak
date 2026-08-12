'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, MapIcon } from 'lucide-react'
import type { RegionDetail, VisitedRegion } from '@/shared/types/globe'
import { rollUpToCountries } from '@/shared/types/globe'
import { REGION_STATES, REGION_STATE_META, type RegionState } from '@/shared/geo/region-state'
import { FREE_ADMIN1_COUNTRY } from '@/shared/geo/admin1'
import { RegionList } from '@/client/components/globe/region-list'
import { RegionModal } from '@/client/components/globe/region-modal'
import { Button } from '@/client/components/ui/button'
import { Skeleton } from '@/client/components/ui/skeleton'
import { cn } from '@/shared/utils'

type MapViewComponent = typeof import('./map-view').MapView

/**
 * Loads MapLibre on the client only.
 *
 * maplibre-gl touches `window` at module scope and is ~800 KB, so it must never
 * be evaluated during SSR and must not sit in the initial bundle. Same approach
 * as the globe: an explicit import that surfaces failures rather than a
 * Suspense boundary that would leave the page stuck on a placeholder.
 */
function useMapView() {
  const [component, setComponent] = useState<{ Component: MapViewComponent } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('./map-view')
      .then((m) => !cancelled && setComponent({ Component: m.MapView }))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  return { MapView: component?.Component ?? null, failed }
}

interface MapExplorerProps {
  regions: VisitedRegion[]
  loadRegionDetail: (countryCode: string) => Promise<RegionDetail | null>
  /**
   * Whether subdivisions may be drawn. On the world map this is the plan's
   * paywall; the India map passes true because state-level India is free.
   */
  showRegionDetail: boolean
  /** Set on the India map: one country, fitted and always subdivided. */
  focusCountry?: string
}

/** The three states a user can toggle. `unvisited` is the background, not a layer. */
const TOGGLEABLE: RegionState[] = REGION_STATES.filter((s) => s !== 'unvisited')

export function MapExplorer({
  regions,
  loadRegionDetail,
  showRegionDetail,
  focusCountry,
}: MapExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('region')
  const { MapView, failed } = useMapView()

  const [visibleStates, setVisibleStates] = useState<RegionState[]>([...TOGGLEABLE, 'unvisited'])
  const [detail, setDetail] = useState<{ forCountry: string; data: RegionDetail | null } | null>(
    null
  )

  // Country mode shows one country's subdivisions; world mode shows them for
  // every country the user has actually been to, which is what keeps the
  // downloads small.
  const admin1Countries = useMemo(() => {
    if (focusCountry) return [focusCountry]
    if (!showRegionDetail) return []
    return [...new Set(regions.filter((r) => r.regionCode !== '').map((r) => r.countryCode))]
  }, [focusCountry, regions, showRegionDetail])

  // What the map paints. Subdivision rows are only useful where subdivisions are
  // drawn; everywhere else they roll up so a country still gets its colour.
  const displayRegions = useMemo(() => {
    if (focusCountry) {
      const forCountry = regions.filter((r) => r.countryCode === focusCountry)
      // Keep the country-level row too, so a trip logged without a state still
      // paints the country outline on the country map.
      return forCountry
    }
    if (!showRegionDetail) return rollUpToCountries(regions)

    const detailed = admin1Countries
    return [
      ...rollUpToCountries(regions),
      ...regions.filter((r) => r.regionCode !== '' && detailed.includes(r.countryCode)),
    ]
  }, [admin1Countries, focusCountry, regions, showRegionDetail])

  // The list is the keyboard-navigable equivalent of the map and always shows
  // the same rows the map is painting.
  const listRegions = useMemo(
    () => (focusCountry ? displayRegions : rollUpToCountries(regions)),
    [displayRegions, focusCountry, regions]
  )

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

  const toggleState = useCallback((state: RegionState) => {
    setVisibleStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    )
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-xl border lg:min-h-0">
        {MapView ? (
          <MapView
            regions={displayRegions}
            admin1Countries={admin1Countries}
            visibleStates={visibleStates}
            onSelectCountry={selectCountry}
            focusCountry={focusCountry}
            className="absolute inset-0"
          />
        ) : failed ? (
          <p className="m-auto max-w-xs px-6 text-center text-sm text-muted-foreground">
            The map could not load. Your places are still listed alongside.
          </p>
        ) : (
          <Skeleton className="absolute inset-0" />
        )}

        {/* Layer toggles double as the legend: each chip names its state, so the
            colour is never the only thing carrying meaning. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
          <fieldset className="pointer-events-auto rounded-lg bg-white/90 px-3 py-2 backdrop-blur dark:bg-black/70">
            <legend className="sr-only">Layers</legend>
            <div className="flex flex-wrap gap-3">
              {TOGGLEABLE.map((state) => {
                const meta = REGION_STATE_META[state]
                const checked = visibleStates.includes(state)
                return (
                  <label
                    key={state}
                    className="flex cursor-pointer items-center gap-1.5 text-xs select-none"
                    title={meta.description}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleState(state)}
                      className="size-3.5 accent-current"
                    />
                    <span
                      className={cn(
                        'size-2.5 rounded-full',
                        meta.fillClass,
                        !checked && 'opacity-30'
                      )}
                      aria-hidden
                    />
                    <span className={cn(!checked && 'text-muted-foreground line-through')}>
                      {meta.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      </div>

      <aside className="flex min-h-0 shrink-0 flex-col gap-3 lg:w-80">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapIcon className="size-4" aria-hidden />
          Your places
        </h2>

        {/* The upgrade path, stated where the missing feature would appear rather
            than as a modal wall. India is free, so the country map never shows it. */}
        {!showRegionDetail && !focusCountry && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Lock className="size-3.5" aria-hidden />
              States and provinces
            </p>
            <p className="text-xs text-muted-foreground">
              Your map fills in whole countries. Voyager adds state and province detail everywhere —
              the India map is free on every plan.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/settings" />}
              >
                See plans
              </Button>
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<Link href={`/maps/${FREE_ADMIN1_COUNTRY === 'IND' ? 'india' : ''}`} />}
              >
                Open India map
              </Button>
            </div>
          </div>
        )}

        <RegionList
          regions={listRegions}
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
