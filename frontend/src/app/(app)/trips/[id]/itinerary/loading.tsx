import { PageSkeleton, SkeletonRows } from '@/client/components/page-skeleton'

export default function Loading() {
  return (
    <PageSkeleton title="Itinerary">
      <SkeletonRows count={4} height="h-40" />
    </PageSkeleton>
  )
}
