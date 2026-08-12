import type { Metadata } from 'next'
import Link from 'next/link'
import { MapExplorer } from '@/client/components/map/map-explorer'
import { getRegionDetail, getVisitedRegions } from '@/server/queries/globe'
import { FREE_ADMIN1_COUNTRY } from '@/shared/geo/admin1'
import { Button } from '@/client/components/ui/button'

export const metadata: Metadata = {
  title: 'India map',
  description: 'State-level tracking across India, free on every plan.',
}

export const dynamic = 'force-dynamic'

/**
 * The India map — screen 17.
 *
 * State-level detail here is free on every plan, unlike the world map, so this
 * page passes `showRegionDetail` unconditionally rather than consulting
 * entitlements. That is the plan's deliberate asymmetry: India's states are a
 * headline free feature, and everywhere else is the upgrade.
 *
 * The architecture generalises to any country's admin-1 — this page differs
 * from a hypothetical `/maps/[country]` only in the hardcoded country and the
 * skipped entitlement check.
 */
export default async function IndiaMapPage() {
  const regions = await getVisitedRegions()

  async function loadRegionDetail(countryCode: string) {
    'use server'
    return getRegionDetail(countryCode)
  }

  const indiaRegions = regions.filter((r) => r.countryCode === FREE_ADMIN1_COUNTRY)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
        <h1 className="text-xl font-semibold tracking-tight">India</h1>
        <p className="text-sm text-muted-foreground">
          {indiaRegions.length > 0
            ? 'State by state. Free on every plan, including the states you have not reached yet.'
            : 'No trips to India yet. Add one with a state and it will fill in here.'}
        </p>
      </header>

      {indiaRegions.length === 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" nativeButton={false} render={<Link href="/trips/new" />}>
            Add a trip
          </Button>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/maps/world" />}
          >
            Open the world map
          </Button>
        </div>
      )}

      <MapExplorer
        regions={regions}
        loadRegionDetail={loadRegionDetail}
        showRegionDetail
        focusCountry={FREE_ADMIN1_COUNTRY}
      />
    </div>
  )
}
