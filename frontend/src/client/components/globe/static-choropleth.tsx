'use client'

import { useEffect, useMemo, useState } from 'react'
import { COUNTRIES_GEOJSON_URL, countryName, type CountryCollection } from '@/shared/geo/countries'
import { REGION_STATE_META, type RegionState } from '@/shared/geo/region-state'
import { ringsOf, toPathData, type CountryShape } from '@/shared/geo/project'
import { indexRegions, regionKey, type VisitedRegion } from '@/shared/types/globe'
import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * The flat world map §6 asks for when there is no WebGL to draw a globe on.
 *
 * ## Why this and not "the globe, but worse"
 *
 * A visitor without WebGL is not owed an apology, they are owed their map. The
 * same `visited_regions` rows, the same four states, the same click-through to the
 * region modal — drawn as SVG paths the browser has been able to render for
 * fifteen years, at a cost of no library at all.
 *
 * The projection is `shared/geo/project.ts`, which already exists because the
 * share cards needed a flat world and Satori could only draw SVG. Equirectangular,
 * which is to say crude — Greenland is enormous and Antarctica is a wall — and
 * exactly good enough for "which countries are filled in", which is the question
 * this surface answers. Reusing it also means the fallback and the OG card cannot
 * disagree about where a country is.
 *
 * ## The path split
 *
 * One merged path for every country with no data, and one path **per country** for
 * the ones that do. The merged path is what keeps the DOM small — 170-odd shapes
 * in one `d` attribute rather than 170 elements — and the individual paths are
 * what make a filled country clickable and nameable, which the merged one could
 * never be. Since only countries someone has actually been to are individual, the
 * element count scales with their travel rather than with the world.
 *
 * ## Colour is never the only signal
 *
 * Every filled country carries a `<title>` naming the country and its state in
 * words, so hovering and screen-reading both produce "India — Visited · 3 trips".
 * `RegionList` next to it remains the keyboard path, exactly as it is beside the
 * globe: this is a presentation surface, and the contract in `region-state.ts`
 * about colour never standing alone applies here too.
 */

interface StaticChoroplethProps {
  regions: VisitedRegion[]
  /** Called with the ISO alpha-3 code when a filled country is activated. */
  onSelectCountry: (countryCode: string) => void
  className?: string
}

/**
 * The viewBox, in the aspect ratio equirectangular gives: 360° of longitude by
 * 180° of latitude. The numbers are arbitrary units — the SVG scales to whatever
 * box it is given — but the 2:1 has to hold or the world is stretched.
 */
const VIEW = { width: 1000, height: 500 }

export function StaticChoropleth({ regions, onSelectCountry, className }: StaticChoroplethProps) {
  const [countries, setCountries] = useState<CountryCollection | null>(null)

  const regionIndex = useMemo(() => indexRegions(regions), [regions])

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
        // An empty collection rather than an error state: the region list beside
        // this renders the same data, so a failed fetch costs the picture and not
        // the page. Same reasoning as `GlobeView`.
        if (!cancelled) setCountries({ type: 'FeatureCollection', features: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Split once per data change rather than per render: the merged path is a
   * string of some tens of thousands of characters, and rebuilding it on a hover
   * would be the one expensive thing on a page chosen for being cheap.
   */
  const paths = useMemo(() => {
    if (!countries) return null

    const base: CountryShape[] = []
    const filled: Array<{ code: string; state: RegionState; label: string; d: string }> = []

    for (const feature of countries.features) {
      const code = feature.properties.iso_a3
      const region = code ? regionIndex.get(regionKey(code)) : undefined
      const shape: CountryShape = { code, rings: ringsOf(feature.geometry) }

      // A shape with no ISO code can never be visited — it is a territory
      // Natural Earth carries without an entry — so it always lands in the base
      // layer. Dropping it would leave holes, which read as a rendering fault.
      if (!code || !region || region.state === 'unvisited') {
        base.push(shape)
        continue
      }

      filled.push({
        code,
        state: region.state,
        // Built here rather than in the render, so the string a country is
        // labelled and titled with is computed once and is provably the same one.
        label: describe(code, region.state, region.visitCount),
        d: toPathData([shape], VIEW),
      })
    }

    return { base: toPathData(base, VIEW), filled }
  }, [countries, regionIndex])

  if (!paths) return <Skeleton className={className} />

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        // `meet`, so the world is never cropped: this is the surface someone gets
        // *because* the better one was unavailable, and cutting Australia off it
        // would be the second disappointment.
        preserveAspectRatio="xMidYMid meet"
        className="size-full"
        role="img"
        aria-label={`World map with ${paths.filled.length} ${
          paths.filled.length === 1 ? 'country' : 'countries'
        } filled in. The list beside it gives the same information.`}
      >
        {/*
          The unvisited world, in one element. `var()` works here and not in the
          globe: an SVG path is a DOM node, so it resolves the custom property
          itself and retunes with the theme picker for free — where WebGL needed
          `resolveRegionStateColor` and a MutationObserver to do the same job.
        */}
        <path
          d={paths.base}
          fill="var(--globe-unvisited)"
          stroke="var(--background)"
          strokeWidth={0.4}
        />

        {paths.filled.map((country) => (
          <path
            key={country.code}
            d={country.d}
            fill={`var(${REGION_STATE_META[country.state].cssVar})`}
            stroke="var(--background)"
            strokeWidth={0.4}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onClick={() => onSelectCountry(country.code)}
            // A path is not a button, so the role and the tab stop are stated.
            // The region list is still the intended keyboard path — this exists so
            // that somebody who has tabbed onto a country can open it rather than
            // finding the shape inert.
            role="button"
            tabIndex={0}
            // Both, and they are not redundant. `<title>` is what a browser draws
            // as a tooltip on hover and is the only way to get one on an SVG
            // shape; `aria-label` is what assistive technology reads, and relying
            // on the title alone for that means relying on SVG-AAM support that
            // is still uneven. Same string, so the two can never say different
            // things about the same country.
            aria-label={country.label}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectCountry(country.code)
              }
            }}
          >
            <title>{country.label}</title>
          </path>
        ))}
      </svg>
    </div>
  )
}

/** Names the country and its state in words — colour is never the only signal. */
function describe(code: string, state: RegionState, visits: number): string {
  const label = REGION_STATE_META[state].label
  const detail =
    state === 'visited' && visits > 0
      ? `${label} · ${visits} ${visits === 1 ? 'trip' : 'trips'}`
      : label
  return `${countryName(code)} — ${detail}`
}
