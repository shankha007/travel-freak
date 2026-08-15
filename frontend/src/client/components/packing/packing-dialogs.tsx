'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { saveChecklist, saveChecklistItem } from '@/server/actions/packing'
import type { Checklist, PackingItem } from '@/server/queries/packing'
import { CHECKLIST_KINDS, CHECKLIST_KIND_LABEL } from '@/shared/packing'
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

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : label}
    </Button>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

/**
 * A list — screen 23.
 *
 * Creating one is what `limits.checklists` counts, so this is where an upgrade
 * prompt can appear; renaming is never limited, and the action knows the
 * difference. Kind is only asked on creation: a packing list that becomes a
 * to-do list is a new list, not a renamed one.
 */
export function ListDialog({
  tripId,
  list,
  open,
  onOpenChange,
}: {
  tripId: string
  /** The row being renamed, or null when creating. */
  list: Checklist | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveChecklist, EMPTY_FORM_STATE)
  const editing = list !== null

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]
  const rejected = state.values
  const initial = {
    title: rejected?.title ?? list?.title ?? '',
    kind: rejected?.kind ?? list?.kind ?? 'packing',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Rename this list' : 'Start a list'}</DialogTitle>
          <DialogDescription>
            A packing list for what goes in the bag, or a to-do list for what has to happen before
            you leave.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={list.id} />}
          <input type="hidden" name="tripId" value={tripId} />

          <div className="space-y-2">
            <Label htmlFor="listTitle">Name</Label>
            <Input
              id="listTitle"
              name="title"
              defaultValue={initial.title}
              placeholder="Carry-on"
              maxLength={120}
              required
              aria-describedby={err('title') ? 'list-title-error' : undefined}
            />
            {err('title') && (
              <p id="list-title-error" role="alert" className="text-sm text-destructive">
                {err('title')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="listKind">Kind</Label>
            {/* Keyed: a select applies `defaultValue` on mount only, so a
                re-seeded value after a form reset would be ignored. */}
            <select
              key={initial.kind}
              id="listKind"
              name="kind"
              defaultValue={initial.kind}
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {CHECKLIST_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {CHECKLIST_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </div>

          {state.error && <ErrorNote message={state.error} />}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SaveButton label={editing ? 'Save the name' : 'Start it'} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One line on a list — screen 23.
 *
 * Only reached by editing. Adding is an inline field on the list itself,
 * because packing is done standing in a room typing one thing after another and
 * a dialog per sock is not that.
 */
export function ItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: PackingItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveChecklistItem, EMPTY_FORM_STATE)

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]
  const rejected = state.values
  const initial = {
    label: rejected?.label ?? item?.label ?? '',
    category: rejected?.category ?? item?.category ?? '',
    quantity: rejected?.quantity ?? item?.quantity?.toString() ?? '1',
    notes: rejected?.notes ?? item?.notes ?? '',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit this item</DialogTitle>
          <DialogDescription>
            The category is free text — group by whatever you actually pack by.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <input type="hidden" name="checklistId" value={item?.checklistId ?? ''} />

          <div className="grid gap-4 sm:grid-cols-[1fr_5rem]">
            <div className="space-y-2">
              <Label htmlFor="itemLabel">What</Label>
              <Input
                id="itemLabel"
                name="label"
                defaultValue={initial.label}
                maxLength={160}
                required
                aria-describedby={err('label') ? 'item-label-error' : undefined}
              />
              {err('label') && (
                <p id="item-label-error" role="alert" className="text-sm text-destructive">
                  {err('label')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemQuantity">How many</Label>
              <Input
                id="itemQuantity"
                name="quantity"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                defaultValue={initial.quantity}
                aria-describedby={err('quantity') ? 'item-quantity-error' : undefined}
              />
              {err('quantity') && (
                <p id="item-quantity-error" role="alert" className="text-sm text-destructive">
                  {err('quantity')}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemCategory">Category</Label>
            <Input
              id="itemCategory"
              name="category"
              defaultValue={initial.category}
              placeholder="Optional — “Documents”"
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="packingNotes">Notes</Label>
            <Textarea
              id="packingNotes"
              name="notes"
              defaultValue={initial.notes}
              rows={2}
              maxLength={500}
            />
          </div>

          {state.error && <ErrorNote message={state.error} />}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SaveButton label="Save changes" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
