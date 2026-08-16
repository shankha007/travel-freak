'use client'

import { Filter, X } from 'lucide-react'
import type { VisitedRegion } from '@/shared/types/globe'
import { CONTINENT_LABEL, type Continent } from '@/shared/geo/continents'
import { TRIP_TYPE_LABELS, type TripType } from '@/shared/analytics'
import {
  NO_REGION_FILTER,
  availableContinents,
  availableTripTypes,
  availableYears,
  isFiltered,
  type RegionFilter,
} from '@/shared/geo/region-filter'
import { Button } from '@/client/components/ui/button'
import { cn } from '@/shared/utils'

/**
 * Year, continent and trip type, for the globe and the world map — screens 14
 * and 16.
 *
 * Two native `<select>`s rather than the styled picker used elsewhere. These
 * float over a map on a screen that is already carrying layer toggles, a places
 * panel and a modal; a native control is the one that a phone renders as its
 * own wheel, needs no portal above a WebGL canvas, and cannot be left open
 * behind the panel that slides over it.
 *
 * Only the years, continents and trip types the data can answer for are
 * offered, so no choice here can empty the map. Trip type is the newest of the
 * three and the one the aggregate cannot answer by itself: `visited_regions`
 * carries trip ids, and the kinds behind them are resolved by the owner's own
 * query. On a read that does not resolve them the option list comes back empty
 * and the control simply does not render.
 */
export function RegionFilters({
  regions,
  filter,
  onChange,
  className,
}: {
  /** The unfiltered rows — the options have to describe everything available. */
  regions: VisitedRegion[]
  filter: RegionFilter
  onChange: (filter: RegionFilter) => void
  className?: string
}) {
  const years = availableYears(regions)
  const continents = availableContinents(regions)
  const tripTypes = availableTripTypes(regions)

  // Nothing to narrow: one continent, no dated visit and at most one kind of
  // trip is not a filter, it is three controls that can only be set to what is
  // already showing.
  if (years.length === 0 && continents.length < 2 && tripTypes.length < 2) return null

  const selectClass =
    'h-7 rounded-md border border-border/60 bg-background/80 px-1.5 text-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="size-3.5" aria-hidden />
        Filter
      </span>

      {years.length > 0 && (
        <select
          className={selectClass}
          aria-label="Filter by year"
          value={filter.year ?? ''}
          onChange={(event) =>
            onChange({ ...filter, year: event.target.value ? Number(event.target.value) : null })
          }
        >
          <option value="">Any year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}

      {continents.length > 1 && (
        <select
          className={selectClass}
          aria-label="Filter by continent"
          value={filter.continent ?? ''}
          onChange={(event) =>
            onChange({ ...filter, continent: (event.target.value || null) as Continent | null })
          }
        >
          <option value="">Anywhere</option>
          {continents.map((continent) => (
            <option key={continent} value={continent}>
              {CONTINENT_LABEL[continent]}
            </option>
          ))}
        </select>
      )}

      {tripTypes.length > 1 && (
        <select
          className={selectClass}
          aria-label="Filter by trip type"
          value={filter.tripType ?? ''}
          onChange={(event) =>
            onChange({ ...filter, tripType: (event.target.value || null) as TripType | null })
          }
        >
          <option value="">Any trip</option>
          {tripTypes.map((type) => (
            <option key={type} value={type}>
              {TRIP_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      )}

      {isFiltered(filter) && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onChange(NO_REGION_FILTER)}
          aria-label="Clear the filters"
        >
          <X className="size-3" aria-hidden />
          Clear
        </Button>
      )}
    </div>
  )
}

/**
 * What the filter is currently hiding, in words.
 *
 * Under the count rather than beside the controls: the honest caveat about the
 * year is only worth reading once somebody has picked one, and it belongs next
 * to the number it qualifies.
 */
export function RegionFilterNote({
  filter,
  shown,
  total,
}: {
  filter: RegionFilter
  shown: number
  total: number
}) {
  if (!isFiltered(filter)) return null

  return (
    <p className="text-xs text-muted-foreground">
      Showing {shown} of {total}.
      {filter.year !== null && (
        <>
          {' '}
          A place counts for {filter.year} if that year falls between your first and last visit —
          which is all the aggregate behind this map records.
        </>
      )}
      {filter.tripType !== null && (
        <>
          {' '}
          A place counts as “{TRIP_TYPE_LABELS[filter.tripType].toLowerCase()}” if any one trip
          there was — not if every trip was. Places with no trip behind them, or none you gave a
          type, are left out.
        </>
      )}
    </p>
  )
}
