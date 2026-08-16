'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { moveItineraryDay, moveItineraryItem } from '@/server/actions/itinerary'
import type { ItineraryDay, ItineraryEntry } from '@/server/queries/itinerary'
import { dayLabel } from '@/shared/itinerary'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'

/**
 * Dragging an entry to a different time or a different day, and dragging an
 * undated day into a different position — screen 21.
 *
 * The ordering rules this has to respect, and why it is not just a sorted list:
 *
 * `order_index` is what the query sorts by *after* `time_start`, so on a day
 * where everything is timed, dragging changes nothing anybody can see. That is
 * correct — a plan with times on it is ordered by the clock, and a drag that
 * silently disagreed with the times would be a lie. Dragging is what orders the
 * entries that have no time, which in practice is most of a plan while it is
 * being made. The board says so on the days where it applies, because a handle
 * that springs back without explanation reads as a broken handle.
 *
 * **Days are draggable only while they have no date.** `getItinerary()` sorts
 * dated days by their date, so moving one would either do nothing visible or
 * have to rewrite the date behind the drag — and a plan for the 3rd sitting
 * after the plan for the 4th is worse than a day that cannot be moved. Dated
 * days therefore get no handle at all rather than a handle that loses. The
 * undated ones sort on `order_index` alone and are exactly what
 * `reorder_itinerary_days()` renumbers.
 *
 * **Keyboard and touch are not afterthoughts.** `@dnd-kit` was chosen over the
 * native HTML5 drag events precisely because those do nothing at all on a
 * phone, and this is a travel app. The handle is a real button: space picks an
 * entry up, the arrows move it — across days as well as within one — space puts
 * it down, escape cancels. The announcements below are what a screen reader
 * says while that happens, because the default ones talk about "sortable item
 * 3" rather than about somebody's afternoon.
 *
 * State is local and optimistic. The action revalidates on the server, and the
 * board re-syncs from the props that come back; without the optimistic copy an
 * entry would spring back to where it started for the length of a round trip.
 */

type Board = Record<string, ItineraryEntry[]>

function toBoard(days: ItineraryDay[]): Board {
  return Object.fromEntries(days.map((day) => [day.id, day.items]))
}

