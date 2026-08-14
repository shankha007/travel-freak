import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * The trip's title is the page's heading and is not known until the row is
 * read, so this is the one app screen whose fallback has to draw the heading as
 * a bar rather than render the real words.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6" aria-busy="true">
      <div aria-hidden className="contents">
        <Skeleton className="h-64 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl lg:col-span-2" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
