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
import {
  ADMIN1_INDEX_URL,
  admin1Url,
  type Admin1Collection,
  type Admin1IndexEntry,
} from '@/shared/geo/admin1'
import { mapStyleUrl } from '@/shared/geo/map-style'
import {
  fillColorExpression,
  fillOpacityExpression,
  glowOpacityExpression,
  lineColorExpression,
  lineWidthExpression,
} from '@/shared/geo/map-paint'
import {
  REGION_STATE_META,
  resolveRegionStateColor,
  resolveThemeColor,
} from '@/shared/geo/region-state'
import type { RegionState } from '@/shared/geo/region-state'
import { indexRegions, regionKey, type VisitedRegion } from '@/shared/types/globe'
import type { LngLat } from '@/shared/geo/point'
import { publicEnv } from '@/shared/env'
import { cn } from '@/shared/utils'
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
  /**
   * Pixels to keep clear on the right when framing the world, for a panel
   * floating over the map. Without it the initial fit centres the world under
   * the panel and hides the half of Asia everything else is pointing at.
   */
  insetRight?: number
  className?: string
}

interface HoverInfo {
  x: number
  y: number
  name: string
  detail: string
}

/** Theme colours for the map's own surfaces, resolved from CSS custom properties. */
interface MapSurfaces {
  land: string
  coast: string
}

/**
 * The world without the ice: roughly Tierra del Fuego to northern Greenland.
 * What the world map fits itself to on load.
 */
const INHABITED_WORLD: LngLatBoundsLike = [
  [-168, -56],
  [178, 76],
]

/** Breathing room around the fit, before any panel inset is added. */
const PADDING = { top: 24, bottom: 24, left: 24, right: 24 }