export function SortableDays({
  days,
  tripId,
  children,
}: {
  days: ItineraryDay[]
  tripId: string
  /**
   * Renders a day around its list, given that list's *current* contents —
   * which during a drag is the optimistic copy, not the prop — and the day's
   * own drag handle, which is null for a dated day that cannot be moved.
   */
  children: (
    day: ItineraryDay,
    items: ItineraryEntry[],
    dragHandle: React.ReactNode | null
  ) => React.ReactNode
}) {
  const [board, setBoard] = useState<Board>(() => toBoard(days))
  const [order, setOrder] = useState<ItineraryDay[]>(days)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [, startTransition] = useTransition()

  // Re-sync when the server sends new data — after a save, a delete, or the
  // revalidation that follows a move.
  //
  // Adjusted during render rather than in an effect. React documents this as
  // the way to reset state when a prop changes, and it is the better behaviour
  // as well as the one the lint rule allows: an effect would paint the stale
  // order first and correct it a frame later, which on a reorder is a visible
  // flicker of the thing that just moved. `days` keeps its identity across the
  // parent's own re-renders, so this only fires on genuinely new data.
  const [syncedFrom, setSyncedFrom] = useState(days)
  if (syncedFrom !== days) {
    setSyncedFrom(days)
    setBoard(toBoard(days))
    setOrder(days)
  }

  const sensors = useSensors(
    // A small distance before a drag starts, so the buttons inside a row —
    // edit, remove, the status picker — still take a plain click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Indexed off the optimistic order rather than the prop, so "Day 3" in an
  // announcement is the position the reader can currently see.
  const dayById = useMemo(() => new Map(order.map((d, i) => [d.id, { day: d, index: i }])), [order])

  // Only the undated days are in play. They are contiguous at the end of the
  // list — the query sorts dated days first — so moving one within the full
  // array can never displace a dated day.
  const movableDayIds = useMemo(
    () => order.filter((d) => d.dayDate === null).map((d) => d.id),
    [order]
  )

  const findDay = (id: UniqueIdentifier): string | null => {
    if (typeof id === 'string' && id in board) return id
    return Object.keys(board).find((dayId) => board[dayId].some((i) => i.id === id)) ?? null
  }

  const itemById = (id: UniqueIdentifier): ItineraryEntry | null => {
    for (const items of Object.values(board)) {
      const found = items.find((i) => i.id === id)
      if (found) return found
    }
    return null
  }

  const nameOf = (id: UniqueIdentifier) => itemById(id)?.title ?? 'entry'
  const dayNameOf = (dayId: string | null) => {
    const entry = dayId ? dayById.get(dayId) : null
    return entry ? dayLabel(entry.day.title, entry.index) : 'the plan'
  }

  /**
   * Is this drag a whole day, or one entry?
   *
   * Both live in one `DndContext` — dnd-kit resolves `useSortable` to the
   * nearest one, and the entries are inside the day cards, so two contexts
   * would send the day handles to the wrong one. The id is what separates them:
   * a day id is a key of the board, an entry id never is.
   */
  const isDayDrag = (id: UniqueIdentifier) => typeof id === 'string' && id in board

  /** Said out loud while an entry is being moved, or a day. */
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      isDayDrag(active.id)
        ? `Picked up ${dayNameOf(String(active.id))}. Use the arrow keys to move it, space to drop it, escape to cancel.`
        : `Picked up ${nameOf(active.id)}. Use the arrow keys to move it, space to drop it, escape to cancel.`,
    onDragOver: ({ active, over }) => {
      if (!over) return undefined
      if (isDayDrag(active.id)) {
        return over.id === active.id
          ? undefined
          : `${dayNameOf(String(active.id))} is over ${dayNameOf(String(over.id))}.`
      }
      return `${nameOf(active.id)} is over ${dayNameOf(findDay(over.id))}.`
    },
    onDragEnd: ({ active, over }) => {
      if (isDayDrag(active.id)) {
        return over
          ? `${dayNameOf(String(active.id))} was moved.`
          : `${dayNameOf(String(active.id))} was returned to where it started.`
      }
      return over
        ? `${nameOf(active.id)} was moved into ${dayNameOf(findDay(over.id))}.`
        : `${nameOf(active.id)} was returned to where it started.`
    },
    onDragCancel: ({ active }) =>
      isDayDrag(active.id)
        ? `Moving ${dayNameOf(String(active.id))} was cancelled.`
        : `Moving ${nameOf(active.id)} was cancelled.`,
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id)
  }

  /**
   * Moving between days happens here rather than on drop, so the entry appears
   * under the cursor in the day it is heading for instead of jumping there at
   * the end.
   */
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    // A day being dragged is not an entry changing days; the whole optimistic
    // shuffle below would read its id as a container and move nothing.
    if (isDayDrag(active.id)) return

    const from = findDay(active.id)
    const to = findDay(over.id)
    if (!from || !to || from === to) return

    setBoard((current) => {
      const moving = current[from].find((i) => i.id === active.id)
      if (!moving) return current

      // Dropped onto a day rather than onto one of its entries: append.
      const overIndex =
        over.id === to ? current[to].length : current[to].findIndex((i) => i.id === over.id)

      const target = [...current[to]]
      target.splice(overIndex < 0 ? target.length : overIndex, 0, moving)

      return {
        ...current,
        [from]: current[from].filter((i) => i.id !== active.id),
        [to]: target,
      }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    if (isDayDrag(active.id)) {
      handleDayDrop(active.id, over.id)
      return
    }

    const dayId = findDay(over.id)
    if (!dayId) return

    const items = board[dayId]
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = over.id === dayId ? items.length - 1 : items.findIndex((i) => i.id === over.id)

    const ordered =
      oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex
        ? arrayMove(items, oldIndex, newIndex)
        : items

    // The board already shows this; the write is what makes it survive a reload.
    setBoard((current) => ({ ...current, [dayId]: ordered }))

    const formData = new FormData()
    formData.set('dayId', dayId)
    formData.set('tripId', tripId)
    formData.set('itemIds', JSON.stringify(ordered.map((i) => i.id)))

    startTransition(async () => {
      await moveItineraryItem(EMPTY_FORM_STATE, formData)
    })
  }

  function handleDayDrop(activeId: UniqueIdentifier, overId: UniqueIdentifier) {
    if (activeId === overId) return

    const oldIndex = order.findIndex((d) => d.id === activeId)
    const newIndex = order.findIndex((d) => d.id === overId)
    if (oldIndex < 0 || newIndex < 0) return

    // A day can only be dropped onto another undated one. `over` can still be a
    // dated day's card when the pointer strays, and honouring that would push a
    // dated day out of date order.
    if (order[newIndex].dayDate !== null) return

    const reordered = arrayMove(order, oldIndex, newIndex)
    setOrder(reordered)

    // Every day is renumbered, not only the ones that moved. The dated days
    // keep their positions — they are sorted by date before `order_index` is
    // ever consulted — so this simply leaves the column consistent with what
    // the screen shows instead of interleaving two numbering schemes.
    const formData = new FormData()
    formData.set('tripId', tripId)
    formData.set('dayIds', JSON.stringify(reordered.map((d) => d.id)))

    startTransition(async () => {
      await moveItineraryDay(EMPTY_FORM_STATE, formData)
    })
  }

  // One `DndContext` for both levels, and the sortable contexts nested to
  // match the DOM: the days' context is the outer one, and each day's entries
  // get theirs *inside* that day's node. `useSortable` resolves to the nearest
  // one, so a second `DndContext` would have captured the day handles — they
  // are rendered inside the cards, which are inside the entry contexts.
  //
  // `closestCorners` serves both: entries need it to cross between days, and a
  // vertical list of cards is the case it degenerates to.
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={movableDayIds} strategy={verticalListSortingStrategy}>
        {order.map((day, index) => {
          const items = board[day.id] ?? []
          const withItems = (handle: React.ReactNode | null) => (
            <SortableContext
              id={day.id}
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {children(day, items, handle)}
            </SortableContext>
          )

          return day.dayDate === null && movableDayIds.length > 1 ? (
            <SortableDay
              key={day.id}
              day={day}
              label={dayLabel(day.title, index)}
              render={withItems}
            />
          ) : (
            // A dated day, or the only undated one: nothing to reorder it
            // against, so no handle rather than one that does nothing.
            <div key={day.id}>{withItems(null)}</div>
          )
        })}
      </SortableContext>

      {/* dnd-kit announces through its own live region; this one names what is
          currently in the air for anything reading the page rather than the
          drag events. */}
      <span className="sr-only" aria-live="polite">
        {activeId
          ? `Moving ${isDayDrag(activeId) ? dayNameOf(String(activeId)) : nameOf(activeId)}.`
          : ''}
      </span>
    </DndContext>
  )
}

/**
 * One draggable day card.
 *
 * The card itself comes from the caller — this only wraps it in the sortable
 * node and hands back the handle to put wherever the card's header has room.
 */
function SortableDay({
  day,
  label,
  render,
}: {
  day: ItineraryDay
  label: string
  render: (handle: React.ReactNode) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: day.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-60' : undefined}
    >
      {render(
        <button
          type="button"
          aria-label={`Reorder ${label}`}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

/**
 * One draggable row.
 *
 * The handle is the only drag surface. Making the whole row draggable would
 * mean a plan you cannot select text in, and would fight every button inside it.
 */
export function SortableItem({
  id,
  label,
  children,
}: {
  id: string
  /** Names the handle for a screen reader: "Reorder Fushimi Inari". */
  label: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-60' : undefined}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-label={`Reorder ${label}`}
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
