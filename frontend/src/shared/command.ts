import { NAV_ITEMS, type NavItem } from '@/shared/navigation'

/**
 * What the command palette can take you to, and how it narrows.
 *
 * Pure and separate from the dialog, because the matching is the part with
 * opinions in it and a component is a bad place to argue with them. The dialog
 * only renders what this returns and moves a highlight up and down.
 *
 * **Destinations come from `shared/navigation.ts`**, which is already the single
 * source of truth for which screens exist. A palette with its own hand-kept list
 * would drift the first time a route was added, and the drift would be silent —
 * the palette would simply stop being able to reach a screen.
 *
 * **Trips are not searchable here.** That wants a query per keystroke against
 * somebody's own rows, which is a different feature with a different cost, and
 * shipping the navigation half now is better than shipping neither. The empty
 * state says so rather than letting it be discovered.
 */

export interface CommandItem {
  id: string
  label: string
  href: string
  /** Groups the list under a heading. */
  section: 'Go to' | 'Create'
  /** lucide-react icon name, resolved in the client component. */
  icon: string
  /**
   * Extra words that should match but are not worth showing — a screen somebody
   * calls by another name. "photos" finding the vault is the point of a palette.
   */
  keywords?: string[]
}

/** The things you can make, which are verbs rather than places. */
const CREATE_ITEMS: CommandItem[] = [
  {
    id: 'new-trip',
    label: 'New trip',
    href: '/trips/new',
    section: 'Create',
    icon: 'Luggage',
    keywords: ['add', 'plan', 'create', 'journey'],
  },
  {
    id: 'new-post',
    label: 'New blog post',
    href: '/blogs/new',
    section: 'Create',
    icon: 'NotebookPen',
    keywords: ['write', 'article', 'story', 'draft'],
  },
]

/** Words for screens people do not call by their label. */
const ALIASES: Record<string, string[]> = {
  '/globe': ['world', 'map', '3d', 'countries'],
  '/maps/world': ['countries', 'atlas'],
  '/maps/india': ['states'],
  '/trips': ['journeys', 'holidays', 'travel'],
  '/blogs': ['posts', 'writing', 'articles'],
  '/wishlist': ['bucket list', 'someday'],
  '/timeline': ['history', 'years'],
  '/resume': ['cv', 'stats', 'profile'],
  '/analytics': ['stats', 'numbers', 'charts', 'spending'],
  '/settings': ['account', 'preferences', 'privacy', 'password', 'email'],
  '/trash': ['deleted', 'restore', 'bin'],
}

/**
 * Every destination the palette offers.
 *
 * Stubs are included deliberately, for the same reason the sidebar keeps them:
 * a route that says "not built yet" is more honest than one the palette pretends
 * does not exist, and somebody searching for it gets an answer either way.
 */
export function commandItems(navItems: NavItem[] = NAV_ITEMS): CommandItem[] {
  const destinations: CommandItem[] = navItems.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href,
    section: 'Go to',
    icon: item.icon,
    keywords: ALIASES[item.href],
  }))

  return [...destinations, ...CREATE_ITEMS]
}

/**
 * Narrows the list to what was typed.
 *
 * Three tiers, best first: a label starting with the query, a label containing
 * it, then a keyword match. That ordering is the whole point — typing "tr"
 * should offer Trips before Trash, and both before the wishlist that merely
 * mentions travel. Within a tier the original order is kept, so the list does
 * not reshuffle under the highlight as somebody types.
 *
 * Case and surrounding space are ignored. An empty query returns everything, in
 * order, because a palette opened with ⌘K and nothing typed is a menu.
 */
export function filterCommands(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items

  const starts: CommandItem[] = []
  const contains: CommandItem[] = []
  const keyword: CommandItem[] = []

  for (const item of items) {
    const label = item.label.toLowerCase()

    if (label.startsWith(q)) starts.push(item)
    else if (label.includes(q)) contains.push(item)
    else if (item.keywords?.some((word) => word.toLowerCase().includes(q))) keyword.push(item)
  }

  // Grouped by section *after* ranking, and this is load-bearing rather than
  // tidiness. The palette renders results under section headings while the
  // arrow keys walk this array, so the two orders have to be the same one —
  // otherwise a Create item that out-ranks a destination sits fourth in the
  // array and last on the screen, and pressing Down three times highlights
  // something the eye is nowhere near. Sorting is stable in every engine this
  // runs on, so the tiers above survive inside each section.
  return [...starts, ...contains, ...keyword].sort(
    (a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
  )
}

/** The order sections render in, and therefore the order results come back in. */
const SECTION_ORDER: CommandItem['section'][] = ['Go to', 'Create']

/** The sections present in a result set, in the order they should render. */
export function commandSections(items: CommandItem[]): CommandItem['section'][] {
  return SECTION_ORDER.filter((section) => items.some((item) => item.section === section))
}
