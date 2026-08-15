import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton
      title="Packing"
      description="What goes in the bag, and what has to happen before you leave."
    >
      <SkeletonRows count={3} height="h-48" />
    </PageSkeleton>
  )
}
