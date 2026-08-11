import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { BRAND } from '@/shared/brand'
import { Button } from '@/client/components/ui/button'

/**
 * Shown when a post slug does not resolve.
 *
 * The copy does not distinguish "no such post" from "not published yet" or
 * "private" — saying which would confirm that a given draft exists.
 */
export default function BlogPostNotFound() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Post not found</h1>
          <p className="text-sm text-muted-foreground">
            This post either does not exist or has not been published.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          Go to {BRAND.name}
        </Button>
      </div>
    </div>
  )
}
