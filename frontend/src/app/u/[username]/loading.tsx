import { Skeleton } from '@/client/components/ui/skeleton'

/** A public profile, while it is fetched. See `b/[slug]/loading`. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10" aria-busy="true">
      <div className="flex items-center gap-4" aria-hidden>
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="w-full space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Skeleton className="aspect-[2/1] w-full rounded-xl" aria-hidden />
    </div>
  )
}
