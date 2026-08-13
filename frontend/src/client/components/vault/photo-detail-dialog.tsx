'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, MapPin, Star, Trash2 } from 'lucide-react'
import { deleteMedia, setCoverPhoto, updateMediaDetails } from '@/server/actions/media'
import type { VaultPhoto } from '@/server/queries/vault'
import { formatBytes } from '@/shared/format'
import { formatLngLat } from '@/shared/geo/point'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'

/**
 * One photo, full size, with the things worth saying about it.
 *
 * Alt text sits next to the caption rather than behind an "advanced" toggle:
 * the gallery is unusable with a screen reader without it, and asking for it at
 * the moment the photo is in front of you is the only time it gets written.
 */
export function PhotoDetailDialog({ photo, onClose }: { photo: VaultPhoto; onClose: () => void }) {
  const router = useRouter()
  // Initialised from the photo, not synced to it: the caller keys this
  // component on the photo id, so opening a different one remounts with fresh
  // state rather than copying props into state in an effect.
  const [caption, setCaption] = useState(photo.caption)
  const [altText, setAltText] = useState(photo.altText)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Second press deletes. See the button for why this one asks. */
  const [confirming, setConfirming] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    const result = await updateMediaDetails({ mediaId: photo.id, caption, altText })
    setSaving(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not save.')
      return
    }
    router.refresh()
    onClose()
  }

  async function makeCover() {
    setBusy(true)
    const result = await setCoverPhoto(photo.id)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not set the cover.')
      return
    }
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    const result = await deleteMedia(photo.id)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not delete.')
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 sm:max-w-3xl">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {photo.url && (
            <Image
              src={photo.url}
              alt={photo.altText || photo.caption || 'Photo from this trip'}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-contain"
            />
          )}
        </div>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto p-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base">Photo details</DialogTitle>
            <DialogDescription className="text-xs">
              {photo.width && photo.height ? `${photo.width} × ${photo.height} · ` : ''}
              {formatBytes(photo.bytes)}
              {photo.takenAt
                ? ` · taken ${new Date(photo.takenAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {photo.point && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              <span className="tabular-nums">{formatLngLat(photo.point)}</span>
              <span>· from the camera, and private to you</span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What was happening here?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="altText">Alt text</Label>
            <Input
              id="altText"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the photo for anyone who cannot see it"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {confirming && (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              This removes the file from storage straight away, which is what frees the space it was
              using. A photo is the one thing the trash cannot bring back.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void makeCover()} disabled={busy}>
                <Star className={photo.isFeatured ? 'size-4 fill-current' : 'size-4'} aria-hidden />
                {photo.isFeatured ? 'Cover photo' : 'Make cover'}
              </Button>

              {/* Deleting a photo releases its bytes from storage immediately, so
                  unlike a trip it cannot be restored from the trash. That makes
                  this the one destructive action in the vault, and it asks. */}
              {confirming ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void remove()}
                    disabled={busy}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Delete for good
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                  >
                    Keep it
                  </Button>
                </>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirming(true)}
                  disabled={busy}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </Button>
              )}
            </div>

            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