export function MapView({
  regions,
  admin1Countries,
  visibleStates,
  onSelectCountry,
  focusCountry,
  onPickPoint,
  pin,
  insetRight = 0,
  className,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [countries, setCountries] = useState<CountryCollection | null>(null)
  const [loadedAdmin1, setLoadedAdmin1] = useState<{
    key: string
    data: Admin1Collection
  } | null>(null)
  const [colors, setColors] = useState<Record<RegionState, string> | null>(null)
  const [surfaces, setSurfaces] = useState<MapSurfaces | null>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [failed, setFailed] = useState(false)
  /** The feature currently carrying `hover` state, so it can be cleared. */
  const hovered = useRef<{ source: string; id: string } | null>(null)

  const regionIndex = useMemo(() => indexRegions(regions), [regions])
  const mapStyle = useMemo(() => mapStyleUrl(publicEnv().NEXT_PUBLIC_MAPTILER_KEY), [])

  // Region colours are CSS custom properties so they follow the theme; MapLibre
  // paint expressions need concrete values, so resolve them and re-resolve when
  // the theme class on <html> changes.
  useEffect(() => {
    const read = () => {
      setColors({
        visited: resolveRegionStateColor('visited'),
        current: resolveRegionStateColor('current'),
        planned: resolveRegionStateColor('planned'),
        unvisited: resolveRegionStateColor('unvisited'),
      })
      setSurfaces({
        land: resolveThemeColor('--map-land'),
        coast: resolveThemeColor('--map-coast'),
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
  //
  // Which countries have one is asked first, from the index the build writes.
  // Coverage is partial — nine countries today — so requesting a file per
  // visited country means a 404 for most of them on every load. The index is a
  // few hundred bytes, cached after the first map, and keeps this data-driven:
  // extending coverage still needs no code change here.
  const admin1Key = admin1Countries.join(',')
  useEffect(() => {
    if (!admin1Key) return

    let cancelled = false
    fetch(ADMIN1_INDEX_URL)
      .then((res) => (res.ok ? (res.json() as Promise<Admin1IndexEntry[]>) : []))
      .catch(() => [] as Admin1IndexEntry[])
      .then((index) => {
        const covered = new Set(index.map((entry) => entry.iso_a3))
        return Promise.all(
          admin1Key
            .split(',')
            .filter((iso) => covered.has(iso))
            .map((iso) =>
              fetch(admin1Url(iso))
                .then((res) => (res.ok ? (res.json() as Promise<Admin1Collection>) : null))
                .catch(() => null)
            )
        )
      })
      .then((collections) => {
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

  /**
   * Frames the map: one country in country mode, the inhabited world otherwise.
   *
   * The world fit is not cosmetic. A fixed centre and zoom cannot suit both a
   * short laptop window and a tall one, and the tall one was left with a third
   * of the map as empty ocean below Patagonia. Fitting bounds asks the viewport
   * what it can show.
   *
   * Runs once per *framing*, not once per render: the view belongs to whoever
   * is panning it, so an unrelated re-render must not yank them back to the
   * whole world. It does re-frame when the thing being framed changes — a
   * different country, or the places panel opening and taking a third of the
   * width, which otherwise leaves the map fitted to a region now behind glass.
   */
  const framedFor = useRef<string | null>(null)
  const frameKey = `${focusCountry ?? 'world'}:${insetRight}`

  const frameView = useCallback(() => {
    const map = mapRef.current
    if (!map || !countries || framedFor.current === frameKey) return

    if (focusCountry) {
      const feature = countries.features.find((f) => f.properties.iso_a3 === focusCountry)
      if (!feature) return

      const bounds = boundsOf(feature.geometry)
      if (!bounds) return
      map.fitBounds(bounds, { padding: { ...PADDING, right: 48 + insetRight }, duration: 0 })
    } else {
      // Antarctica is excluded on purpose: including it spends a third of the
      // height on an ice shelf nobody has a trip to, and Mercator stretches it
      // to absurdity anyway.
      map.fitBounds(INHABITED_WORLD, {
        padding: { ...PADDING, right: PADDING.right + insetRight },
        duration: 0,
      })
    }

    framedFor.current = frameKey
  }, [countries, focusCountry, frameKey, insetRight])

  useEffect(() => {
    frameView()
  }, [frameView])

  /**
   * Moves the `hover` feature-state from whatever had it to this feature.
   *
   * Kept in a ref rather than React state: it changes on every mouse move, and
   * the only thing that consumes it is a GPU paint expression. Re-rendering the
   * component for it would be a render per frame for no visible difference.
   */
  const setHoveredFeature = useCallback((next: { source: string; id: string } | null) => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const previous = hovered.current
    if (previous?.source === next?.source && previous?.id === next?.id) return

    if (previous && map.getSource(previous.source)) {
      map.setFeatureState({ source: previous.source, id: previous.id }, { hover: false })
    }
    if (next && map.getSource(next.source)) {
      map.setFeatureState({ source: next.source, id: next.id }, { hover: true })
    }
    hovered.current = next
  }, [])

  const handleHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature) {
        setHover(null)
        setHoveredFeature(null)
        return
      }

      const props = feature.properties as Record<string, string | null>
      const code = props.region_code ?? props.iso_a3
      if (!code) {
        setHover(null)
        setHoveredFeature(null)
        return
      }

      setHoveredFeature({
        source: props.region_code ? 'admin1' : 'countries',
        id: code,
      })

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
    [regionIndex, setHoveredFeature]
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

  if (!countries || !colors || !surfaces) {
    return (
      <div className={className}>
        <Skeleton className="size-full" />
      </div>
    )
  }

  const fillColor = fillColorExpression(colors)
  const fillOpacity = fillOpacityExpression()
  const lineColor = lineColorExpression(colors, surfaces.coast)
  const glowOpacity = glowOpacityExpression()

  return (
    <div className={cn('relative isolate', className)}>
      {/* The sea. A CSS gradient rather than a MapLibre background layer: it has
          to re-colour itself the moment the theme changes, and swapping the
          style would make MapLibre rebuild every source and re-upload the
          geometry to do it. Deeper towards the edges, so the map has a middle. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-map-water"
        style={{
          backgroundImage:
            'radial-gradient(120% 90% at 50% 35%, var(--map-water) 0%, var(--map-water-deep) 100%)',
        }}
      />

      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{ longitude: 20, latitude: 25, zoom: 1.2 }}
        // Down to 0, where the whole world is 512px: the initial fit reserves
        // room for the places panel, and clamping at 0.6 left it unable to zoom
        // out far enough to honour that — which cropped the Americas rather
        // than shrinking the world.
        minZoom={0}
        maxZoom={8}
        // Rendering only what we draw: the polygons are the content, and the
        // basemap — when there is one — is context.
        attributionControl={{ compact: true }}
        interactiveLayerIds={admin1 ? ['country-fill', 'admin1-fill'] : ['country-fill']}
        onLoad={() => {
          applyFeatureStates()
          frameView()
        }}
        onSourceData={(event) => {
          if (event.isSourceLoaded) applyFeatureStates()
        }}
        onMouseMove={handleHover}
        onMouseOut={() => {
          setHover(null)
          setHoveredFeature(null)
        }}
        onClick={handleClick}
        cursor={onPickPoint ? 'crosshair' : 'pointer'}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Bottom-right: the top-right corner belongs to the places panel, and
            the two used to overlap on a phone. */}
        <NavigationControl position="bottom-right" showCompass={false} />

        <Source id="countries" type="geojson" data={countries} promoteId="iso_a3">
          {/* Land first, opaque, so every country is a landmass against the sea
              before any of them is a colour. Without this the unvisited world
              was a 25%-opacity wash over nothing. */}
          <Layer id="country-land" type="fill" paint={{ 'fill-color': surfaces.land }} />
          {/* The halo sits between land and fill: inside the coastline, under
              the colour, so it reads as the country glowing rather than as a
              second border. */}
          <Layer
            id="country-glow"
            type="line"
            paint={{
              'line-color': lineColor,
              'line-width': 6,
              'line-blur': 6,
              'line-opacity': glowOpacity,
            }}
          />
          <Layer
            id="country-fill"
            type="fill"
            paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
          />
          <Layer
            id="country-line"
            type="line"
            paint={{
              'line-color': lineColor,
              'line-width': lineWidthExpression(2, 0.6),
              'line-opacity': 0.9,
            }}
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
              paint={{
                'line-color': lineColor,
                'line-width': lineWidthExpression(1.6, 0.5),
                'line-opacity': 0.75,
              }}
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
          className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-neutral-900/85 px-3 py-2 text-xs leading-tight text-white shadow-lg backdrop-blur-sm"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <strong className="font-medium">{hover.name}</strong>
          <br />
          <span className="text-white/70">{hover.detail}</span>
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
