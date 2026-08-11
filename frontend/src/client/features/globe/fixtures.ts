import type { RegionDetail, VisitedRegion } from '@/shared/types/globe'
import { countryName } from '@/shared/geo/countries'

/**
 * Demo data for the marketing globe and for local development before the
 * database is provisioned.
 *
 * Replaced by the real `visited_regions` query in queries.ts once the schema is
 * live. Kept in its own module so it never leaks into an authenticated path by
 * accident — anything importing this is rendering a demo, not a user's data.
 */
/**
 * Synthetic ids for the trips behind a demo visit count.
 *
 * `visitCount` is derived from these rather than written by hand, so the demo
 * data obeys the same invariant the aggregate does: the count is the size of
 * the trip set.
 */
function demoVisits(countryCode: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `demo-${countryCode.toLowerCase()}-visit-${i + 1}`)
}

function demoRegion(region: Omit<VisitedRegion, 'visitCount'>): VisitedRegion {
  return { ...region, visitCount: region.visitTripIds.length }
}

export const DEMO_REGIONS: VisitedRegion[] = [
  demoRegion({
    countryCode: 'IND',
    regionCode: '',
    state: 'visited',
    visitTripIds: demoVisits('IND', 9),
    firstVisit: '2019-02-14',
    lastVisit: '2026-05-22',
    tripIds: ['demo-1', 'demo-2', 'demo-3'],
    cityNames: ['Bengaluru', 'Rishikesh', 'Goa', 'Leh', 'Kolkata'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'NPL',
    regionCode: '',
    state: 'visited',
    visitTripIds: demoVisits('NPL', 2),
    firstVisit: '2023-10-02',
    lastVisit: '2023-10-19',
    tripIds: ['demo-4'],
    cityNames: ['Kathmandu', 'Pokhara'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'JPN',
    regionCode: '',
    state: 'visited',
    visitTripIds: demoVisits('JPN', 1),
    firstVisit: '2025-04-01',
    lastVisit: '2025-04-14',
    tripIds: ['demo-5'],
    cityNames: ['Tokyo', 'Kyoto', 'Osaka'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'THA',
    regionCode: '',
    state: 'visited',
    visitTripIds: demoVisits('THA', 3),
    firstVisit: '2022-01-08',
    lastVisit: '2024-11-30',
    tripIds: ['demo-6'],
    cityNames: ['Bangkok', 'Chiang Mai'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'ARE',
    regionCode: '',
    state: 'visited',
    visitTripIds: demoVisits('ARE', 1),
    firstVisit: '2021-12-03',
    lastVisit: '2021-12-09',
    tripIds: ['demo-7'],
    cityNames: ['Dubai'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'SGP',
    regionCode: '',
    state: 'current',
    visitTripIds: demoVisits('SGP', 1),
    firstVisit: '2026-08-02',
    lastVisit: '2026-08-12',
    tripIds: ['demo-8'],
    cityNames: ['Singapore'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'BTN',
    regionCode: '',
    state: 'planned',
    visitTripIds: [],
    firstVisit: '2026-11-05',
    lastVisit: '2026-11-15',
    tripIds: ['demo-9'],
    cityNames: ['Thimphu', 'Paro'],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
  demoRegion({
    countryCode: 'ISL',
    regionCode: '',
    state: 'planned',
    visitTripIds: [],
    firstVisit: null,
    lastVisit: null,
    tripIds: [],
    cityNames: [],
    featuredMediaId: null,
    featuredMediaUrl: null,
  }),
]

const DEMO_DETAIL: Record<string, Partial<RegionDetail>> = {
  IND: {
    trips: [
      {
        id: 'demo-3',
        title: 'Ladakh on two wheels',
        slug: 'ladakh-on-two-wheels',
        startDate: '2026-05-08',
        endDate: '2026-05-22',
        summary: 'Manali to Leh over five passes, and the long quiet road to Pangong.',
        coverMediaUrl: null,
        blogSlug: 'ladakh-on-two-wheels',
        photoCount: 148,
      },
      {
        id: 'demo-2',
        title: 'Monsoon in Rishikesh',
        slug: 'monsoon-in-rishikesh',
        startDate: '2024-07-19',
        endDate: '2024-07-26',
        summary: 'Rafting, riverside cafes, and far too much chai.',
        coverMediaUrl: null,
        blogSlug: null,
        photoCount: 62,
      },
    ],
    memories: [
      {
        id: 'm1',
        kind: 'quote',
        body: 'Stopped the bike at Tanglang La just to hear how quiet 17,500 feet is.',
        happenedAt: '2026-05-14',
        mediaUrl: null,
      },
      {
        id: 'm2',
        kind: 'note',
        body: 'The dhaba before Pang serves the best rajma of the entire trip. No sign, blue tarp.',
        happenedAt: '2026-05-13',
        mediaUrl: null,
      },
    ],
  },
  JPN: {
    trips: [
      {
        id: 'demo-5',
        title: 'Cherry blossom chase',
        slug: 'cherry-blossom-chase',
        startDate: '2025-04-01',
        endDate: '2025-04-14',
        summary: 'Tokyo to Kyoto, timed badly and still perfect.',
        coverMediaUrl: null,
        blogSlug: 'cherry-blossom-chase',
        photoCount: 210,
      },
    ],
    memories: [
      {
        id: 'm3',
        kind: 'note',
        body: 'Missed peak bloom in Kyoto by four days. Philosopher’s Path was still worth it.',
        happenedAt: '2025-04-09',
        mediaUrl: null,
      },
    ],
  },
}

/** Builds demo detail for the region modal. */
export function demoRegionDetail(countryCode: string): RegionDetail | null {
  const region = DEMO_REGIONS.find((r) => r.countryCode === countryCode)
  if (!region) return null

  const extra = DEMO_DETAIL[countryCode] ?? {}
  return {
    countryCode,
    regionCode: '',
    countryName: countryName(countryCode),
    state: region.state,
    visitCount: region.visitCount,
    firstVisit: region.firstVisit,
    lastVisit: region.lastVisit,
    cityNames: region.cityNames,
    featuredMediaUrl: region.featuredMediaUrl,
    trips: extra.trips ?? [],
    memories: extra.memories ?? [],
  }
}
