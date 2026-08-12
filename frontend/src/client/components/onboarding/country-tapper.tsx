'use client'

import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { MapView } from '@/client/components/map/map-view'
import { ALL_COUNTRIES, countryFlag, countryName } from '@/shared/geo/countries'
import type { VisitedRegion } from '@/shared/types/globe'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { cn } from '@/shared/utils'

/**
 * "Tap the countries you have already been to" — the payoff moment.
 *
 * Two surfaces onto one selection, and the pairing is a rule this app applies to
 * every map: the map is a presentation surface, unreachable by keyboard and
 * invisible to a screen reader, so it is always accompanied by a list carrying
 * the same data. Here the list is also simply faster for someone who knows they
 * want Japan and does not want to find it on a globe.
 *
 * The map repaints from `regions`, which is derived from the current selection
 * rather than fetched — so a tap is green before any request is made. Saving
 * happens once, on the way to the next step.
 */
export function CountryTapper({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<string>
  onToggle: (code: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')

  // What the map paints. Built from the selection so the fill follows the tap
  // immediately; `visitCount: 0` is honest — a mark records no trips.
  const regions: VisitedRegion[] = useMemo(
    () =>
      [...selected].map((code) => ({
        countryCode: code,
        regionCode: '',
        state: 'visited' as const,
        visitCount: 0,
        visitTripIds: [],
        firstVisit: null,
        lastVisit: null,
        tripIds: [],
        cityNames: [],
        featuredMediaId: null,
        featuredMediaUrl: null,
      })),
    [selected]
  )

  const trimmed = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!trimmed) return []
    return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(trimmed)).slice(0, 8)
  }, [trimmed])

  // Newest first: the country just added should be the one you can see.
  const chosen = useMemo(() => [...selected].reverse(), [selected])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="h-[24rem] overflow-hidden rounded-xl border lg:h-[26rem]">
          <MapView
            regions={regions}
            admin1Countries={[]}
            visibleStates={['visited']}
            onSelectCountry={onToggle}
            className="size-full"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a country"
              aria-label="Search for a country to add"
              className="pl-9"
            />
          </div>

          {matches.length > 0 && (
            <ul className="overflow-hidden rounded-lg border">
              {matches.map((country) => {
                const isSelected = selected.has(country.code)
                return (
                  <li key={country.code}>
                    <button
                      type="button"
                      onClick={() => {
                        onToggle(country.code)
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span aria-hidden>{country.flag}</span>
                      <span className="flex-1 truncate">{country.name}</span>
                      {isSelected && (
                        <Check className="size-4 text-globe-visited" aria-label="Already added" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* The selection, as text. This is what makes the choice reviewable
              without looking at the map — and removable without hunting for a
              country on it. */}
          <div className="min-h-0 flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selected.size} {selected.size === 1 ? 'country' : 'countries'}
              </p>
              {selected.size > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                  Clear
                </Button>
              )}
            </div>

            {selected.size === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tap the map, or search above. You can change all of this later.
              </p>
            ) : (
              <ul className="flex max-h-[14rem] flex-wrap gap-1.5 overflow-y-auto">
                {chosen.map((code) => (
                  <li key={code}>
                    <Badge
                      variant="secondary"
                      className={cn('gap-1 py-1 pr-1 pl-2', 'hover:bg-secondary')}
                    >
                      <span aria-hidden>{countryFlag(code)}</span>
                      {countryName(code)}
                      <button
                        type="button"
                        onClick={() => onToggle(code)}
                        aria-label={`Remove ${countryName(code)}`}
                        className="rounded-full p-0.5 hover:bg-foreground/10"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
