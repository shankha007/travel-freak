import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="New trip" gap={4}>
      <SkeletonRows count={3} height="h-40" />
    </PageSkeleton>
  )
}
