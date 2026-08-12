'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Undo2 } from 'lucide-react'
import { restoreTrip } from '@/server/actions/trips'
import { Button } from '@/client/components/ui/button'

/**
 * Brings one trip back out of the trash.
 *
 * No confirmation dialog: restoring is the undo, and asking someone to confirm
 * an undo is how you make the safe action feel dangerous. A refusal — usually
 * the plan's trip limit — is shown inline next to the trip it applies to.
 */
export function RestoreTripButton({ tripId, title }: { tripId: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  async function restore() {
    setBusy(true)
    setError(null)
    const result = await restoreTrip(tripId)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not restore that trip.')
      setQuotaExceeded(result.quotaExceeded === true)
      return
    }

    // The row leaves this list, so the page has to re-read rather than filter
    // client-side — the server is the one that knows what is still deleted.
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
          <span className="space-y-1">
            <span className="block">{error}</span>
            {quotaExceeded && (
              <Link href="/settings" className="underline underline-offset-4">
                See plans
              </Link>
            )}
          </span>
        </p>
      )}
    </div>
  )
}
