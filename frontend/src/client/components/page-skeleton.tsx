import { Skeleton } from '@/client/components/ui/skeleton'
import { cn } from '@/shared/utils'

/**
 * The building blocks every `loading.tsx` under the app shell is made of.
 *
 * Why these exist at all: every authenticated route is `force-dynamic`, and
 * Next.js does not prefetch a dynamic route unless it has a `loading` boundary
 * — so without one, a click buys a full server round trip with the previous
 * screen frozen on screen and nothing to say the app heard the click. With one,
 * the boundary is prefetched as the link enters the viewport, paints
 * immediately on click, and the page streams in behind it.
 *
 * The heading is passed in as real text rather than drawn as a grey bar. It is
 * known at build time, it is the one thing on the screen that tells the user
 * the click landed on the route they aimed at, and a skeleton of a word we
 * already have is a worse answer than the word.
 */

export function PageSkeleton({
  title,
  description,
  gap = 6,
  children,
}: {
  title: string
  /** Rendered as a muted line under the heading, when the real page has one. */
  description?: string
  /** Matches the `gap-4` / `gap-6` the corresponding page uses. */
  gap?: 4 | 6
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('flex flex-1 flex-col p-4 md:p-6', gap === 4 ? 'gap-4' : 'gap-6')}
      // The screen is incomplete by definition, so it is announced as busy and
      // its half-drawn contents are kept out of the accessibility tree until
      // the real page replaces them.
      aria-busy="true"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  )
}

/** A row of stat tiles, as on the dashboard and analytics. */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[76px] rounded-xl" />
      ))}
    </div>
  )
}

/** A stack of full-width blocks, as on trips, blogs and the timeline. */
export function SkeletonRows({
  count = 4,
  height = 'h-24',
  className,
}: {
  count?: number
  height?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('rounded-xl', height)} />
      ))}
    </div>
  )
}

/** A card grid, as on trips and the wishlist. */
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-52 rounded-xl" />
      ))}
    </div>
  )
}

/** The one big canvas the globe and map screens are almost entirely made of. */
export function SkeletonCanvas({ className }: { className?: string }) {
  return <Skeleton className={cn('min-h-[420px] flex-1 rounded-xl', className)} />
}
