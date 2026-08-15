import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton
      title="Budget"
      description="What this trip was meant to cost, and what it actually did."
    >
      <SkeletonRows count={3} height="h-44" />
    </PageSkeleton>
  )
}
