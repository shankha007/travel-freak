import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaticChoropleth } from '@/client/components/globe/static-choropleth'
import type { VisitedRegion } from '@/shared/types/globe'

/**
 * The fallback map, exercised rather than assumed.
 *
 * This surface exists for a visitor whose browser cannot run the globe, which
 * makes it exactly the surface nobody looks at — so it is tested by mounting it,
 * not by reading it. The harness browser cannot help here for the documented
 * reason (nothing composites, so WebGL never initialises and neither renderer can
 * be photographed), and these assertions do not need it: everything this
 * component produces is DOM.
 *
 * The projection itself is `shared/geo/project.ts` and has its own tests. What is
 * asserted here is the part that is this component's own: which countries become
 * their own path, what colour each one is given, and whether a person who cannot
 * see colour is told the same thing anyway.
 */

/** Two square "countries", which is all the geometry an assertion needs. */
const COUNTRIES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'India', iso_a3: 'IND', iso_num: '356' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [70, 30],
            [80, 30],
            [80, 20],
            [70, 20],
            [70, 30],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Japan', iso_a3: 'JPN', iso_num: '392' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [135, 40],
            [140, 40],
            [140, 35],
            [135, 35],
            [135, 40],
          ],
        ],
      },
    },
    {
      // No ISO code — a territory Natural Earth carries without an entry. It can
      // never be visited and must still be drawn, or the world has holes in it.
      type: 'Feature',
      properties: { name: 'Somewhere', iso_a3: null, iso_num: '-99' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 5],
            [5, 5],
            [5, 0],
            [0, 0],
            [0, 5],
          ],
        ],
      },
    },
  ],
}

const region = (overrides: Partial<VisitedRegion> = {}): VisitedRegion =>
  ({
    countryCode: 'IND',
    regionCode: null,
    state: 'visited',
    visitCount: 3,
    cityNames: [],
    firstVisit: null,
    lastVisit: null,
    tripIds: [],
    featuredMediaUrl: null,
    ...overrides,
  }) as VisitedRegion

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(COUNTRIES), { status: 200 }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * How long to wait for the geometry fetch to resolve and the SVG to appear.
 *
 * Testing Library's default is one second, which is ample on an idle machine and
 * is not always ample on a loaded CI runner — this file is the only one here that
 * waits on anything asynchronous, and a full run under load produced two
 * unattributed failures once. Three seconds costs nothing when the assertion
 * passes, because `waitFor` returns as soon as it does.
 */
const WAIT = 3000

/** Waits past the geometry fetch, which is what replaces the skeleton. */
async function renderMap(regions: VisitedRegion[], onSelect = vi.fn()) {
  const view = render(
    <StaticChoropleth regions={regions} onSelectCountry={onSelect} className="size-full" />
  )
  await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument(), { timeout: WAIT })
  return { ...view, onSelect }
}

describe('StaticChoropleth', () => {
  it('draws a country with data as its own path, and everything else as one', async () => {
    const { container } = await renderMap([region()])

    // Three shapes, two paths: India on its own, Japan and the unnamed territory
    // merged into the base. The split is what keeps the DOM small on a world map
    // while leaving the countries somebody has visited clickable.
    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(2)
  })

  it('gives each state its own fill, through the theme variable', async () => {
    const { container } = await renderMap([
      region({ countryCode: 'IND', state: 'visited' }),
      region({ countryCode: 'JPN', state: 'planned', visitCount: 0 }),
    ])

    const fills = [...container.querySelectorAll('path')].map((p) => p.getAttribute('fill'))
    // `var()` and not a resolved colour: an SVG path is a DOM node, so it follows
    // the theme picker without the canvas round-trip the WebGL globe needs.
    expect(fills).toContain('var(--globe-visited)')
    expect(fills).toContain('var(--globe-planned)')
    expect(fills).toContain('var(--globe-unvisited)')
  })

  it('never lets colour be the only signal', async () => {
    await renderMap([region({ countryCode: 'IND', state: 'visited', visitCount: 3 })])

    // Queried by accessible name, which is what a screen reader is actually
    // given — and the reason the shape carries `aria-label` as well as `<title>`.
    // It names the state in words: `region-state.ts` makes that a contract for
    // every surface that paints a region, and this is that surface keeping it.
    expect(screen.getByRole('button', { name: 'India — Visited · 3 trips' })).toBeInTheDocument()
  })

  it('says "trip" in the singular', async () => {
    await renderMap([region({ visitCount: 1 })])
    expect(screen.getByRole('button', { name: 'India — Visited · 1 trip' })).toBeInTheDocument()
  })

  it('names a state that has no visit count without a dangling number', async () => {
    await renderMap([region({ countryCode: 'JPN', state: 'planned', visitCount: 0 })])
    expect(screen.getByRole('button', { name: 'Japan — Planned' })).toBeInTheDocument()
  })

  it('describes the whole map, and points at the list beside it', async () => {
    await renderMap([region()])

    // The image label has to carry the count: a screen reader gets no picture, and
    // "world map" alone tells them nothing they did not already know.
    const svg = screen.getByRole('img')
    expect(svg).toHaveAccessibleName(/1 country filled in/)
    expect(svg).toHaveAccessibleName(/list beside it/)
  })

  it('opens a country when its shape is activated', async () => {
    const { onSelect } = await renderMap([region()])

    await userEvent.click(screen.getByRole('button', { name: /India/ }))
    expect(onSelect).toHaveBeenCalledWith('IND')
  })

  it('opens one from the keyboard too', async () => {
    const { onSelect } = await renderMap([region()])

    // A `path` is not a button, so the role, the tab stop and Enter are all
    // spelled out in the component. The region list is still the intended
    // keyboard path — this is so that a shape which *can* be focused is not inert.
    screen.getByRole('button', { name: /India/ }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('IND')
  })

  it('draws an unvisited world rather than an empty one', async () => {
    const { container } = await renderMap([])

    // Every shape in the base path, nothing filled, and no holes: an account with
    // no trips yet gets a world, not a blank rectangle.
    expect(container.querySelectorAll('path')).toHaveLength(1)
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('var(--globe-unvisited)')
  })

  it('treats a region marked unvisited as part of the base', async () => {
    const { container } = await renderMap([region({ state: 'unvisited', visitCount: 0 })])
    expect(container.querySelectorAll('path')).toHaveLength(1)
  })

  it('still renders when the geometry cannot be fetched', async () => {
    // The region list beside it carries the same data, so a failed fetch costs
    // the picture and not the page — the same choice `GlobeView` makes.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 }))
    )

    render(<StaticChoropleth regions={[region()]} onSelectCountry={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument(), { timeout: WAIT })
    expect(screen.getByRole('img')).toHaveAccessibleName(/0 countries filled in/)
  })
})
