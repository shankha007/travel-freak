'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CalendarRange,
  CircleCheck,
  Heart,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { deleteWishlistItem, type DeleteWishlistState } from '@/server/actions/wishlist'
import type { WishlistEntry } from '@/server/queries/wishlist'
import { priorityLabel } from '@/shared/wishlist'
import { WishlistDialog } from '@/client/components/wishlist/wishlist-dialog'
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

const initialDelete: DeleteWishlistState = { error: null }

/**
 * The wishlist — screen 30.
 *
 * Grouped by priority rather than sorted within one long list: the point of
 * ranking somewhere "Next up" is to see it apart from the fifteen places you
 * would go one day, and a heading does that where a badge on row nine does not.
 */
export function WishlistBoard({ items }: { items: WishlistEntry[] }) {
  const [editing, setEditing] = useState<WishlistEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<WishlistEntry | null>(null)

  const groups = [...new Set(items.map((i) => i.priority))]
    .sort((a, b) => a - b)
    .map((priority) => ({ priority, items: items.filter((i) => i.priority === priority) }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? 'Nothing on the list yet.'
            : `${items.length} ${items.length === 1 ? 'place' : 'places'} you want to reach — each one painted planned on your globe.`}
        </p>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          Add a place
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Heart className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Where next?</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Add the places you mean to get to. They fill in yellow on your globe and both maps,
              and they cost nothing against your plan — a wish is not a trip until you log one.
            </p>
          </div>
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Add the first one
          </Button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.priority} className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {priorityLabel(group.priority)}
              <span className="ml-1.5 tabular-nums">({group.items.length})</span>
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-2 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            <span aria-hidden>{item.flag}</span>
                            <span className="truncate">{item.countryName}</span>
                          </p>
                          {item.title && (
                            <p className="text-sm text-muted-foreground">{item.title}</p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${item.countryName}`}
                            onClick={() => setEditing(item)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${item.countryName}`}
                            onClick={() => setRemoving(item)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="line-clamp-3 text-sm text-muted-foreground">{item.notes}</p>
                      )}

                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                        {item.estBudget !== null && (
                          <span className="flex items-center gap-1">
                            <Wallet className="size-3" aria-hidden />
                            <span className="tabular-nums">
                              {item.currency} {item.estBudget.toLocaleString('en-IN')}
                            </span>
                          </span>
                        )}
                        {item.bestSeason && (
                          <span className="flex items-center gap-1">
                            <CalendarRange className="size-3" aria-hidden />
                            {item.bestSeason}
                          </span>
                        )}
                      </div>

                      {/* The globe paints a visited country green whatever the
                          wishlist says, so a wish for somewhere you have been
                          looks like a bug unless the screen names it. */}
                      {item.alreadyVisited && (
                        <Badge variant="secondary" className="w-fit gap-1">
                          <CircleCheck className="size-3" aria-hidden />
                          You have been here
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Keyed by the row so the uncontrolled inputs remount with its values
          instead of syncing props into state. */}
      <WishlistDialog
        key={editing?.id ?? 'new'}
        item={editing}
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false)
            setEditing(null)
          }
        }}
      />

      <RemoveDialog item={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}

function RemoveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Removing…' : 'Remove it'}
    </Button>
  )
}

/**
 * Removal is confirmed, and the confirmation is where the globe is mentioned.
 *
 * Unlike a trip there is no trash to fall back on — a wish is one row and a few
 * words, so the honest thing is to say it is gone rather than invent a
 * recovery path for it.
 */
function RemoveDialog({ item, onClose }: { item: WishlistEntry | null; onClose: () => void }) {
  const router = useRouter()
  const [state, formAction] = useActionState(deleteWishlistItem, initialDelete)

  useEffect(() => {
    if (state.error === null && state !== initialDelete) {
      onClose()
      router.refresh()
    }
  }, [state, onClose, router])

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {item?.countryName} from the wishlist?</DialogTitle>
          <DialogDescription>
            It stops being painted planned on your globe and both maps. There is no trash for wishes
            — this one is gone, though you can always add it again.
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
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Keep it
            </Button>
            <RemoveButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
