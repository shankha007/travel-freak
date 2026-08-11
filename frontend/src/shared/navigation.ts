/**
 * The authenticated shell's navigation, and the single source of truth for
 * which screens exist and how far along each one is.
 *
 * The sidebar, the mobile bottom bar and the delivery-status table all read
 * from here, so a screen cannot appear in the nav without declaring its state,
 * and the status table cannot claim something ships that is not linked.
 *
 * Screen numbers refer to §5 of docs/PROJECT_PLAN.md.
 */

export type ScreenStatus =
  /** Built and reading real data. */
  | 'live'
  /** Route exists and is navigable, but the screen is a placeholder. */
  | 'stub'

export type Phase = 'M' | '1.1' | '1.2'

export interface NavItem {
  href: string
  label: string
  /** lucide-react icon name, resolved in the client component. */
  icon: string
  status: ScreenStatus
  phase: Phase
  /** Screen number in the plan. */
  screen: number
  /** Shown on placeholder pages so the stub explains itself. */
  summary: string
  /** Hidden from the sidebar but still routable (nested or secondary). */
  secondary?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    status: 'live',
    phase: 'M',
    screen: 13,
    summary: 'Overview cards, recent activity, upcoming-trip widget and a clickable globe preview.',
  },
  {
    href: '/globe',
    label: 'Globe',
    icon: 'Globe2',
    status: 'live',
    phase: 'M',
    screen: 14,
    summary: 'Full-screen 3D globe with the region modal and a keyboard-navigable region list.',
  },
  {
    href: '/trips',
    label: 'Trips',
    icon: 'Luggage',
    status: 'live',
    phase: 'M',
    screen: 18,
    summary: 'Past, ongoing, upcoming and draft trips, with grid and timeline views.',
  },
  {
    href: '/maps/world',
    label: 'World map',
    icon: 'Map',
    status: 'stub',
    phase: 'M',
    screen: 16,
    summary:
      'MapLibre 2D world map with visited, wishlist and planned layers. Needs a MapTiler key.',
  },
  {
    href: '/maps/india',
    label: 'India map',
    icon: 'MapPin',
    status: 'stub',
    phase: 'M',
    screen: 17,
    summary: 'State-level tracking for India, free on every plan.',
  },
  {
    href: '/blogs',
    label: 'Blogs',
    icon: 'NotebookPen',
    status: 'live',
    phase: 'M',
    screen: 28,
    summary: 'Your posts, drafts and published pieces. Blog Studio is the Tiptap editor.',
  },
  {
    href: '/wishlist',
    label: 'Wishlist',
    icon: 'Heart',
    status: 'stub',
    phase: 'M',
    screen: 30,
    summary:
      'Countries you want to reach, with notes, budget, priority and season. Paints planned on the globe.',
  },
  {
    href: '/timeline',
    label: 'Timeline',
    icon: 'CalendarRange',
    status: 'stub',
    phase: 'M',
    screen: 31,
    summary: 'Everything you have done, chronologically, grouped by year.',
  },
  {
    href: '/resume',
    label: 'Travel resume',
    icon: 'FileBadge',
    status: 'stub',
    phase: 'M',
    screen: 33,
    summary:
      'The shareable artifact: countries, cities, distance and years travelling, on a public URL.',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: 'ChartNoAxesColumn',
    status: 'stub',
    phase: '1.1',
    screen: 32,
    summary: 'Per-year charts, distance, world percentage and a heatmap calendar.',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: 'Settings',
    status: 'stub',
    phase: 'M',
    screen: 39,
    summary: 'Profile, account and security, privacy including the EXIF-strip toggle.',
  },
]

/** Sidebar entries, in order. */
export const PRIMARY_NAV = NAV_ITEMS.filter((i) => !i.secondary)

/** The four that fit a phone's bottom bar without crowding. */
export const MOBILE_NAV = NAV_ITEMS.filter((i) =>
  ['/dashboard', '/globe', '/trips', '/wishlist'].includes(i.href)
)

export function navItemFor(pathname: string): NavItem | undefined {
  // Longest match wins so /maps/india does not resolve to /maps/world.
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
}
