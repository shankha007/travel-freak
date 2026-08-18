import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BRAND } from '@/shared/brand'
import { requireUser } from '@/server/auth'
import { getAccountUsage } from '@/server/entitlements'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { AppBottomNav, AppSidebar } from '@/client/components/app-nav'
import { UserMenu } from '@/client/components/user-menu'
import { QuotaMeter } from '@/client/components/quota-meter'
import { CommandPalette } from '@/client/components/command-palette'

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

  // Read here rather than inside the sidebar: `AppSidebar` is a client
  // component, and the meter is the only part of the shell that needs data.
  const usage = await getAccountUsage()

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
        <AppSidebar footer={<QuotaMeter usage={usage} />} />
        {/* `min-w-0` alongside `min-h-0`, and for the same reason in the other
            axis: a flex item defaults to `min-width: auto`, so it refuses to
            shrink below the widest thing inside it. Anything genuinely wide — a
            chart measuring its container, the analytics heatmap's year of
            squares — then pushes `main` past the viewport and gives the whole
            app a horizontal scrollbar, rather than scrolling inside the one
            element that is too wide. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </div>

      <AppBottomNav />

      {/* Mounted in the shell, not per page: the point of Cmd+K is that it works
          from wherever you already are. */}
      <CommandPalette />
    </div>
  )
}
