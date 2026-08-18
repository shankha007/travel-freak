'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ImageOff, Images, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { clearCoverPhoto, setCoverPhoto } from '@/server/actions/media'
import { EmptyState } from '@/client/components/empty-state'
import { Button } from '@/client/components/ui/button'
import { cn } from '@/shared/utils'

/** Just enough of a photo to choose between them. */
export interface CoverOption {
  id: string
  url: string | null
  altText: string
  caption: string
}

/**
 * Choosing the trip's hero image — the wizard's missing step.
 *
 * §5 of the plan has always listed `cover` between places and visibility, and it
 * was the one step never built. The reason it stayed missing is visible in the
 * order: you cannot choose a cover while creating a trip, because the trip has
 * no photographs until it exists. So this appears on the edit wizard only, and
 * on create the step explains itself rather than showing an empty grid.
 *
 * **It writes immediately, which the rest of the wizard does not.** Everywhere
 * else the form holds its state client-side and submits one payload at the end,
 * so a half-finished wizard never writes a partial trip. A cover is different in
 * kind: the choice is one field, idempotent, instantly reversible, and it is the
 * same write the vault already offers on the same photographs. Threading it
 * through the payload would mean duplicating what `setCoverPhoto` does — which
 * is *two* writes, the trip's hero and `media.is_featured` for the globe — and
 * two implementations of that pair is exactly how they drift apart.
 */
export function CoverPicker({
  tripId,
  photos,
  coverId,
}: {
  tripId: string
  photos: CoverOption[]
  /** The current cover, or null. */
  coverId: string | null
}) {
  const [pending, startTransition] = useTransition()
  // Tracked locally so the tick moves the instant it is clicked; the server is
  // the authority and a failure puts it back.
  const [selected, setSelected] = useState(coverId)

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff className="size-6 text-muted-foreground" aria-hidden />}
        title="No photographs yet"
        description="A cover is chosen from the trip's own photos. Add some to the vault and they will appear here."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/trips/${tripId}/vault`} />}
          >
            <Images className="size-4" aria-hidden />
            Open the vault
          </Button>
        }
      />
    )
  }

  function choose(photo: CoverOption) {
    const wasSelected = selected
    // Clicking the current cover takes it off, which is the only way back to a
    // trip with no hero once one has been chosen.
    const next = photo.id === selected ? null : photo.id
    setSelected(next)

    startTransition(async () => {
      const result = next === null ? await clearCoverPhoto(tripId) : await setCoverPhoto(photo.id)

      if (!result.ok) {
        setSelected(wasSelected)
        toast.error(result.error ?? 'Could not change the cover.')
        return
      }

      toast.success(next === null ? 'Cover removed.' : 'Cover set.')
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The image at the top of the trip, and the one a shared link shows. Choosing it again takes
        it off. This saves on its own, rather than waiting for the button below.
      </p>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => {
          const active = photo.id === selected

          return (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => choose(photo)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  'relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 transition-colors',
                  active ? 'border-primary' : 'border-transparent hover:border-border'
                )}
              >
                {photo.url ? (
                  <Image
                    src={photo.url}
                    alt={photo.altText || photo.caption || ''}
                    fill
                    sizes="(min-width: 768px) 12rem, 45vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center bg-muted" aria-hidden />
                )}

                {active && (
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}

                {/* The state in words, because a coloured border and a tick are
                    both invisible to a screen reader. `aria-pressed` carries it
                    too; this is what makes the button's name say which one. */}
                <span className="sr-only">
                  {active ? 'Current cover. Choose again to remove it.' : 'Use as the cover'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {pending && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Saving…
        </p>
      )}
    </div>
  )
}
