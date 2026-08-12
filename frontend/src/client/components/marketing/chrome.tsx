import Link from 'next/link'
import { BRAND } from '@/shared/brand'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { Button } from '@/client/components/ui/button'
import { cn } from '@/shared/utils'

/**
 * The header and footer every signed-out page wears.
 *
 * Extracted because there are now four of them — landing, pricing, changelog and
 * whatever comes next — and a nav link added to one of four copies is a nav link
 * missing from three pages. The links live in one array below, so adding a
 * public page is one line.
 *
 * Server components: nothing here holds state. `ThemeToggle` is the one client
 * island inside, which is fine — a Server Component may render a Client one.
 */

interface MarketingLink {
  href: string
  label: string
}

const LINKS: MarketingLink[] = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/changelog', label: 'Changelog' },
]

export function MarketingHeader({ current }: { current?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-transparent bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Link href="/" className="font-semibold tracking-tight">
        {BRAND.name}
      </Link>

      <div className="flex items-center gap-1">
        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              nativeButton={false}
              render={<Link href={link.href} />}
              // `aria-current` rather than colour alone: the page you are on is
              // information, not decoration.
              aria-current={current === link.href ? 'page' : undefined}
              className={cn(current === link.href && 'text-foreground')}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <ThemeToggle />

        <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
          Sign in
        </Button>
        <Button nativeButton={false} render={<Link href="/register" />}>
          Get started
        </Button>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <p>
          {BRAND.name} — {BRAND.tagline}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  )
}
