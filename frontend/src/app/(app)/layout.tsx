import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BRAND } from '@/shared/brand'
import { requireUser } from '@/server/auth'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { AppBottomNav, AppSidebar } from '@/client/components/app-nav'
import { UserMenu } from '@/client/components/user-menu'

/**
 * Authenticated shell: header, sidebar on desktop, bottom bar on mobile.
 *
 * `requireUser()` runs here so every nested page can assume a session without
 * repeating the check. The proxy already redirects anonymous requests; this
 * closes the gap if a route is ever added outside the proxy's matcher.
 *
 * It is also where onboarding is enforced. The check costs nothing extra —
 * `getSessionUser()` is cached per render and already reads the profile row — and
 * it belongs here rather than in the proxy, which would need a database round
 * trip on every request including static assets. An account that has not
 * finished the wizard has an empty globe and no idea what this product is for,
 * so it goes back until it does.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  if (!user.onboardedAt) redirect('/welcome')

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu displayName={user.displayName} email={user.email} planCode={user.planCode} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>

      <AppBottomNav />
    </div>
  )
}
