'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, MapIcon, X } from 'lucide-react'
import type { RegionDetail, VisitedRegion } from '@/shared/types/globe'
import { rollUpToCountries } from '@/shared/types/globe'
import { REGION_STATES, REGION_STATE_META, type RegionState } from '@/shared/geo/region-state'
import { FREE_ADMIN1_COUNTRY } from '@/shared/geo/admin1'
import { NO_REGION_FILTER, filterRegions, type RegionFilter } from '@/shared/geo/region-filter'
import { RegionFilterNote, RegionFilters } from '@/client/components/globe/region-filters'
import { RegionList } from '@/client/components/globe/region-list'
import { RegionModal } from '@/client/components/globe/region-modal'
import { Button } from '@/client/components/ui/button'
import { Skeleton } from '@/client/components/ui/skeleton'
import { cn } from '@/shared/utils'
import { useLazyComponent } from '@/client/hooks/use-lazy-component'
import { useMediaQuery } from '@/client/hooks/use-media-query'

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
  const { Component: MapView, failed } = useLazyComponent(
    async () => (await import('./map-view')).MapView
  )

  const [visibleStates, setVisibleStates] = useState<RegionState[]>([...TOGGLEABLE, 'unvisited'])
  const [filter, setFilter] = useState<RegionFilter>(NO_REGION_FILTER)
  const [detail, setDetail] = useState<{ forCountry: string; data: RegionDetail | null } | null>(
    null
  )
  // Open where there is room beside the map, closed where it would *be* the map
  // — until the reader says otherwise, after which their choice sticks. That
  // "default from the viewport, overridable" is why this is not a CSS
  // breakpoint: `null` means nobody has expressed a preference yet.
  const wideEnough = useMediaQuery('(min-width: 64rem)')
  const [panelPreference, setPanelPreference] = useState<boolean | null>(null)
  const panelOpen = panelPreference ?? wideEnough

  // Everything below paints from the filtered rows; the controls themselves read
  // the unfiltered ones, because a filter that removed its own options could
  // never be undone. A row that is filtered out is simply absent, which the map
  // already draws as unvisited — no separate "dimmed" state to keep in step.
  const visibleRegions = useMemo(() => filterRegions(regions, filter), [regions, filter])

  // Country mode shows one country's subdivisions; world mode shows them for
  // every country the user has actually been to, which is what keeps the
  // downloads small.
  //
  // Read from the *unfiltered* rows on purpose: which polygons to download is a
  // question about the account, and re-fetching a country's subdivisions every
  // time somebody changes the year would be a download per keystroke.
  const admin1Countries = useMemo(() => {
    if (focusCountry) return [focusCountry]
    if (!showRegionDetail) return []
    return [...new Set(regions.filter((r) => r.regionCode !== '').map((r) => r.countryCode))]
  }, [focusCountry, regions, showRegionDetail])

  // What the map paints. Subdivision rows are only useful where subdivisions are
  // drawn; everywhere else they roll up so a country still gets its colour.
  const displayRegions = useMemo(() => {
    if (focusCountry) {
      const forCountry = visibleRegions.filter((r) => r.countryCode === focusCountry)
      // Keep the country-level row too, so a trip logged without a state still
      // paints the country outline on the country map.
      return forCountry
    }
    if (!showRegionDetail) return rollUpToCountries(visibleRegions)

    const detailed = admin1Countries
    return [
      ...rollUpToCountries(visibleRegions),
      ...visibleRegions.filter((r) => r.regionCode !== '' && detailed.includes(r.countryCode)),
    ]
  }, [admin1Countries, focusCountry, visibleRegions, showRegionDetail])

  // The list is the keyboard-navigable equivalent of the map and always shows
  // the same rows the map is painting — filter included, or the two would
  // disagree about where somebody has been.
  const listRegions = useMemo(
    () => (focusCountry ? displayRegions : rollUpToCountries(visibleRegions)),
    [displayRegions, focusCountry, visibleRegions]
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

  const visitedCount = useMemo(
    () => listRegions.filter((r) => r.state === 'visited' || r.state === 'current').length,
    [listRegions]
  )

  return (
    /* The map is the screen, not a panel on it: it fills the content area, and
       everything else floats over it as glass. The places list used to take a
       fixed 320px column beside a 420px-tall box, which left the actual map
       smaller than the sidebar on a laptop. */
    <div className="relative min-h-[32rem] flex-1 overflow-hidden rounded-2xl border shadow-sm">
      {MapView ? (
        <MapView
          regions={displayRegions}
          admin1Countries={admin1Countries}
          visibleStates={visibleStates}
          onSelectCountry={selectCountry}
          focusCountry={focusCountry}
          // The floating panel's width plus its margins, so the world is framed
          // in the part of the map that is actually visible.
          insetRight={panelOpen ? 316 : 0}
          className="absolute inset-0"
        />
      ) : failed ? (
        <p className="absolute inset-0 m-auto flex max-w-xs items-center justify-center px-6 text-center text-sm text-muted-foreground">
          The map could not load. Your places are still listed alongside.
        </p>
      ) : (
        <Skeleton className="absolute inset-0" />
      )}

      {/* Layer toggles double as the legend: each chip names its state, so the
          colour is never the only thing carrying meaning. */}
      <fieldset className="absolute bottom-3 left-3 z-10 rounded-xl border border-border/60 bg-card/80 px-3 py-2 shadow-lg backdrop-blur-md">
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
                  className="size-3.5 accent-primary"
                />
                <span
                  className={cn('size-2.5 rounded-full', meta.fillClass, !checked && 'opacity-30')}
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

      {/* The places panel. Open on a wide screen, where there is room beside the
          map; closed on a phone, where it would be the map. Either way it is the
          keyboard-navigable equivalent of the polygons, so it is always in the
          DOM and always reachable — the button moves it, it does not create it. */}
      <div
        className={cn(
          'absolute top-3 right-3 bottom-3 z-10 flex w-[19rem] max-w-[calc(100%-1.5rem)] flex-col gap-3',
          'rounded-xl border border-border/60 bg-card/85 p-3 shadow-xl backdrop-blur-md',
          'transition-transform duration-200 motion-reduce:transition-none',
          panelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-[calc(100%+0.75rem)]'
        )}
        // Hidden from assistive tech only when it is actually off-screen; the
        // region list below is a duplicate of the map's content, not extra.
        aria-hidden={!panelOpen}
        inert={!panelOpen}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MapIcon className="size-4" aria-hidden />
            Your places
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums">
              {visitedCount}
            </span>
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setPanelPreference(false)}>
            <X className="size-4" aria-hidden />
            <span className="sr-only">Hide the places panel</span>
          </Button>
        </div>

        {/* In the panel rather than floating over the map on their own: the
            filter narrows the list and the polygons together, and this is where
            a reader can see both the controls and what they did. */}
        <div className="space-y-1.5">
          <RegionFilters regions={regions} filter={filter} onChange={setFilter} />
          <RegionFilterNote
            filter={filter}
            shown={listRegions.length}
            total={
              focusCountry
                ? regions.filter((r) => r.countryCode === focusCountry).length
                : rollUpToCountries(regions).length
            }
          />
        </div>

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
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/upgrade" />}
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
      </div>

      {!panelOpen && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPanelPreference(true)}
          className="absolute top-3 right-3 z-10 gap-1.5 border border-border/60 bg-card/85 shadow-lg backdrop-blur-md"
        >
          <MapIcon className="size-4" aria-hidden />
          Your places
        </Button>
      )}

      <RegionModal
        countryCode={selected}
        detail={activeDetail}
        isLoading={isLoading}
        onClose={closeModal}
      />
    </div>
  )
}
