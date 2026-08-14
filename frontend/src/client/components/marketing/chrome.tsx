import Link from 'next/link'
import { BRAND } from '@/shared/brand'
import { LEGAL_DOCS } from '@/shared/content/legal'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { Button } from '@/client/components/ui/button'
import { cn } from '@/shared/utils'

/**
 * The header and footer every signed-out page wears.
 *
 * Extracted because there are now nine of them — landing, pricing, about,
 * changelog, contact and three legal documents — and a nav link added to one
 * copy is a nav link missing from the rest. The links live in the arrays below,
 * so adding a public page is one line.
 *
 * Server components: nothing here holds state. `ThemeToggle` is the one client
 * island inside, which is fine — a Server Component may render a Client one.
 */

interface MarketingLink {
  href: string
  label: string
}

// `/b` rather than `/blogs`: the authenticated "My Blogs" screen owns that path,
// and this is the index of the `/b/[slug]` posts it links to.
const LINKS: MarketingLink[] = [
  { href: '/b', label: 'Blogs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/contact', label: 'Contact' },
]

/**
 * The legal documents, footer only.
 *
 * Not in the header: nobody arrives looking for the refund policy, and five
 * nav items is already more than the phone breakpoint can hold. The footer is
 * where a reader expects to find them, and where a reviewer expects them to be.
 */
const LEGAL_LINKS: MarketingLink[] = LEGAL_DOCS.map((doc) => ({
  href: doc.path,
  label: doc.navLabel,
}))

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
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {BRAND.name} — {BRAND.tagline}
          </p>
          <nav aria-label="Product" className="flex flex-wrap gap-4">
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

        {/* Its own row rather than another four items on the end of the first
            one: these are the links a reader goes looking for deliberately, and
            they are easier to find where they are not competing with Pricing. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs">
          <p>
            © {new Date().getFullYear()} {BRAND.legal.entity}
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
