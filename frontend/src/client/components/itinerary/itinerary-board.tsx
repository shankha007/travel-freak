'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  BedDouble,
  CalendarPlus,
  Clock3,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  StickyNote,
  Ticket,
  TramFront,
  Trash2,
  Utensils,
  Wallet,
} from 'lucide-react'
import {
  addTripDays,
  deleteItineraryDay,
  deleteItineraryItem,
  setItineraryItemStatus,
} from '@/server/actions/itinerary'
import { recordItineraryExpense } from '@/server/actions/budget'
import type { ItineraryData, ItineraryDay, ItineraryEntry } from '@/server/queries/itinerary'
import { formatMoney } from '@/shared/budget'
import {
  ITINERARY_KIND_LABEL,
  ITINERARY_STATUSES,
  ITINERARY_STATUS_LABEL,
  canRecordExpense,
  dayLabel,
  formatTimeRange,
  planVariance,
  type ItineraryKind,
} from '@/shared/itinerary'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { useActionToast } from '@/client/hooks/use-action-toast'
import { DayDialog } from '@/client/components/itinerary/day-dialog'
import { ItemDialog } from '@/client/components/itinerary/item-dialog'
import { ItineraryMap } from '@/client/components/itinerary/itinerary-map'
import { SortableDays, SortableItem } from '@/client/components/itinerary/sortable-items'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'

/**
 * The itinerary — screen 21.
 *
 * A day is a card and an entry is a line on it. Named rather than numbered
 * where somebody has named it, dated where the trip has dates, and neither is
 * required: a plan gets written before a booking exists, and a builder that
 * insists on a date is a builder people leave.
 *
 * Icons are imported one by one rather than resolved off the icon library by
 * name — the sidebar's 595 KB lesson. `ITINERARY_KIND_ICON` names them for
 * anywhere that can afford the lookup; this maps the six it draws.
 */
const KIND_ICON: Record<ItineraryKind, typeof Ticket> = {
  activity: Ticket,
  hotel: BedDouble,
  restaurant: Utensils,
  transport: TramFront,
  booking: FileText,
  note: StickyNote,
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  planned: 'outline',
  booked: 'default',
  done: 'secondary',
  skipped: 'outline',
}

