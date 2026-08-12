'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import type { LngLatBoundsLike } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { COUNTRIES_GEOJSON_URL, countryName, type CountryCollection } from '@/shared/geo/countries'
import { admin1Url, type Admin1Collection } from '@/shared/geo/admin1'
import { mapStyleUrl } from '@/shared/geo/map-style'
import { fillColorExpression, fillOpacityExpression } from '@/shared/geo/map-paint'
import { REGION_STATE_META, resolveRegionStateColor } from '@/shared/geo/region-state'
import type { RegionState } from '@/shared/geo/region-state'
import { indexRegions, regionKey, type VisitedRegion } from '@/shared/types/globe'
import type { LngLat } from '@/shared/geo/point'
import { publicEnv } from '@/shared/env'
import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * The 2D map — screens 16 and 17.
 *
 * Two fill layers: countries always, subdivisions only when the caller says so.
 * On the world map that flag is the plan's paywall (`globe_region_detail`); on
 * the India map it is always on, because state-level India is free.
 *
 * Fills are joined to visited data through `feature-state` rather than baked
 * into the GeoJSON, so changing what is highlighted never re-uploads geometry to
 * the GPU. The join key is the ISO code promoted to the feature id.
 *
 * Like the globe, this is a presentation surface: it is unreachable by keyboard
 * and screen readers, so it must always be paired with the region list that
 * renders the same data.
 */

/** What a click produced: where, and which country was under it. */
export interface PickedPoint extends LngLat {
  /** ISO alpha-3 of the polygon clicked, or null in open water. */
  countryCode: string | null
}

interface MapViewProps {
  regions: VisitedRegion[]
  /** Draw subdivision polygons for these countries, in ISO alpha-3. */
  admin1Countries: string[]
  /** Which region states to paint. Unchecked states fall back to unvisited. */
  visibleStates: RegionState[]
  onSelectCountry: (countryCode: string) => void
  /** Starting view. Country mode fits to the country's polygons on load. */
  focusCountry?: string
  /**
   * Pick mode. When set, a click reports coordinates instead of selecting a
   * country, and `pin` is drawn where one has been placed. This is what the trip
   * form uses; the browsing maps leave both undefined and behave as before.
   */
  onPickPoint?: (point: PickedPoint) => void
  pin?: LngLat | null
  className?: string
}

interface HoverInfo {
  x: number
  y: number
  name: string
  detail: string
}

