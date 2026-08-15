import { PageSkeleton, SkeletonCards } from '@/client/components/page-skeleton'
import { Skeleton } from '@/client/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Analytics">
      <SkeletonCards count={8} />
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </PageSkeleton>
  )
}
