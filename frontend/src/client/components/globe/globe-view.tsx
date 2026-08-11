'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import {
  COUNTRIES_GEOJSON_URL,
  type CountryCollection,
  type CountryFeature,
} from '@/shared/geo/countries'
import {
  REGION_STATE_META,
  resolveRegionStateColor,
  type RegionState,
} from '@/shared/geo/region-state'
import { indexRegions, regionKey, type VisitedRegion } from '@/shared/types/globe'
import { useReducedMotion } from '@/client/hooks/use-reduced-motion'
import { useElementSize } from '@/client/hooks/use-element-size'
import { Skeleton } from '@/client/components/ui/skeleton'

interface GlobeViewProps {
  regions: VisitedRegion[]
  /** Called with the ISO alpha-3 code when a country is activated. */
  onSelectCountry: (countryCode: string) => void
  className?: string
}

/**
 * The 3D globe.
 *
 * Country-level only — subdivision detail lives in the 2D MapLibre view, which
 * is where the paid tier unlocks admin-1 polygons.
 *
 * This component must always be paired with an equivalent non-visual path to the
 * same data (see RegionList). WebGL content is unreachable by keyboard and
 * screen readers, so the globe is treated as a presentation surface, not the
 * only means of navigation.
 */
export function GlobeView({ regions, onSelectCountry, className }: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const { ref: containerRef, width, height } = useElementSize<HTMLDivElement>()
  const prefersReducedMotion = useReducedMotion()

  const [countries, setCountries] = useState<CountryCollection | null>(null)
  const [hovered, setHovered] = useState<CountryFeature | null>(null)
  const [colors, setColors] = useState<Record<RegionState, string> | null>(null)

  const regionIndex = useMemo(() => indexRegions(regions), [regions])

  // Region colours live in CSS custom properties so they track the theme.
  // WebGL cannot read `var()`, and three-globe parses colours with d3-color,
  // which does not understand oklch — so resolve to sRGB here, and re-resolve
  // when the theme class on <html> changes.
  useEffect(() => {
    const read = () => {
      setColors({
        visited: resolveRegionStateColor('visited'),
        current: resolveRegionStateColor('current'),
        planned: resolveRegionStateColor('planned'),
        unvisited: resolveRegionStateColor('unvisited'),
      })
    }
    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(COUNTRIES_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load country polygons (${res.status})`)
        return res.json() as Promise<CountryCollection>
      })
      .then((data) => {
        if (!cancelled) setCountries(data)
      })
      .catch(() => {
        // The region list still renders the same data, so a failure here
        // degrades the experience rather than breaking the page.
        if (!cancelled) setCountries({ type: 'FeatureCollection', features: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-rotate until the user interacts — and never when reduced motion is on.
  useEffect(() => {
    const controls = globeRef.current?.controls()
    if (!controls) return

    controls.autoRotate = !prefersReducedMotion
    controls.autoRotateSpeed = 0.35

    const stop = () => {
      controls.autoRotate = false
    }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [prefersReducedMotion, countries])

  const stateFor = useCallback(
    (feature: CountryFeature): RegionState => {
      const iso = feature.properties.iso_a3
      if (!iso) return 'unvisited'
      return regionIndex.get(regionKey(iso))?.state ?? 'unvisited'
    },
    [regionIndex]
  )

  const capColor = useCallback(
    (feature: object) => {
      if (!colors) return 'rgba(0,0,0,0)'
      const f = feature as CountryFeature
      const state = stateFor(f)
      if (state === 'unvisited') return colors.unvisited

      // Repeat visits read as progressively more saturated, so a country you
      // keep returning to stands out from one you passed through once.
      const visits = f.properties.iso_a3
        ? (regionIndex.get(regionKey(f.properties.iso_a3))?.visitCount ?? 0)
        : 0
      const intensity = Math.min(1, 0.62 + visits * 0.12)
      return withAlpha(colors[state], intensity)
    },
    [colors, regionIndex, stateFor]
  )

  const handleClick = useCallback(
    (feature: object) => {
      const iso = (feature as CountryFeature).properties.iso_a3
      if (iso) onSelectCountry(iso)
    },
    [onSelectCountry]
  )

  const ready = countries !== null && colors !== null && width > 0

  return (
    <div ref={containerRef} className={className}>
      {!ready && <Skeleton className="size-full rounded-full" />}
      {ready && (
        <Globe
          ref={globeRef as React.MutableRefObject<GlobeMethods | undefined>}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#6ba8c9"
          atmosphereAltitude={0.16}
          showGlobe
          polygonsData={countries.features}
          polygonCapColor={capColor}
          polygonSideColor={() => 'rgba(0,0,0,0.12)'}
          polygonStrokeColor={() => 'rgba(0,0,0,0.28)'}
          polygonAltitude={(f) => (f === hovered ? 0.035 : 0.008)}
          polygonLabel={(f) => labelFor(f as CountryFeature, regionIndex)}
          onPolygonHover={(f) => setHovered((f as CountryFeature) ?? null)}
          onPolygonClick={handleClick}
          polygonsTransitionDuration={prefersReducedMotion ? 0 : 180}
        />
      )}
    </div>
  )
}

/** Applies an alpha channel to an `rgba(r, g, b, a)` string from toRgba(). */
function withAlpha(color: string, alpha: number): string {
  const channels = color.match(/[\d.]+/g)
  if (!channels || channels.length < 3) return `rgba(0, 0, 0, ${alpha})`
  const [r, g, b] = channels
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Hover tooltip. Names the state in words — colour is never the only signal. */
function labelFor(feature: CountryFeature, index: Map<string, VisitedRegion>): string {
  const iso = feature.properties.iso_a3
  const region = iso ? index.get(regionKey(iso)) : undefined
  const state = region?.state ?? 'unvisited'
  const meta = REGION_STATE_META[state]
  const visits = region?.visitCount ?? 0
  const detail =
    state === 'visited' && visits > 0
      ? `${meta.label} · ${visits} ${visits === 1 ? 'trip' : 'trips'}`
      : meta.label

  return `<div style="
      font: 500 12px/1.4 system-ui, sans-serif;
      background: rgba(17,17,17,0.92); color: #fff;
      padding: 6px 9px; border-radius: 6px; white-space: nowrap;
    ">
      <strong>${escapeHtml(feature.properties.name)}</strong><br/>${detail}
    </div>`
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}
