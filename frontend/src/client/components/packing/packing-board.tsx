'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  CircleCheck,
  ListChecks,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  applyChecklistTemplate,
  deleteChecklist,
  deleteChecklistItem,
  saveChecklistItem,
  setChecklistItemDone,
} from '@/server/actions/packing'
import type { Checklist, PackingData, PackingItem } from '@/server/queries/packing'
import { CHECKLIST_KIND_LABEL, groupByCategory, templatesFor } from '@/shared/packing'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { useActionToast } from '@/client/hooks/use-action-toast'
import { ItemDialog, ListDialog } from '@/client/components/packing/packing-dialogs'
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
import { Input } from '@/client/components/ui/input'
import { Progress } from '@/client/components/ui/progress'

/**
 * Packing lists and checklists — screen 23.
 *
 * Built around the two things that actually happen on this screen: adding a
 * line, and ticking one off. Both are one gesture and neither opens a dialog —
 * packing is done standing in a room, and a modal per sock is not that.
 * Everything rarer than those two — renaming, changing a quantity, deleting —
 * costs a click more.
 */
export function PackingBoard({ packing }: { packing: PackingData }) {
  const [addingList, setAddingList] = useState(false)
  const [renaming, setRenaming] = useState<Checklist | null>(null)
  const [removingList, setRemovingList] = useState<Checklist | null>(null)
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null)

  const canAdd = packing.quota.allowed

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            {packing.overall.total === 0
              ? 'Nothing on any list yet.'
              : `${packing.overall.done} of ${packing.overall.total} done across ${
                  packing.lists.length
                } ${packing.lists.length === 1 ? 'list' : 'lists'}.`}
          </p>
          {packing.quota.limit !== null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {packing.quota.used} of {packing.quota.limit} lists on this trip
            </p>
          )}
        </div>

        <Button onClick={() => setAddingList(true)} disabled={!canAdd}>
          <Plus className="size-4" aria-hidden />
          Start a list
        </Button>
      </div>

      {!canAdd && packing.quota.reason && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {packing.quota.reason}{' '}
            <Link href="/upgrade" className="underline underline-offset-2">
              See the plans
            </Link>
            .
          </span>
        </p>
      )}

      {packing.lists.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <ListChecks className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Nothing to forget yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              A packing list for what goes in the bag, a to-do list for what has to happen before
              you leave. Ticking things off is one tap, and the count is there on the morning of the
              flight.
            </p>
          </div>
          <Button onClick={() => setAddingList(true)} disabled={!canAdd}>
            <Plus className="size-4" aria-hidden />
            Start the first one
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {packing.lists.map((list) => (
            <li key={list.id}>
              <ListCard
                list={list}
                tripId={packing.tripId}
                onRename={() => setRenaming(list)}
                onRemove={() => setRemovingList(list)}
                onEditItem={setEditingItem}
              />
            </li>
          ))}
        </ul>
      )}

      <TemplateSection packing={packing} canAdd={canAdd} />

      {/* Keyed by the row so the uncontrolled inputs remount with its values. */}
      <ListDialog
        key={renaming?.id ?? 'new-list'}
        tripId={packing.tripId}
        list={renaming}
        open={addingList || renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddingList(false)
            setRenaming(null)
          }
        }}
      />

      <ItemDialog
        key={editingItem?.id ?? 'no-item'}
        item={editingItem}
        open={editingItem !== null}
        onOpenChange={(open) => !open && setEditingItem(null)}
      />

      <RemoveListDialog
        list={removingList}
        tripId={packing.tripId}
        onClose={() => setRemovingList(null)}
      />
    </div>
  )
}

