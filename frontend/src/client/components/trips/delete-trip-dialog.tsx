'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { deleteTrip, type DeleteTripState } from '@/server/actions/trips'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'

const initialState: DeleteTripState = { error: null }

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Deleting…' : 'Delete trip'}
    </Button>
  )
}

/**
 * Delete confirmation.
 *
 * Deliberately a dialog rather than a one-click destructive button: this is the
 * only irreversible-looking action in the trip screens, and the copy is where
 * the user learns it is in fact recoverable.
 */
export function DeleteTripDialog({ tripId, title }: { tripId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(deleteTrip, initialState)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription>
              It disappears from your trips and your globe, and stops counting against your plan.
              Nothing is erased — the photos, memories and blogs come back with it from{' '}
              <Link href="/trash" className="underline underline-offset-4">
                Trash
              </Link>{' '}
              for the next 30 days.
            </DialogDescription>
          </DialogHeader>

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          <form action={formAction}>
            <input type="hidden" name="tripId" value={tripId} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <ConfirmButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
