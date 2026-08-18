import { Skeleton } from '@/client/components/ui/skeleton'

/**
 * The public reader, while the post is fetched.
 *
 * Unlike the skeletons under the app shell, this one draws its heading as a
 * grey bar rather than passing real text: the title belongs to whichever post
 * the slug resolves to, and there is nothing honest to write until it does.
 *
 * It earns its place on the click *inside* the app — a post opened from
 * `/blogs`, or a byline followed from another reader — where the boundary is
 * prefetched and paints at once. A cold arrival from a shared link never sees
 * it, and should not.
 */
export default function Loading() {
  return (
    <article className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10" aria-busy="true">
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-4/5" />
        <Skeleton className="h-9 w-3/5" />
        <Skeleton className="h-4 w-40" />
      </div>

      <Skeleton className="aspect-[16/9] w-full rounded-xl" aria-hidden />

      <div className="space-y-2.5" aria-hidden>
        {['w-full', 'w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-2/3'].map((width, i) => (
          <Skeleton key={i} className={`h-4 ${width}`} />
        ))}
      </div>
    </article>
  )
}