function ListCard({
  list,
  tripId,
  onRename,
  onRemove,
  onEditItem,
}: {
  list: Checklist
  tripId: string
  onRename: () => void
  onRemove: () => void
  onEditItem: (item: PackingItem) => void
}) {
  const groups = groupByCategory(list.items)

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="flex items-center gap-2 font-medium">
              {list.title}
              {list.progress.complete && (
                <Badge variant="secondary" className="gap-1">
                  <CircleCheck className="size-3" aria-hidden />
                  All done
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {CHECKLIST_KIND_LABEL[list.kind]} · {list.progress.done} of {list.progress.total}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${list.title}`}
              onClick={onRename}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${list.title}`}
              onClick={onRemove}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {list.progress.total > 0 && <Progress value={list.progress.percent} />}

        {groups.map((group) => (
          <div key={group.category || '__none'} className="space-y-1.5">
            {group.category && (
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.category}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} tripId={tripId} onEdit={() => onEditItem(item)} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <AddItemForm checklistId={list.id} />
      </CardContent>
    </Card>
  )
}

/**
 * One line, and the tick.
 *
 * The checkbox submits its own form on change and sends the value it means
 * rather than "flip whatever you find" — two taps in quick succession then land
 * as two statements instead of one race.
 */
function ItemRow({
  item,
  tripId,
  onEdit,
}: {
  item: PackingItem
  tripId: string
  onEdit: () => void
}) {
  const router = useRouter()
  const [toggleState, toggleAction] = useActionState(setChecklistItemDone, EMPTY_FORM_STATE)
  const [removeState, removeAction] = useActionState(deleteChecklistItem, EMPTY_FORM_STATE)
  // Ticking a box shows itself; removing a line does not, and a failed tick is
  // otherwise completely silent.
  useActionToast(toggleState, {})
  useActionToast(removeState, { success: 'Item removed.' })

  useEffect(() => {
    if (toggleState.saved || removeState.saved) router.refresh()
  }, [toggleState, removeState, router])

  return (
    <div className="group flex items-center gap-2">
      <form action={toggleAction} className="flex min-w-0 flex-1 items-center gap-2">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="tripId" value={tripId} />
        {/* The value sent is the one the tick would produce, not a toggle. */}
        <input type="hidden" name="done" value={item.isDone ? 'false' : 'true'} />
        <input
          id={`item-${item.id}`}
          type="checkbox"
          checked={item.isDone}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="size-4 shrink-0 rounded border-input accent-primary"
        />
        <label
          htmlFor={`item-${item.id}`}
          className={`min-w-0 flex-1 cursor-pointer truncate text-sm ${
            item.isDone ? 'text-muted-foreground line-through' : ''
          }`}
        >
          {item.label}
          {item.quantity > 1 && (
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
              ×{item.quantity}
            </span>
          )}
        </label>
      </form>

      {item.notes && (
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {item.notes}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${item.label}`}
        onClick={onEdit}
        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Pencil className="size-3.5" aria-hidden />
      </Button>

      <form action={removeAction}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="tripId" value={tripId} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.label}`}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </form>
    </div>
  )
}

/**
 * The field at the bottom of every list.
 *
 * Clears itself and keeps focus on success, because the way a packing list gets
 * written is one thing after another without touching the mouse.
 */
function AddItemForm({ checklistId }: { checklistId: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, formAction] = useActionState(saveChecklistItem, EMPTY_FORM_STATE)

  useEffect(() => {
    if (!state.saved) return
    formRef.current?.reset()
    inputRef.current?.focus()
    router.refresh()
  }, [state, router])

  return (
    <form ref={formRef} action={formAction} className="space-y-2 border-t pt-3">
      <input type="hidden" name="checklistId" value={checklistId} />
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          name="label"
          placeholder="Add something…"
          maxLength={160}
          required
          aria-label="Add an item"
          className="flex-1"
        />
        <Input
          name="category"
          placeholder="Category"
          maxLength={60}
          aria-label="Category"
          className="w-32"
        />
        <AddItemButton />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}

function AddItemButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="icon" aria-label="Add" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="size-4" aria-hidden />
      )}
    </Button>
  )
}

/**
 * Templates, when the plan has them.
 *
 * A template is copied into ordinary rows, so what lands is a list somebody can
 * gut and rewrite. On a plan without them the section still appears, saying
 * what it is — hiding a paid feature entirely means nobody ever learns it
 * exists.
 */
function TemplateSection({ packing, canAdd }: { packing: PackingData; canAdd: boolean }) {
  const router = useRouter()
  const [state, formAction] = useActionState(applyChecklistTemplate, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'Template added.' })

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])

  const templates = templatesFor(packing.tripType)

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Start from a template</h2>
        <p className="text-sm text-muted-foreground">
          {packing.templatesAllowed
            ? 'Copied in as an ordinary list — edit it, gut it, add your own. Changing a template later never touches a list you have already made.'
            : 'Templates come with the unlimited plans. Everything else on this screen works the same on yours.'}
        </p>
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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <li key={template.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <div className="space-y-1">
                  <p className="font-medium">{template.title}</p>
                  <p className="text-sm text-muted-foreground">{template.summary}</p>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {template.items.length} items · {CHECKLIST_KIND_LABEL[template.kind]}
                </p>
                <form action={formAction} className="mt-auto pt-1">
                  <input type="hidden" name="tripId" value={packing.tripId} />
                  <input type="hidden" name="templateId" value={template.id} />
                  <TemplateButton disabled={!packing.templatesAllowed || !canAdd} />
                </form>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {!packing.templatesAllowed && (
        <p className="text-sm">
          <Link href="/upgrade" className="underline underline-offset-2">
            See what the paid plans add
          </Link>
        </p>
      )}
    </section>
  )
}

function TemplateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="sm" disabled={disabled || pending}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : disabled ? (
        <Lock className="size-3.5" aria-hidden />
      ) : (
        <Plus className="size-3.5" aria-hidden />
      )}
      Use this
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

function RemoveListDialog({
  list,
  tripId,
  onClose,
}: {
  list: Checklist | null
  tripId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(deleteChecklist, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'List removed.' })

  useEffect(() => {
    if (!state.saved) return
    onClose()
    router.refresh()
  }, [state, onClose, router])

  return (
    <Dialog open={list !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {list?.title}?</DialogTitle>
          <DialogDescription>
            {list?.items.length
              ? `All ${list.items.length} ${
                  list.items.length === 1 ? 'item' : 'items'
                } on it go too. There is no trash for a list.`
              : 'There is no trash for a list, though an empty one costs nothing to start again.'}
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
          <input type="hidden" name="id" value={list?.id ?? ''} />
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
