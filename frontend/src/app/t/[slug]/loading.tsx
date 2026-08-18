import { Skeleton } from '@/client/components/ui/skeleton'

/** The public trip page, while the trip is fetched. See `b/[slug]/loading`. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10" aria-busy="true">
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-9 w-3/5" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Skeleton className="aspect-[21/9] w-full rounded-xl" aria-hidden />

      <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
