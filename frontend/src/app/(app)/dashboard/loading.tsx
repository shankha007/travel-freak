import { PageSkeleton, SkeletonCards, SkeletonRows } from '@/client/components/page-skeleton'
import { Skeleton } from '@/client/components/ui/skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Dashboard">
      <SkeletonCards count={8} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <SkeletonRows count={3} height="h-12" />
    </PageSkeleton>
  )
}
