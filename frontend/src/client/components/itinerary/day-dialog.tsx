'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { saveItineraryDay } from '@/server/actions/itinerary'
import type { ItineraryDay } from '@/server/queries/itinerary'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : editing ? 'Save changes' : 'Add the day'}
    </Button>
  )
}

/**
 * One day of an itinerary — screen 21.
 *
 * Every field is optional. A day is a container for entries, and it earns its
 * place on the screen before anybody has decided what it is called or when it
 * falls. The date is pre-filled with the first date on the trip that has no day
 * yet, which is what somebody adding days by hand almost always means.
 *
 * The inputs are uncontrolled and seeded from `initial`; the caller keys this
 * component by the row being edited, so switching rows remounts it.
 */
export function DayDialog({
  tripId,
  day,
  suggestedDate,
  open,
  onOpenChange,
}: {
  tripId: string
  /** The row being edited, or null when adding. */
  day: ItineraryDay | null
  /** The first date on the trip with no day yet, if there is one. */
  suggestedDate: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveItineraryDay, EMPTY_FORM_STATE)
  const editing = day !== null

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]

  // The rejected submission first, then the row being edited, then the
  // suggestion. Without the first, being told a day already exists would also
  // discard the notes typed alongside it.
  const rejected = state.values
  const initial = {
    dayDate: rejected?.dayDate ?? day?.dayDate ?? suggestedDate ?? '',
    title: rejected?.title ?? day?.title ?? '',
    notes: rejected?.notes ?? day?.notes ?? '',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit this day' : 'Add a day'}</DialogTitle>
          <DialogDescription>
            A date and a name are both optional — a day called nothing in particular still holds a
            plan.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={day.id} />}
          <input type="hidden" name="tripId" value={tripId} />

          <div className="space-y-2">
            <Label htmlFor="dayDate">Date</Label>
            <Input
              id="dayDate"
              name="dayDate"
              type="date"
              defaultValue={initial.dayDate}
              aria-describedby={err('dayDate') ? 'day-date-error' : undefined}
            />
            {err('dayDate') && (
              <p id="day-date-error" role="alert" className="text-sm text-destructive">
                {err('dayDate')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dayTitle">Name</Label>
            <Input
              id="dayTitle"
              name="title"
              defaultValue={initial.title}
              placeholder="Optional — “Arrival and the old town”"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dayNotes">Notes</Label>
            <Textarea
              id="dayNotes"
              name="notes"
              defaultValue={initial.notes}
              placeholder="Anything about the day as a whole."
              rows={3}
              maxLength={2000}
            />
          </div>

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SaveButton editing={editing} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
