'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  BedDouble,
  CalendarPlus,
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
} from 'lucide-react'
import {
  addTripDays,
  deleteItineraryDay,
  deleteItineraryItem,
  setItineraryItemStatus,
} from '@/server/actions/itinerary'
import type { ItineraryData, ItineraryDay, ItineraryEntry } from '@/server/queries/itinerary'
import { formatMoney } from '@/shared/budget'
import {
  ITINERARY_KIND_LABEL,
  ITINERARY_STATUSES,
  ITINERARY_STATUS_LABEL,
  dayLabel,
  formatTimeRange,
  type ItineraryKind,
} from '@/shared/itinerary'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
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
              {(day, items) => {
                const index = itinerary.days.findIndex((d) => d.id === day.id)
                return (
                  <Card className="mb-4">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
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
            <span className="tabular-nums">{formatMoney(item.cost, item.currency)}</span>
          )}
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
 * Planned → booked → done, in one gesture.
 *
 * A select that submits on change rather than a button that cycles: four states
 * behind one button means guessing which comes next, and the label would have
 * to describe the next state while showing the current one.
 */
function StatusPicker({ item, tripId }: { item: ItineraryEntry; tripId: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(setItineraryItemStatus, EMPTY_FORM_STATE)

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
