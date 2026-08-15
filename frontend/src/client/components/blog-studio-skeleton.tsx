import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * Fallback for the two Blog Studio routes.
 *
 * The studio has no page heading — the title is an borderless input styled to
 * look like one — so this draws the back button, that input and the editor's
 * two-column grid instead of the `PageSkeleton` header the rest of the app
 * shares. Inventing an `<h1>` here would shift the layout the moment the real
 * editor arrived.
 */
export function BlogStudioSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6" aria-busy="true">
      <div aria-hidden className="contents">
        <Skeleton className="h-8 w-24 rounded-md" />
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
