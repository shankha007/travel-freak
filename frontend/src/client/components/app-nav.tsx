'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MOBILE_NAV, PRIMARY_NAV, type NavItem } from '@/shared/navigation'
import { cn } from '@/shared/utils'

/**
 * Sidebar on md and up, bottom bar below — the plan's mobile-nav rule.
 *
 * Stub screens stay in the nav rather than being hidden. A visible route that
 * says "not built yet" is more honest than a menu that quietly omits half the
 * product, and it keeps the information architecture reviewable.
 */

function Icon({ name, className }: { name: string; className?: string }) {
  const Resolved = (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Circle
  return <Resolved className={className} aria-hidden />
}

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="hidden w-56 shrink-0 border-r md:block">
      <ul className="flex flex-col gap-0.5 p-3">
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
