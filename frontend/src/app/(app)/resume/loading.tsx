import { PageSkeleton, SkeletonCards, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Travel resume">
      <SkeletonCards count={4} />
      <SkeletonRows count={4} height="h-32" />
    </PageSkeleton>
  )
}
