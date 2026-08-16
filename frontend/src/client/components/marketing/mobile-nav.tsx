'use client'

import Link from 'next/link'
import { MenuIcon } from 'lucide-react'

import { Button } from '@/client/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/client/components/ui/sheet'
import { BRAND } from '@/shared/brand'
import { cn } from '@/shared/utils'

/**
 * The marketing header's phone menu.
 *
 * `MarketingHeader` hides its links below `sm`, which was survivable when there
 * were two of them and is not at five: a phone visitor could reach Blogs,
 * About, Pricing, Changelog and Contact only by scrolling to the footer. This
 * is the menu that holds them, and it carries the legal documents too — the
 * footer is still where a reader expects those, but a phone reader who has
 * opened the menu should not be sent back out of it to find them.
 *
 * A client island because a menu has open state; the header stays a Server
 * Component and passes the links down as props, so they are still declared in
 * one place and adding a public page is still one line.
 */

export interface MarketingNavLink {
  href: string
  label: string
}

export function MarketingMobileNav({
  links,
  legalLinks,
  current,
}: {
  links: MarketingNavLink[]
  legalLinks: MarketingNavLink[]
  current?: string
}) {
  return (
    <Sheet>
      {/* Uncontrolled, and every link inside is a `SheetClose`: Base UI then
          owns both the close and the focus return to this button, which a
          hand-rolled `open` state would have had to reimplement.
          `sm:hidden` mirrors the `hidden sm:flex` on the inline nav, so exactly
          one of the two is ever reachable. */}
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="sm:hidden" />}
        aria-label="Open menu"
      >
        <MenuIcon />
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{BRAND.name}</SheetTitle>
          <SheetDescription>{BRAND.tagline}</SheetDescription>
        </SheetHeader>

        <nav aria-label="Product" className="flex flex-col gap-1 px-2">
          {links.map((link) => (
            // `SheetClose` wrapping the link rather than an `onClick` that
            // closes: the navigation and the close are one gesture, and this
            // way the menu cannot be left open behind the new page.
            <SheetClose
              key={link.href}
              render={<Link href={link.href} />}
              nativeButton={false}
              aria-current={current === link.href ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                current === link.href && 'bg-muted text-foreground'
              )}
            >
              {link.label}
            </SheetClose>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t p-4">
          {/* `nativeButton={false}` on every one of these: Base UI assumes a
              Close is a real <button>, and warns — correctly — that rendering an
              anchor as one strips the semantics an anchor should keep. These
              are links that also close the sheet, in that order. */}
          <SheetClose
            render={<Link href="/register" />}
            nativeButton={false}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Get started
          </SheetClose>
          <SheetClose
            render={<Link href="/login" />}
            nativeButton={false}
            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium hover:bg-muted"
          >
            Sign in
          </SheetClose>

          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
            {legalLinks.map((link) => (
              <SheetClose
                key={link.href}
                render={<Link href={link.href} />}
                nativeButton={false}
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </SheetClose>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}