export function ItineraryBoard({ itinerary }: { itinerary: ItineraryData }) {
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null)
  const [addingDay, setAddingDay] = useState(false)
  const [removingDay, setRemovingDay] = useState<ItineraryDay | null>(null)

  const [addingTo, setAddingTo] = useState<ItineraryDay | null>(null)
  const [editingItem, setEditingItem] = useState<ItineraryEntry | null>(null)
  const [removingItem, setRemovingItem] = useState<ItineraryEntry | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {itinerary.days.length === 0
            ? 'Nothing planned yet.'
            : `${itinerary.days.length} ${itinerary.days.length === 1 ? 'day' : 'days'}, ${
                itinerary.itemCount
              } ${itinerary.itemCount === 1 ? 'entry' : 'entries'}.`}
        </p>

        <div className="flex flex-wrap gap-2">
          {itinerary.missingDates.length > 0 && (
            <LayOutDaysButton tripId={itinerary.tripId} count={itinerary.missingDates.length} />
          )}
          <Button onClick={() => setAddingDay(true)}>
            <Plus className="size-4" aria-hidden />
            Add a day
          </Button>
        </div>
      </div>

      {itinerary.days.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <CalendarPlus className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Plan it day by day</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {itinerary.missingDates.length > 0
                ? `This trip runs ${itinerary.missingDates.length} days. Lay them all out at once, or add them one at a time — a day needs no date and no title to be useful.`
                : 'Add a day and start filling it in. A day needs no date and no title, so an idea can be written down before anything is booked.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {itinerary.missingDates.length > 0 && (
              <LayOutDaysButton tripId={itinerary.tripId} count={itinerary.missingDates.length} />
            )}
            <Button variant="outline" onClick={() => setAddingDay(true)}>
              <Plus className="size-4" aria-hidden />
              Add a day
            </Button>
          </div>
        </div>
      ) : (
        // The map alongside, once there is a plan to draw. Sticky on a wide
        // screen so it stays put while a long itinerary scrolls past it, and
        // below the days on a phone, where a map above the list would push the
        // thing you came to read off the screen.
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <SortableDays days={itinerary.days} tripId={itinerary.tripId}>
              {(day, items, dragHandle) => {
                const index = itinerary.days.findIndex((d) => d.id === day.id)
                // Every entry timed means the clock decides the order and a
                // drag springs back. True by design — but only if it is said.
                const clockOrdered =
                  itinerary.full && items.length > 1 && items.every((i) => i.timeStart !== null)

                return (
                  <Card className="mb-4">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* The handle sits beside the heading rather than in it:
                            inside, its label would be read as part of the
                            heading text on every day of the plan. */}
                        <div className="flex min-w-0 items-start gap-1">
                          {dragHandle}
                          <div className="min-w-0 space-y-0.5">
                            <h2 className="font-medium">{dayLabel(day.title, index)}</h2>
                            <p className="text-sm text-muted-foreground">
                              {day.dayDate ? (
                                <time dateTime={day.dayDate}>
                                  {new Date(`${day.dayDate}T00:00:00`).toLocaleDateString('en-IN', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </time>
                              ) : (
                                'No date yet'
                              )}
                              {day.costs.length > 0 && (
                                <>
                                  {' · '}
                                  <span className="tabular-nums">
                                    {day.costs
                                      .map((c) => formatMoney(c.total, c.currency))
                                      .join(' + ')}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${dayLabel(day.title, index)}`}
                            onClick={() => setEditingDay(day)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${dayLabel(day.title, index)}`}
                            onClick={() => setRemovingDay(day)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </div>

                      {day.notes && <p className="text-sm text-muted-foreground">{day.notes}</p>}

                      {items.length > 0 && (
                        <ul className="space-y-3 border-l pl-4">
                          {items.map((item) => (
                            <li key={item.id}>
                              {itinerary.full ? (
                                <SortableItem id={item.id} label={item.title}>
                                  <ItemRow
                                    item={item}
                                    tripId={itinerary.tripId}
                                    full={itinerary.full}
                                    onEdit={() => setEditingItem(item)}
                                    onRemove={() => setRemovingItem(item)}
                                  />
                                </SortableItem>
                              ) : (
                                <ItemRow
                                  item={item}
                                  tripId={itinerary.tripId}
                                  full={itinerary.full}
                                  onEdit={() => setEditingItem(item)}
                                  onRemove={() => setRemovingItem(item)}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Gap 12's other edge: on a day where every entry is
                          timed, `time_start` sorts ahead of `order_index`, so a
                          drag lands the entry back where it was. That is right —
                          a plan with times on it is ordered by the clock — but
                          an unexplained spring-back reads as a bug. */}
                      {clockOrdered && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="size-3.5 shrink-0" aria-hidden />
                          Everything here has a time, so this day is ordered by the clock. Clear an
                          entry’s time to put it where you like.
                        </p>
                      )}

                      <Button variant="outline" size="sm" onClick={() => setAddingTo(day)}>
                        <Plus className="size-3.5" aria-hidden />
                        Add to this day
                      </Button>
                    </CardContent>
                  </Card>
                )
              }}
            </SortableDays>
          </div>

          <aside className="lg:sticky lg:top-6">
            <ItineraryMap days={itinerary.days} />
          </aside>
        </div>
      )}

      {/* Keyed by the row so the uncontrolled inputs remount with its values
          rather than syncing props into state. */}
      <DayDialog
        key={editingDay?.id ?? 'new-day'}
        tripId={itinerary.tripId}
        day={editingDay}
        suggestedDate={itinerary.missingDates[0] ?? null}
        open={addingDay || editingDay !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingDay(false)
            setEditingDay(null)
          }
        }}
      />

      <ItemDialog
        key={editingItem?.id ?? addingTo?.id ?? 'new-item'}
        dayId={editingItem?.dayId ?? addingTo?.id ?? ''}
        item={editingItem}
        full={itinerary.full}
        currency={itinerary.currency}
        open={addingTo !== null || editingItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingTo(null)
            setEditingItem(null)
          }
        }}
      />

      <RemoveDialog
        title={removingDay ? `Remove ${dayLabel(removingDay.title, 0)}?` : ''}
        description={
          removingDay?.items.length
            ? `The ${removingDay.items.length} ${
                removingDay.items.length === 1 ? 'entry' : 'entries'
              } on this day go with it. There is no trash for a plan.`
            : 'There is no trash for a plan — this day is gone, though you can add it again.'
        }
        id={removingDay?.id ?? null}
        tripId={itinerary.tripId}
        action={deleteItineraryDay}
        onClose={() => setRemovingDay(null)}
      />

      <RemoveDialog
        title={removingItem ? `Remove ${removingItem.title}?` : ''}
        description="There is no trash for a plan — this entry is gone."
        id={removingItem?.id ?? null}
        tripId={itinerary.tripId}
        action={deleteItineraryItem}
        onClose={() => setRemovingItem(null)}
      />
    </div>
  )
}

function ItemRow({
  item,
  tripId,
  full,
  onEdit,
  onRemove,
}: {
  item: ItineraryEntry
  tripId: string
  full: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const Icon = KIND_ICON[item.kind] ?? Ticket
  const time = formatTimeRange(item.timeStart, item.timeEnd)

  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 font-medium">
          {time && <span className="text-sm text-muted-foreground tabular-nums">{time}</span>}
          <span className={item.status === 'skipped' ? 'line-through opacity-60' : undefined}>
            {item.title}
          </span>
        </p>

        {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{ITINERARY_KIND_LABEL[item.kind]}</span>
          {item.cost !== null && (
            <span className="tabular-nums">
              {formatMoney(item.cost, item.currency)}
              {item.recorded && ' planned'}
            </span>
          )}
          {item.recorded && <RecordedCost item={item} />}
          {item.bookingRef && <span>Ref {item.bookingRef}</span>}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              <Link2 className="size-3" aria-hidden />
              Booking
            </a>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {full && canRecordExpense(item) && <RecordExpenseButton item={item} tripId={tripId} />}
        {full ? (
          <StatusPicker item={item} tripId={tripId} />
        ) : (
          <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>
            {ITINERARY_STATUS_LABEL[item.status]}
          </Badge>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.title}`} onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.title}`}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

/**
 * What the plan actually came to, beside what it was planned at.
 *
 * The difference is only shown when the two are in the same currency, which is
 * the same refusal every other total on these screens makes: there is no
 * exchange rate here, so "₹8,000 planned, $95 spent" is two facts rather than an
 * overspend. `planVariance()` decides, and returns null in that case.
 */
function RecordedCost({ item }: { item: ItineraryEntry }) {
  if (!item.recorded) return null

  const variance = planVariance(item, item.recorded)

  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Wallet className="size-3" aria-hidden />
      {formatMoney(item.recorded.amount, item.recorded.currency)} spent
      {variance && variance.difference !== 0 && (
        <span className={variance.difference > 0 ? 'text-destructive' : undefined}>
          ({variance.difference > 0 ? '+' : '−'}
          {formatMoney(Math.abs(variance.difference), variance.currency)})
        </span>
      )}
    </span>
  )
}

/**
 * Turns a planned entry into an expense on the budget.
 *
 * The amount starts at the planned figure and is editable on the budget screen
 * afterwards — recording a plan is not the same as claiming it was right, and
 * the interesting number is the one that turned out different.
 *
 * Offered only on a plan that has a price. Without one there is nothing to
 * prefill, and the writer would land on the same empty form the budget screen
 * already gives them.
 */
function RecordExpenseButton({ item, tripId }: { item: ItineraryEntry; tripId: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(recordItineraryExpense, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'Recorded on the budget.' })

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="tripId" value={tripId} />
      {/* A child of the form, because that is the only place `useFormStatus`
          can see it — called here it would report the enclosing form's state. */}
      <RecordExpenseSubmit item={item} error={state.error} />
    </form>
  )
}

function RecordExpenseSubmit({ item, error }: { item: ItineraryEntry; error?: string | null }) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      // Names the amount, because the button records it without asking again.
      aria-label={`Record ${formatMoney(item.cost ?? 0, item.currency)} spent on ${item.title}`}
      title={error ?? 'Record this on the budget'}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Wallet className="size-3.5" aria-hidden />
      )}
    </Button>
  )
}

