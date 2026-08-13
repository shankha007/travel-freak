'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { saveWishlistItem, type WishlistState } from '@/server/actions/wishlist'
import type { WishlistEntry } from '@/server/queries/wishlist'
import { ALL_COUNTRIES } from '@/shared/geo/countries'
import { DEFAULT_PRIORITY, PRIORITY_LABEL, WISHLIST_PRIORITIES } from '@/shared/wishlist'
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

const initialState: WishlistState = { error: null }

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : editing ? 'Save changes' : 'Add to wishlist'}
    </Button>
  )
}

/**
 * Add or edit one wish — screen 30.
 *
 * The country is the only required field. Everything else is a note to your
 * future self, so the form asks for it without insisting: a wish that is just
 * "Iceland" is a complete wish, and it paints the globe exactly the same.
 *
 * The inputs are uncontrolled, seeded from `initial` below. The caller keys this
 * component by the row being edited, so switching rows remounts the form rather
 * than syncing props into state.
 */
export function WishlistDialog({
  item,
  open,
  onOpenChange,
}: {
  /** The row being edited, or null when adding. */
  item: WishlistEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveWishlistItem, initialState)
  const editing = item !== null

  // The action revalidates on the server; this is what makes the open dialog
  // notice it succeeded and get out of the way.
  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]

  // What the fields start with: the rejected submission if there was one, then
  // the row being edited, then empty. React resets an uncontrolled form once its
  // action returns, so without the first of those, being told you had already
  // wishlisted a country would also silently discard the notes you wrote.
  const rejected = state.values
  const initial = {
    countryCode: rejected?.countryCode ?? item?.countryCode ?? '',
    title: rejected?.title ?? item?.title ?? '',
    notes: rejected?.notes ?? item?.notes ?? '',
    priority: rejected?.priority ?? String(item?.priority ?? DEFAULT_PRIORITY),
    bestSeason: rejected?.bestSeason ?? item?.bestSeason ?? '',
    estBudget: rejected?.estBudget ?? item?.estBudget?.toString() ?? '',
    currency: rejected?.currency ?? item?.currency ?? 'INR',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${item.countryName}` : 'Add somewhere you want to go'}
          </DialogTitle>
          <DialogDescription>
            Pick the country and the globe paints it planned. The rest is for you.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={item.id} />}

          <div className="space-y-2">
            <Label htmlFor="countryCode">Country</Label>
            {/* Keyed: React applies a select's `defaultValue` on mount only, so
                after the form is reset the re-seeded value would be ignored and
                the country would silently clear itself. Inputs re-read it. */}
            <select
              key={initial.countryCode}
              id="countryCode"
              name="countryCode"
              defaultValue={initial.countryCode}
              required
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              aria-describedby={err('countryCode') ? 'country-error' : undefined}
            >
              <option value="">Select a country…</option>
              {ALL_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            {err('countryCode') && (
              <p id="country-error" role="alert" className="text-sm text-destructive">
                {err('countryCode')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={initial.title}
              placeholder="Optional — “Ring road, camper van”"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={initial.notes}
              placeholder="Why this one, and what you would want out of it."
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                key={initial.priority}
                id="priority"
                name="priority"
                defaultValue={initial.priority}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {WISHLIST_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bestSeason">Best season</Label>
              <Input
                id="bestSeason"
                name="bestSeason"
                defaultValue={initial.bestSeason}
                placeholder="Sep–Mar"
                maxLength={60}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <div className="space-y-2">
              <Label htmlFor="estBudget">Rough budget</Label>
              <Input
                id="estBudget"
                name="estBudget"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={initial.estBudget}
                placeholder="Optional"
                aria-describedby={err('estBudget') ? 'budget-error' : undefined}
              />
              {err('estBudget') && (
                <p id="budget-error" role="alert" className="text-sm text-destructive">
                  {err('estBudget')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={initial.currency}
                maxLength={3}
                className="uppercase"
              />
            </div>
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
