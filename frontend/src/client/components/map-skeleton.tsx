import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * Fallback for the two map screens, which share a tighter shell than the rest of
 * the app — `text-xl` heading, `p-3 md:p-4`, and a canvas that takes the
 * remaining height — so they cannot reuse `PageSkeleton` without the layout
 * shifting when the real screen lands.
 */
export function MapSkeleton({ title }: { title: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4" aria-busy="true">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </header>
      <Skeleton aria-hidden className="min-h-[420px] flex-1 rounded-xl" />
    </div>
  )
}
