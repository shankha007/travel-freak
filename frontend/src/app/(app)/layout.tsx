import Link from 'next/link'
import { BRAND } from '@/shared/brand'
import { ThemeToggle } from '@/client/components/theme-toggle'

/**
 * Authenticated shell. Navigation and the quota meter land here once auth is
 * wired up — for now it is the minimum frame the globe needs to be viewed.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <Link href="/globe" className="font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
