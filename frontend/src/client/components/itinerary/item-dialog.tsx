'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Loader2, Lock, MapPin } from 'lucide-react'
import { PlacePicker } from '@/client/components/trips/place-picker'
import { formatLngLat, type LngLat } from '@/shared/geo/point'
import { saveItineraryItem } from '@/server/actions/itinerary'
import type { ItineraryEntry } from '@/server/queries/itinerary'
import {
  ITINERARY_KINDS,
  ITINERARY_KIND_LABEL,
  ITINERARY_STATUSES,
  ITINERARY_STATUS_LABEL,
  formatTime,
} from '@/shared/itinerary'
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
      {pending ? 'Saving…' : editing ? 'Save changes' : 'Add it'}
    </Button>
  )
}

/**
 * One entry on a day — screen 21.
 *
 * A name and a kind are the whole of a free plan's entry. Times, cost, booking
 * reference and link are `itinerary_full`, and this form does not render them
 * on a plan that does not have them: the server drops those fields rather than
 * refusing the save, so showing inputs whose values would be discarded would be
 * the one dishonest option.
 */
export function ItemDialog({
  dayId,
  item,
  full,
  currency,
  open,
  onOpenChange,
}: {
  dayId: string
  /** The row being edited, or null when adding. */
  item: ItineraryEntry | null
  /** Whether this plan includes times, costs, bookings and links. */
  full: boolean
  /** The trip's currency, as the default for a new cost. */
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveItineraryItem, EMPTY_FORM_STATE)
  const editing = item !== null

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]

  // The pin lives in state rather than in a field, because it is set by a map
  // and a map is not a text input. It is submitted as two hidden fields, which
  // is why `lng` and `lat` are always both written or both cleared.
  const [pin, setPin] = useState<LngLat | null>(item?.point ?? null)
  const [picking, setPicking] = useState(false)

  const rejected = state.values
  const initial = {
    kind: rejected?.kind ?? item?.kind ?? 'activity',
    title: rejected?.title ?? item?.title ?? '',
    notes: rejected?.notes ?? item?.notes ?? '',
    timeStart: rejected?.timeStart ?? formatTime(item?.timeStart ?? null),
    timeEnd: rejected?.timeEnd ?? formatTime(item?.timeEnd ?? null),
    cost: rejected?.cost ?? item?.cost?.toString() ?? '',
    currency: rejected?.currency ?? item?.currency ?? currency,
    bookingRef: rejected?.bookingRef ?? item?.bookingRef ?? '',
    url: rejected?.url ?? item?.url ?? '',
    status: rejected?.status ?? item?.status ?? 'planned',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit this entry' : 'Add to this day'}</DialogTitle>
          <DialogDescription>
            A name is all it needs. Everything else is for when you know it.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="dayId" value={dayId} />

          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="space-y-2">
              <Label htmlFor="itemTitle">What is it</Label>
              <Input
                id="itemTitle"
                name="title"
                defaultValue={initial.title}
                placeholder="Fushimi Inari before the crowds"
                maxLength={160}
                required
                aria-describedby={err('title') ? 'item-title-error' : undefined}
              />
              {err('title') && (
                <p id="item-title-error" role="alert" className="text-sm text-destructive">
                  {err('title')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemKind">Kind</Label>
              {/* Keyed: React applies a select's `defaultValue` on mount only,
                  so after a form reset the re-seeded value would be ignored. */}
              <select
                key={initial.kind}
                id="itemKind"
                name="kind"
                defaultValue={initial.kind}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {ITINERARY_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ITINERARY_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemNotes">Notes</Label>
            <Textarea
              id="itemNotes"
              name="notes"
              defaultValue={initial.notes}
              placeholder="How to get there, what to ask for, who told you about it."
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Where it is. Optional like everything else — most of a plan is
              written before anybody knows the exact spot — but what puts the
              entry on the map beside the days. */}
          <div className="space-y-2">
            <Label>Where</Label>
            <input type="hidden" name="lng" value={pin?.lng ?? ''} />
            <input type="hidden" name="lat" value={pin?.lat ?? ''} />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                <MapPin className="size-3.5" aria-hidden />
                {pin ? 'Move the pin' : 'Drop a pin'}
              </Button>
              {pin && (
                <>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatLngLat(pin)}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPin(null)}>
                    Clear
                  </Button>
                </>
              )}
              {err('lng') && (
                <p role="alert" className="w-full text-sm text-destructive">
                  {err('lng')}
                </p>
              )}
            </div>
          </div>

          {full ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timeStart">From</Label>
                  <Input
                    id="timeStart"
                    name="timeStart"
                    type="time"
                    defaultValue={initial.timeStart}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeEnd">Until</Label>
                  <Input
                    id="timeEnd"
                    name="timeEnd"
                    type="time"
                    defaultValue={initial.timeEnd}
                    aria-describedby={err('timeEnd') ? 'time-end-error' : undefined}
                  />
                  {err('timeEnd') && (
                    <p id="time-end-error" role="alert" className="text-sm text-destructive">
                      {err('timeEnd')}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_6rem_9rem]">
                <div className="space-y-2">
                  <Label htmlFor="itemCost">Cost</Label>
                  <Input
                    id="itemCost"
                    name="cost"
                    type="number"
                    min={0}
                    step={100}
                    inputMode="decimal"
                    defaultValue={initial.cost}
                    placeholder="Optional"
                    aria-describedby={err('cost') ? 'item-cost-error' : undefined}
                  />
                  {err('cost') && (
                    <p id="item-cost-error" role="alert" className="text-sm text-destructive">
                      {err('cost')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemCurrency">Currency</Label>
                  <Input
                    id="itemCurrency"
                    name="currency"
                    defaultValue={initial.currency}
                    maxLength={3}
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemStatus">Status</Label>
                  <select
                    key={initial.status}
                    id="itemStatus"
                    name="status"
                    defaultValue={initial.status}
                    className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  >
                    {ITINERARY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {ITINERARY_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bookingRef">Booking reference</Label>
                  <Input
                    id="bookingRef"
                    name="bookingRef"
                    defaultValue={initial.bookingRef}
                    placeholder="Optional"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemUrl">Link</Label>
                  <Input
                    id="itemUrl"
                    name="url"
                    type="url"
                    defaultValue={initial.url}
                    placeholder="https://"
                    aria-describedby={err('url') ? 'item-url-error' : undefined}
                  />
                  {err('url') && (
                    <p id="item-url-error" role="alert" className="text-sm text-destructive">
                      {err('url')}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Times, costs, booking references, links and dragging entries into order come with
                the paid plans. Days, activities, notes and the pin that puts this on the map are
                yours on every plan —{' '}
                <Link href="/pricing" className="underline underline-offset-2">
                  see what else changes
                </Link>
                .
              </span>
            </p>
          )}

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

      {/* The same picker the trip wizard uses: search where a MapTiler key
          exists, click the shipped country polygons where it does not. Keyed on
          the pin so reopening it starts from where the pin actually is. */}
      <PlacePicker
        key={pin ? `${pin.lng},${pin.lat}` : 'no-pin'}
        open={picking}
        onOpenChange={setPicking}
        initial={pin}
        label={initial.title || 'this entry'}
        onPick={(place) => setPin({ lng: place.lng, lat: place.lat })}
        onClear={() => setPin(null)}
      />
    </Dialog>
  )
}
