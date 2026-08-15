import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Trash" gap={4}>
      <SkeletonRows count={3} />
    </PageSkeleton>
  )
}
