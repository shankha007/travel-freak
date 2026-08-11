import { REGION_STATES, REGION_STATE_META } from '@/lib/geo/region-state'
import { cn } from '@/lib/utils'

/**
 * Legend for the globe and map fills.
 *
 * Always rendered alongside any surface that paints regions by colour. The text
 * label is the point — the swatch is supporting detail, not the message.
 */
export function RegionLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {REGION_STATES.map((state) => {
        const meta = REGION_STATE_META[state]
        return (
          <li key={state} className="flex items-center gap-1.5">
            <span
              className={cn('size-2.5 rounded-full ring-1 ring-black/10', meta.fillClass)}
              aria-hidden
            />
            <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