/**
 * Planned → booked → done, in one gesture.
 *
 * A select that submits on change rather than a button that cycles: four states
 * behind one button means guessing which comes next, and the label would have
 * to describe the next state while showing the current one.
 */
function StatusPicker({ item, tripId }: { item: ItineraryEntry; tripId: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(setItineraryItemStatus, EMPTY_FORM_STATE)
  // No success toast: the select already shows the new status, and confirming
  // every change on a board of twenty entries would be a stack of noise.
  useActionToast(state, {})

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="tripId" value={tripId} />
      <select
        name="status"
        defaultValue={item.status}
        aria-label={`Status of ${item.title}`}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-7 rounded-md border bg-background px-2 text-xs"
      >
        {ITINERARY_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ITINERARY_STATUS_LABEL[status]}
          </option>
        ))}
      </select>
    </form>
  )
}

function LayOutDaysButton({ tripId, count }: { tripId: string; count: number }) {
  const router = useRouter()
  const [state, formAction] = useActionState(addTripDays, EMPTY_FORM_STATE)
  // This form prints its own error underneath, so only the success is spoken.
  useActionToast(state, { success: 'Days laid out.', error: false })

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="tripId" value={tripId} />
      <SubmitButton variant="outline" label={`Lay out ${count} ${count === 1 ? 'day' : 'days'}`} />
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}

function SubmitButton({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'default' | 'outline' | 'destructive'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CalendarPlus className="size-4" aria-hidden />
      )}
      {label}
    </Button>
  )
}

function RemoveSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Removing…' : 'Remove it'}
    </Button>
  )
}

/**
 * One confirmation, used for both a day and an entry.
 *
 * The two differ only in what they say, and a plan has no trash behind it —
 * saying so is more honest than inventing a recovery path for four words and a
 * time.
 */
function RemoveDialog({
  title,
  description,
  id,
  tripId,
  action,
  onClose,
}: {
  title: string
  description: string
  id: string | null
  tripId: string
  action: (state: typeof EMPTY_FORM_STATE, formData: FormData) => Promise<typeof EMPTY_FORM_STATE>
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE)

  useEffect(() => {
    if (!state.saved) return
    onClose()
    router.refresh()
  }, [state, onClose, router])

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
          <input type="hidden" name="id" value={id ?? ''} />
          <input type="hidden" name="tripId" value={tripId} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Keep it
            </Button>
            <RemoveSubmit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
