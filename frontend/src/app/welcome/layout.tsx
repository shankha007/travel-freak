import Link from 'next/link'
import { BRAND } from '@/shared/brand'
import { ThemeToggle } from '@/client/components/theme-toggle'

/**
 * Chrome-free frame for onboarding.
 *
 * Deliberately outside the `(app)` group: the sidebar advertises fourteen
 * screens, and the one thing a new account should be doing is the three steps in
 * front of it. There is no way out but forward, which is also why the header
 * links home rather than to the dashboard they have not set up yet.
 */
export default function WelcomeLayout({ children }: LayoutProps<'/welcome'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center p-4 md:p-6">{children}</main>
    </div>
  )
}
