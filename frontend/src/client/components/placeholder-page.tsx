import Link from 'next/link'
import { Construction } from 'lucide-react'
import { navItemFor } from '@/shared/navigation'
import { Button } from '@/client/components/ui/button'

/**
 * The screen behind every routed-but-unbuilt tab.
 *
 * Reads its own copy from the navigation config, so a stub always describes
 * what it will become and which phase it belongs to — no placeholder text to
 * go stale, and no route that leaves you wondering whether it is broken or
 * merely empty.
 */
export function PlaceholderPage({ pathname }: { pathname: string }) {
  const item = navItemFor(pathname)

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Construction className="size-6 text-muted-foreground" aria-hidden />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{item?.label ?? 'Coming soon'}</h1>
          {item && <p className="text-sm text-muted-foreground">{item.summary}</p>}
        </div>

        {item && (
          <p className="text-xs text-muted-foreground">
            Screen {item.screen} · Phase {item.phase === 'M' ? 'MVP' : `v${item.phase}`} · not built
            yet
          </p>
        )}

        <div className="flex justify-center gap-2 pt-1">
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
            Back to dashboard
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/globe" />}>
            Open the globe
          </Button>
        </div>
      </div>
    </div>
  )
}
