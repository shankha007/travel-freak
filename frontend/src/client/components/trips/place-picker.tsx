'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, Trash2 } from 'lucide-react'
import { MapView, type PickedPoint } from '@/client/components/map/map-view'
import { canSearchPlaces, searchPlaces, type GeocodeResult } from '@/shared/geo/geocode'
import { alpha2ToAlpha3, countryFlag, countryName } from '@/shared/geo/countries'
import { formatLngLat, type LngLat } from '@/shared/geo/point'
import { publicEnv } from '@/shared/env'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'

/** What the picker hands back when the user confirms. */
export interface PickedPlace {
  lng: number
  lat: number
  /** ISO alpha-3, when the map or the search result knew it. */
  countryCode: string | null
  /** Suggested city name, only ever from a search result. */
  cityName: string | null
}

const SEARCH_DEBOUNCE_MS = 350

/**
 * Sets a place's coordinates — the map picker the create wizard was missing.
 *
 * Two ways to answer the same question, because they fail differently. Search
 * needs a MapTiler key and a network; clicking the map needs neither, since the
 * country polygons are a static asset this app ships. So the map is the primary
 * surface and search is an accelerator that disappears when it cannot work.
 *
 * A click reports both the coordinate and the country under it, which is why
 * this can fill in the country field too: the polygon that was clicked is the
 * same data the globe paints, so the two can never disagree about where a pin is.
 *
 * The pin is only committed on Save. Clicking around a map is exploratory, and a
 * mis-click should not silently rewrite a stored place.
 */
export function PlacePicker({
  open,
  onOpenChange,
  initial,
  label,
  onPick,
  onClear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing pin, if this place already has one. */
  initial: LngLat | null
  /** Country or city name for the dialog title, so it is clear which row. */
  label: string
  onPick: (place: PickedPlace) => void
  onClear: () => void
}) {
  const mapTilerKey = publicEnv().NEXT_PUBLIC_MAPTILER_KEY

  // Initialised from the prop, never synced to it: the caller keys this component
  // on the place it is editing, so opening a different row — or reopening the same
  // one — remounts with the stored pin rather than copying props into state.
  const [pin, setPin] = useState<LngLat | null>(initial)
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)

  const searchable = canSearchPlaces(mapTilerKey)
  const queryIsSearchable = searchable && query.trim().length >= 2
  // Derived rather than cleared in an effect: a query too short to search shows
  // nothing, and there is no state transition to keep in sync.
  const visibleResults = queryIsSearchable ? results : []

  const latestQuery = useRef(0)

  useEffect(() => {
    if (!queryIsSearchable) return

    const controller = new AbortController()
    const id = ++latestQuery.current

    const timer = setTimeout(async () => {
      setSearching(true)
      const found = await searchPlaces(query, mapTilerKey, { signal: controller.signal })
      // A slow earlier request must not overwrite a later one's results.
      if (id !== latestQuery.current) return
      setResults(found)
      setSearching(false)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, mapTilerKey, queryIsSearchable])

  // Plain functions: the React Compiler memoizes these, and a manual useCallback
  // with an empty dependency list is what it refuses to compile around.
  function handleMapPick(point: PickedPoint) {
    setPin({ lng: point.lng, lat: point.lat })
    setCountryCode(point.countryCode)
    // Clicking the map says where, not what it is called.
    setCityName(null)
  }

  function handleResult(result: GeocodeResult) {
    setPin({ lng: result.lng, lat: result.lat })
    setCountryCode(alpha2ToAlpha3(result.countryCode))
    setCityName(result.name)
    setResults([])
    setQuery(result.name)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Where was {label}?</DialogTitle>
          <DialogDescription>
            {searchable
              ? 'Search for the place, or click the map. Coordinates are what make distance travelled and the vault’s map work.'
              : 'Click the map to drop a pin. Search needs a MapTiler key, which this build does not have — the outlines are local, so clicking still works.'}
          </DialogDescription>
        </DialogHeader>

        {searchable && (
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Leh, Ladakh"
                  aria-label="Search for a place"
                  className="pl-9"
                />
              </div>
              {searching && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              )}
            </div>

            {visibleResults.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                {visibleResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => handleResult(result)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className="text-sm font-medium">{result.name}</span>
                      <span className="text-xs text-muted-foreground">{result.context}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* No regions to paint here: this map is a coordinate surface, so the
            fills stay unvisited grey and the pin is the only thing to look at. */}
        <div className="h-[22rem] overflow-hidden rounded-lg border">
          <MapView
            regions={[]}
            admin1Countries={[]}
            visibleStates={[]}
            onSelectCountry={() => {}}
            onPickPoint={handleMapPick}
            pin={pin}
            className="size-full"
          />
        </div>

        <p className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground">
          {pin ? (
            <>
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="tabular-nums">{formatLngLat(pin)}</span>
              {countryCode && (
                <span>
                  · {countryFlag(countryCode)} {countryName(countryCode)}
                </span>
              )}
              {cityName && <span>· {cityName}</span>}
            </>
          ) : (
            'No pin yet.'
          )}
        </p>

        <DialogFooter className="gap-2">
          {initial && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClear()
                onOpenChange(false)
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Remove pin
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!pin}
            onClick={() => {
              if (!pin) return
              onPick({ lng: pin.lng, lat: pin.lat, countryCode, cityName })
              onOpenChange(false)
            }}
          >
            Use this pin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
