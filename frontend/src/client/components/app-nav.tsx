'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarRange,
  ChartNoAxesColumn,
  Circle,
  FileBadge,
  Globe2,
  Heart,
  LayoutDashboard,
  Luggage,
  Map,
  MapPin,
  NotebookPen,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { MOBILE_NAV, PRIMARY_NAV, type NavItem } from '@/shared/navigation'
import { cn } from '@/shared/utils'

/**
 * Sidebar on md and up, bottom bar below — the plan's mobile-nav rule.
 *
 * Stub screens stay in the nav rather than being hidden. A visible route that
 * says "not built yet" is more honest than a menu that quietly omits half the
 * product, and it keeps the information architecture reviewable.
 */

/**
 * The icons `shared/navigation.ts` names, listed one by one.
 *
 * This was `import * as Icons` with an `Icons[name]` lookup, which reads better
 * and cost the whole library. A namespace object indexed by a runtime string
 * has no statically knowable member set, so nothing can be dropped: the
 * bundler has to keep every export, and `optimizePackageImports` — which works
 * by rewriting named imports into deep paths — has no named import to rewrite.
 * lucide-react is ~1,500 icon modules, and this component renders in the app
 * shell on every authenticated page, so all of them landed in the shared chunk
 * that gates first paint.
 *
 * The cost of the explicit map is that a new `icon:` in the nav must be added
 * here too. It falls back to `Circle`, exactly as the old lookup did, so the
 * failure is a wrong icon rather than a crash.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  CalendarRange,
  ChartNoAxesColumn,
  FileBadge,
  Globe2,
  Heart,
  LayoutDashboard,
  Luggage,
  Map,
  MapPin,
  NotebookPen,
  Settings,
  Trash2,
}

function Icon({ name, className }: { name: string; className?: string }) {
  const Resolved = NAV_ICONS[name] ?? Circle
  return <Resolved className={className} aria-hidden />
}

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/**
 * `footer` is a slot rather than something this component fetches.
 *
 * The plan meter that sits there needs the account's usage, which is a database
 * read, and this is a client component — so the server layout renders the meter
 * and passes it down already made. That also keeps the meter off every client
 * navigation.
 */
export function AppSidebar({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="hidden w-56 shrink-0 flex-col border-r md:flex">
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon name={item.icon} className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.status === 'stub' && (
                  <span
                    className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    title="Route exists, screen not built yet"
                  >
                    soon
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {footer}
    </nav>
  )
}

export function AppBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-10 grid grid-cols-4 border-t bg-background md:hidden"
    >
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon name={item.icon} className="size-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
