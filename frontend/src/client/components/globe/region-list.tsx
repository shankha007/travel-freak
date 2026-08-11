'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { countryFlag, countryName } from '@/shared/geo/countries'
import { REGION_STATE_META } from '@/shared/geo/region-state'
import type { VisitedRegion } from '@/shared/types/globe'
import { Input } from '@/client/components/ui/input'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { cn } from '@/shared/utils'

interface RegionListProps {
  regions: VisitedRegion[]
  selectedCountry: string | null
  onSelectCountry: (countryCode: string) => void
  className?: string
}

/**
 * Keyboard-navigable list of visited regions.
 *
 * This is not a secondary convenience — it is the accessible equivalent of the
 * globe. A WebGL canvas exposes nothing to assistive technology, so every action
 * available by clicking the globe must be available here, reaching the same
 * region modal.
 */
export function RegionList({
  regions,
  selectedCountry,
  onSelectCountry,
  className,
}: RegionListProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const withNames = regions
      .filter((r) => r.state !== 'unvisited')
      .map((r) => ({ region: r, name: countryName(r.countryCode) }))

    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? withNames.filter(
          ({ region, name }) =>
            name.toLowerCase().includes(needle) ||
            region.cityNames.some((c) => c.toLowerCase().includes(needle))
        )
      : withNames

    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [regions, query])

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places"
          aria-label="Search your visited places"
          className="pl-8"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-1 py-6 text-sm text-muted-foreground">
          {regions.length === 0
            ? 'No places yet. Add a trip and your globe starts filling in.'
            : 'No places match that search.'}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="space-y-1 pr-3">
            {visible.map(({ region, name }) => {
              const meta = REGION_STATE_META[region.state]
              const isSelected = region.countryCode === selectedCountry
              const flag = countryFlag(region.countryCode)

              return (
                <li key={region.countryCode}>
                  <button
                    type="button"
                    onClick={() => onSelectCountry(region.countryCode)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <span
                      className={cn('size-2.5 shrink-0 rounded-full', meta.fillClass)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        {flag && (
                          <span aria-hidden className="text-sm">
                            {flag}
                          </span>
                        )}
                        <span className="truncate text-sm font-medium">{name}</span>
                      </span>
                      {region.cityNames.length > 0 && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {region.cityNames.slice(0, 3).join(', ')}
                          {region.cityNames.length > 3 && ` +${region.cityNames.length - 3}`}
                        </span>
                      )}
                    </span>
                    {/* The state is spelled out for screen readers even though
                        sighted users get it from the swatch. */}
                    <span className="sr-only">{meta.label}</span>
                    {region.visitCount > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {region.visitCount}
                        <span className="sr-only">
                          {region.visitCount === 1 ? ' trip' : ' trips'}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