export function MapView({
  regions,
  admin1Countries,
  visibleStates,
  onSelectCountry,
  focusCountry,
  onPickPoint,
  pin,
  className,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [countries, setCountries] = useState<CountryCollection | null>(null)
  const [loadedAdmin1, setLoadedAdmin1] = useState<{
    key: string
    data: Admin1Collection
  } | null>(null)
  const [colors, setColors] = useState<Record<RegionState, string> | null>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [failed, setFailed] = useState(false)

  const regionIndex = useMemo(() => indexRegions(regions), [regions])
  const mapStyle = useMemo(() => mapStyleUrl(publicEnv().NEXT_PUBLIC_MAPTILER_KEY), [])

  // Region colours are CSS custom properties so they follow the theme; MapLibre
  // paint expressions need concrete values, so resolve them and re-resolve when
  // the theme class on <html> changes.
  useEffect(() => {
    const read = () =>
      setColors({
        visited: resolveRegionStateColor('visited'),
        current: resolveRegionStateColor('current'),
        planned: resolveRegionStateColor('planned'),
        unvisited: resolveRegionStateColor('unvisited'),
      })
    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(COUNTRIES_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<CountryCollection>
      })
      .then((data) => !cancelled && setCountries(data))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  // Subdivisions are fetched per country and merged, so a user with three
  // visited countries downloads three small files rather than the world.
  const admin1Key = admin1Countries.join(',')
  useEffect(() => {
    if (!admin1Key) return

    let cancelled = false
    Promise.all(
      admin1Key.split(',').map((iso) =>
        fetch(admin1Url(iso))
          .then((res) => (res.ok ? (res.json() as Promise<Admin1Collection>) : null))
          // A country with no admin-1 file is normal — coverage is partial.
          .catch(() => null)
      )
    ).then((collections) => {
      if (cancelled) return
      setLoadedAdmin1({
        key: admin1Key,
        data: {
          type: 'FeatureCollection',
          features: collections.flatMap((c) => c?.features ?? []),
        },
      })
    })

    return () => {
      cancelled = true
    }
  }, [admin1Key])

  // Tagged with the key it was loaded for, and read back only on a match: that
  // is what stops the previous country's states lingering on the map for a
  // frame after the selection changes, without an effect writing state.
  const admin1 = loadedAdmin1?.key === admin1Key && admin1Key ? loadedAdmin1.data : null

  /**
   * Pushes the visited data onto the rendered features.
   *
   * Runs on load and whenever the data changes, and is safe to call repeatedly —
   * MapLibre drops feature state for sources that have not finished loading, so
   * the `sourcedata` handler below calls it again once they have.
   */
  const applyFeatureStates = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    for (const [sourceId, isSubdivision] of [
      ['countries', false],
      ['admin1', true],
    ] as const) {
      if (!map.getSource(sourceId)) continue

      map.removeFeatureState({ source: sourceId })

      for (const region of regions) {
        const isRegionRow = region.regionCode !== ''
        if (isRegionRow !== isSubdivision) continue

        const id = isSubdivision ? region.regionCode : region.countryCode
        const state = visibleStates.includes(region.state) ? region.state : 'unvisited'
        map.setFeatureState({ source: sourceId, id }, { region: state, visits: region.visitCount })
      }
    }
  }, [regions, visibleStates])

  useEffect(() => {
    applyFeatureStates()
  }, [applyFeatureStates, countries, admin1])

  const fitToCountry = useCallback(() => {
    const map = mapRef.current
    if (!map || !focusCountry || !countries) return

    const feature = countries.features.find((f) => f.properties.iso_a3 === focusCountry)
    if (!feature) return

    const bounds = boundsOf(feature.geometry)
    if (bounds) map.fitBounds(bounds, { padding: 40, duration: 0 })
  }, [countries, focusCountry])

  useEffect(() => {
    fitToCountry()
  }, [fitToCountry])

  const handleHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature) {
        setHover(null)
        return
      }

      const props = feature.properties as Record<string, string | null>
      const code = props.region_code ?? props.iso_a3
      if (!code) {
        setHover(null)
        return
      }

      const region = regionIndex.get(
        props.region_code
          ? regionKey(props.iso_a3 ?? '', props.region_code)
          : regionKey(props.iso_a3 ?? '')
      )
      const state = region?.state ?? 'unvisited'
      const visits = region?.visitCount ?? 0

      setHover({
        x: event.point.x,
        y: event.point.y,
        name: props.name ?? countryName(props.iso_a3),
        // Never colour alone: the tooltip names the state in words.
        detail:
          state === 'visited' && visits > 0
            ? `${REGION_STATE_META[state].label} · ${visits} ${visits === 1 ? 'trip' : 'trips'}`
            : REGION_STATE_META[state].label,
      })
    },
    [regionIndex]
  )

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const props = event.features?.[0]?.properties as Record<string, string> | undefined

      // In pick mode every click is a coordinate, including one in open water —
      // a place can be at sea, and refusing the click would leave the user
      // clicking a map that appears not to work.
      if (onPickPoint) {
        onPickPoint({
          lng: event.lngLat.lng,
          lat: event.lngLat.lat,
          countryCode: props?.iso_a3 ?? null,
        })
        return
      }

      if (props?.iso_a3) onSelectCountry(props.iso_a3)
    },
    [onPickPoint, onSelectCountry]
  )

  if (failed) {
    return (
      <div className={className}>
        <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          The map could not load its country outlines. Your places are still listed alongside.
        </p>
      </div>
    )
  }

  if (!countries || !colors) {
    return (
      <div className={className}>
        <Skeleton className="size-full" />
      </div>
    )
  }

  const fillColor = fillColorExpression(colors)
  const fillOpacity = fillOpacityExpression()

  return (
    <div className={className}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{ longitude: 20, latitude: 25, zoom: 1.2 }}
        minZoom={0.6}
        maxZoom={8}
        // Rendering only what we draw: the polygons are the content, and the
        // basemap — when there is one — is context.
        attributionControl={{ compact: true }}
        interactiveLayerIds={admin1 ? ['country-fill', 'admin1-fill'] : ['country-fill']}
        onLoad={() => {
          applyFeatureStates()
          fitToCountry()
        }}
        onSourceData={(event) => {
          if (event.isSourceLoaded) applyFeatureStates()
        }}
        onMouseMove={handleHover}
        onMouseOut={() => setHover(null)}
        onClick={handleClick}
        cursor={onPickPoint ? 'crosshair' : 'pointer'}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source id="countries" type="geojson" data={countries} promoteId="iso_a3">
          <Layer
            id="country-fill"
            type="fill"
            paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
          />
          <Layer
            id="country-line"
            type="line"
            paint={{ 'line-color': 'rgba(0,0,0,0.35)', 'line-width': 0.5 }}
          />
        </Source>

        {admin1 && (
          <Source id="admin1" type="geojson" data={admin1} promoteId="region_code">
            <Layer
              id="admin1-fill"
              type="fill"
              paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
            />
            <Layer
              id="admin1-line"
              type="line"
              paint={{ 'line-color': 'rgba(0,0,0,0.25)', 'line-width': 0.4 }}
            />
          </Source>
        )}

        {/* The pin is drawn rather than added as a source: it is one point that
            moves on every click, and a GeoJSON source would be re-uploaded each
            time. `anchor="bottom"` puts the tip on the coordinate. */}
        {pin && (
          <Marker longitude={pin.lng} latitude={pin.lat} anchor="bottom">
            <span className="block size-4 -translate-y-1 rounded-full border-2 border-white bg-primary shadow-md" />
          </Marker>
        )}
      </Map>

      {/* A plain div rather than a MapLibre Popup: this is a hover hint, and a
          popup would take pointer events and fight the fills underneath. */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-neutral-900/92 px-2.5 py-1.5 text-xs leading-tight text-white shadow-md"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <strong className="font-medium">{hover.name}</strong>
          <br />
          {hover.detail}
        </div>
      )}
    </div>
  )
}

/** Bounding box of a polygon or multipolygon, for fitBounds. */
function boundsOf(geometry: GeoJSON.Geometry): LngLatBoundsLike | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const visit = (coords: unknown): void => {
    if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [x, y] = coords as [number, number]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      return
    }
    if (Array.isArray(coords)) coords.forEach(visit)
  }

  if ('coordinates' in geometry) visit(geometry.coordinates)
  if (minX === Infinity) return null

  return [
    [minX, minY],
    [maxX, maxY],
  ]
}
