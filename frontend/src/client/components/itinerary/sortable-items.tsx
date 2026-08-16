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
import { moveItineraryItem } from '@/server/actions/itinerary'
import type { ItineraryDay, ItineraryEntry } from '@/server/queries/itinerary'
import { dayLabel } from '@/shared/itinerary'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'

/**
 * Dragging an entry to a different time, or a different day — screen 21.
 *
 * The ordering rules this has to respect, and why it is not just a sorted list:
 *
 * `order_index` is what the query sorts by *after* `time_start`, so on a day
 * where everything is timed, dragging changes nothing anybody can see. That is
 * correct — a plan with times on it is ordered by the clock, and a drag that
 * silently disagreed with the times would be a lie. Dragging is what orders the
 * entries that have no time, which in practice is most of a plan while it is
 * being made.
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
   * which during a drag is the optimistic copy, not the prop.
   */
  children: (day: ItineraryDay, items: ItineraryEntry[]) => React.ReactNode
}) {
  const [board, setBoard] = useState<Board>(() => toBoard(days))
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
  }

  const sensors = useSensors(
    // A small distance before a drag starts, so the buttons inside a row —
    // edit, remove, the status picker — still take a plain click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const dayById = useMemo(() => new Map(days.map((d, i) => [d.id, { day: d, index: i }])), [days])

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

  /** Said out loud while an entry is being moved. */
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}. Use the arrow keys to move it, space to drop it, escape to cancel.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${dayNameOf(findDay(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} was moved into ${dayNameOf(findDay(over.id))}.`
        : `${nameOf(active.id)} was returned to where it started.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
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
      {days.map((day) => {
        const items = board[day.id] ?? []
        return (
          <SortableContext
            key={day.id}
            id={day.id}
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {children(day, items)}
          </SortableContext>
        )
      })}

      {/* dnd-kit announces through its own live region; this one names what is
          currently in the air for anything reading the page rather than the
          drag events. */}
      <span className="sr-only" aria-live="polite">
        {activeId ? `Moving ${nameOf(activeId)}.` : ''}
      </span>
    </DndContext>
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
