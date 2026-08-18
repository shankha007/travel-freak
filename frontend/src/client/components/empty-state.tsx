import type { ReactNode } from 'react'
import { cn } from '@/shared/utils'

/**
 * A screen with nothing on it yet.
 *
 * The pattern was already here — the timeline, the itinerary, the budget, the
 * packing lists and the wishlist all grew the same dashed card independently,
 * which is how you can tell it is the right shape. What they did *not* share was
 * the code, so the padding and the icon size had started to drift, and the
 * screens that came later settled for a grey one-liner instead: "Nothing here
 * yet." on the trips tabs, "Nothing yet." under the dashboard's activity.
 *
 * The difference matters more than it looks. An empty screen is the first thing
 * a new account sees on almost every route, and a one-liner says only that the
 * app has nothing — it never says what to do about it. Three parts, so it always
 * can:
 *
 *  - an **icon**, which is what makes the space read as deliberate rather than
 *    as a failed load,
 *  - a **line** naming what is missing,
 *  - and an **action**, when there is one worth offering. Not every empty state
 *    has one: a filtered list that matched nothing needs the filter cleared, not
 *    a create button, and the screens that only ever fill up as a side effect of
 *    other work have nothing honest to link to.
 *
 * **Where it is deliberately not used.** An empty state inside a `Card` — the
 * dashboard's two — keeps its prose, because a dashed box inside a bordered box
 * reads as a rendering mistake; what those borrow is the substance rather than
 * the shape. And the screens that already grew a good version of this card were
 * left alone: converting them is churn with a regression risk and nothing a user
 * would ever see. New ones should start here.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  /** Fills its parent, for a screen that is empty rather than a card that is. */
  fill = false,
}: {
  /** Rendered at `size-6`; pass the lucide icon element. */
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  fill?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center',
        fill && 'flex-1 justify-center',
        className
      )}
    >
      {icon}

      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>

      {action}
    </div>
  )
}
