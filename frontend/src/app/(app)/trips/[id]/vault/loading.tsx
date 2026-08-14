import { PageSkeleton, SkeletonGrid } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Memory Vault">
      <SkeletonGrid count={9} />
    </PageSkeleton>
  )
}
