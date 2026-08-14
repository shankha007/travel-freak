import { SkeletonCanvas } from '@/client/components/page-skeleton'
import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * Not `PageSkeleton`: the globe screen is a full-height flex column whose canvas
 * claims the remaining space, so the fallback has to reserve that space too or
 * the layout jumps the moment the real screen arrives.
 */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6" aria-busy="true">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your globe</h1>
        <p className="text-sm text-muted-foreground">
          Spin it, or pick a place from the list. Every country you have visited is filled in.
        </p>
      </header>
      <div aria-hidden className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <SkeletonCanvas />
        <Skeleton className="min-h-[200px] shrink-0 rounded-xl lg:w-80" />
      </div>
    </div>
  )
}
