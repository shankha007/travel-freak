import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '@/shared/navigation'
import { commandItems, commandSections, filterCommands, type CommandItem } from './command'

function item(overrides: Partial<CommandItem> = {}): CommandItem {
  return {
    id: 'x',
    label: 'Trips',
    href: '/trips',
    section: 'Go to',
    icon: 'Luggage',
    ...overrides,
  }
}

describe('commandItems', () => {
  it('offers every screen the nav knows about', () => {
    // Built from `shared/navigation.ts` rather than a list of its own, so a new
    // route cannot be unreachable from the palette without anybody noticing.
    const hrefs = commandItems().map((i) => i.href)

    for (const nav of NAV_ITEMS) {
      expect(hrefs).toContain(nav.href)
    }
  })

  it('adds the things you can create', () => {
    const ids = commandItems().map((i) => i.id)

    expect(ids).toContain('new-trip')
    expect(ids).toContain('new-post')
  })

  it('gives every item an id unique enough to key a list on', () => {
    const ids = commandItems().map((i) => i.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('filterCommands', () => {
  const items = [
    item({ id: 'trips', label: 'Trips', href: '/trips' }),
    item({ id: 'trash', label: 'Trash', href: '/trash' }),
    item({ id: 'wishlist', label: 'Wishlist', href: '/wishlist', keywords: ['travel', 'someday'] }),
  ]

  it('returns everything, in order, for an empty query', () => {
    // A palette opened and not typed into is a menu.
    expect(filterCommands(items, '')).toEqual(items)
    expect(filterCommands(items, '   ')).toEqual(items)
  })

  it('puts a label that starts with the query first', () => {
    // "tr" must offer Trips before Trash: both match, and one of them is the
    // screen people open twenty times a day. The wishlist trails both on a
    // keyword — its "travel" contains "tr" — which is the tiering working.
    expect(filterCommands(items, 'tr').map((i) => i.id)).toEqual(['trips', 'trash', 'wishlist'])
  })

  it('ranks a contained match below a leading one', () => {
    const withContained = [item({ id: 'a', label: 'My Trips' }), item({ id: 'b', label: 'Trips' })]

    expect(filterCommands(withContained, 'trips').map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('matches a keyword, and ranks it last', () => {
    // Somebody looking for "travel" should reach the wishlist, but never ahead
    // of a screen actually called that.
    const results = filterCommands(
      [...items, item({ id: 'travel', label: 'Travel resume' })],
      'travel'
    )

    expect(results.map((i) => i.id)).toEqual(['travel', 'wishlist'])
  })

  it('ignores case and surrounding space', () => {
    expect(filterCommands(items, '  TRIPS ').map((i) => i.id)).toEqual(['trips'])
  })

  it('comes back empty rather than falling back to everything', () => {
    // The dialog shows an empty state saying trips are not searchable yet. A
    // silent fallback to the full list would make that impossible to say.
    expect(filterCommands(items, 'zzzz')).toEqual([])
  })

  it('lists an item once even when several tiers could claim it', () => {
    const overlapping = [item({ id: 'trips', label: 'Trips', keywords: ['trip', 'trips'] })]

    expect(filterCommands(overlapping, 'trip')).toHaveLength(1)
  })
})

describe('filterCommands section order', () => {
  it('returns results in the order they are rendered, not just by rank', () => {
    // The palette groups results under section headings while the arrow keys
    // walk the returned array. If a Create item out-ranks a destination, a
    // rank-only order puts it fourth in the array and last on the screen, and
    // Down-Down-Down highlights something the eye is nowhere near.
    const mixed = [
      item({ id: 'trips', label: 'Trips', href: '/trips' }),
      item({ id: 'new-trip', label: 'New trip', href: '/trips/new', section: 'Create' }),
      item({ id: 'globe', label: 'Globe', href: '/globe', keywords: ['countries'] }),
    ]

    // All three match "tr": two by label, and Globe through "coun-tr-ies".
    expect(filterCommands(mixed, 'tr').map((i) => i.id)).toEqual(['trips', 'globe', 'new-trip'])
  })

  it('keeps the ranking inside a section', () => {
    const sameSection = [
      item({ id: 'wishlist', label: 'Wishlist', keywords: ['travel'] }),
      item({ id: 'trips', label: 'Trips' }),
    ]

    expect(filterCommands(sameSection, 'tr').map((i) => i.id)).toEqual(['trips', 'wishlist'])
  })
})

describe('commandSections', () => {
  it('lists only the sections present, destinations first', () => {
    expect(commandSections(commandItems())).toEqual(['Go to', 'Create'])
  })

  it('drops a section nothing matched', () => {
    expect(commandSections([item({ section: 'Create' })])).toEqual(['Create'])
    expect(commandSections([])).toEqual([])
  })
})
