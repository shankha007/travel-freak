import { PageSkeleton, SkeletonGrid } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Your trips" gap={4}>
      <SkeletonGrid count={6} />
    </PageSkeleton>
  )
}
