import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="People" description="Who can see this trip and help plan it.">
      <SkeletonRows count={4} height="h-20" />
    </PageSkeleton>
  )
}
