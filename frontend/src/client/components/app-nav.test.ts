import { describe, expect, it } from 'vitest'
import { NAV_ICONS } from '@/client/components/app-nav'
import { NAV_ITEMS } from '@/shared/navigation'

/**
 * The sidebar resolves icons through an explicit map rather than indexing the
 * lucide-react namespace, because a runtime lookup on the namespace pulls all
 * ~1,500 icons into the shell chunk. The map's cost is that it can fall out of
 * step with the nav, and it fails softly — a missing name renders a plain
 * circle, which is easy to miss in review and impossible to spot in a diff.
 * This is the check that keeps the cheap version honest.
 */
describe('nav icon registry', () => {
  it('has an entry for every icon the nav names', () => {
    const missing = NAV_ITEMS.filter((item) => !NAV_ICONS[item.icon]).map(
      (item) => `${item.href} → ${item.icon}`
    )

    expect(missing).toEqual([])
  })

  it('carries no entry the nav does not name', () => {
    const named = new Set(NAV_ITEMS.map((item) => item.icon))
    expect(Object.keys(NAV_ICONS).filter((name) => !named.has(name))).toEqual([])
  })
})
