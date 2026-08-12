'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Undo2 } from 'lucide-react'
import { restoreBlogPost } from '@/server/actions/blogs'
import { Button } from '@/client/components/ui/button'

/**
 * Brings one post back out of the trash.
 *
 * Like the trip restore, there is no confirmation: this *is* the undo. A post
 * that was published goes back to being published, which the surrounding copy
 * says before the press rather than after.
 */
export function RestoreBlogButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function restore() {
    setBusy(true)
    setError(null)
    const result = await restoreBlogPost(postId)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not restore that post.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => void restore()}
        disabled={busy}
        aria-label={`Restore ${title}`}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Undo2 className="size-3.5" aria-hidden />
        )}
        Restore
      </Button>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
