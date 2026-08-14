import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Your blogs" gap={4}>
      <SkeletonRows count={5} />
    </PageSkeleton>
  )
}
