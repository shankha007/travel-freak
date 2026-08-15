import { PageSkeleton, SkeletonGrid } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Wishlist">
      <SkeletonGrid count={6} />
    </PageSkeleton>
  )
}
