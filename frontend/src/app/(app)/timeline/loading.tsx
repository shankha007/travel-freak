import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Timeline">
      <SkeletonRows count={5} height="h-28" />
    </PageSkeleton>
  )
}
