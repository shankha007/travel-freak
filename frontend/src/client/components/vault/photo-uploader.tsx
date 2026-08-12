'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Check, ImagePlus, Loader2, Upload, X } from 'lucide-react'
import { createClient } from '@/client/supabase/client'
import { confirmUpload } from '@/server/actions/media'
import { rejectionFor } from '@/shared/media'
import { formatBytes } from '@/shared/format'
import { Button } from '@/client/components/ui/button'
import { Progress } from '@/client/components/ui/progress'
import { cn } from '@/shared/utils'

/**
 * Drag-and-drop uploader — screen 26.
 *
 * Files go straight from the browser to Supabase Storage using a signed URL, so
 * no photo passes through the Next.js server and hosting costs stay flat as
 * media grows. The server's part is the signing route, which is where the quota
 * is enforced, and `confirmUpload`, which writes the row once the bytes have
 * landed.
 *
 * Uploads run one at a time on purpose: the quota is counted per request, and
 * five parallel uploads against a limit of five would all be told yes.
 */

type ItemState = 'queued' | 'reading' | 'uploading' | 'saving' | 'done' | 'failed'

interface QueueItem {
  key: string
  file: File
  state: ItemState
  /** 0–100, coarse: storage gives no progress events for a signed PUT. */
  progress: number
  error?: string
}

interface UploadMeta {
  width: number | null
  height: number | null
  takenAt: string | null
  exifLat: number | null
  exifLng: number | null
}

/** Dimensions from the decoded image, EXIF from the file's own metadata. */
async function readMeta(file: File): Promise<UploadMeta> {
  const meta: UploadMeta = {
    width: null,
    height: null,
    takenAt: null,
    exifLat: null,
    exifLng: null,
  }

  try {
    const bitmap = await createImageBitmap(file)
    meta.width = bitmap.width
    meta.height = bitmap.height
    bitmap.close()
  } catch {
    // HEIC and friends may not decode in every browser. The photo is still
    // storable; it just has no dimensions until a derivative pipeline exists.
  }

  try {
    // Loaded on demand: exifr is dead weight in the bundle for anyone who never
    // opens the vault.
    const exifr = (await import('exifr')).default
    const parsed = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'],
    })

    const taken = parsed?.DateTimeOriginal ?? parsed?.CreateDate
    if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
      meta.takenAt = taken.toISOString()
    }
    if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
      meta.exifLat = parsed.latitude
      meta.exifLng = parsed.longitude
    }
  } catch {
    // No EXIF, or an unreadable block. Neither is a reason to refuse the photo.
  }

  return meta
}

export function PhotoUploader({
  tripId,
  photosUsed,
  photosLimit,
}: {
  tripId: string
  photosUsed: number
  photosLimit: number | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<QueueItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null)
  const busy = useRef(false)

  const patch = useCallback((key: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...next } : item)))
  }, [])

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      const supabase = createClient()

      patch(item.key, { state: 'reading', progress: 5 })
      const meta = await readMeta(item.file)

      // 1. Ask the server for permission and a place to put it.
      patch(item.key, { state: 'uploading', progress: 15 })
      const signResponse = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripId, mime: item.file.type, bytes: item.file.size }),
      })

      const signed = await signResponse.json().catch(() => null)

      if (!signResponse.ok) {
        const message = signed?.error ?? 'Could not start that upload.'
        if (signResponse.status === 402) setQuotaMessage(message)
        patch(item.key, { state: 'failed', error: message, progress: 100 })
        return
      }

      // 2. Straight to storage. Nothing routes through the app server.
      const { error: uploadError } = await supabase.storage
        .from('media')
        .uploadToSignedUrl(signed.path, signed.token, item.file, {
          contentType: item.file.type,
        })

      if (uploadError) {
        patch(item.key, {
          state: 'failed',
          error: `Upload failed: ${uploadError.message}`,
          progress: 100,
        })
        return
      }

      // 3. Tell the server it landed, so it can verify and record it.
      patch(item.key, { state: 'saving', progress: 85 })
      const result = await confirmUpload({
        mediaId: signed.mediaId,
        tripId,
        mime: item.file.type,
        width: meta.width,
        height: meta.height,
        takenAt: meta.takenAt,
        exifLat: meta.exifLat,
        exifLng: meta.exifLng,
      })

      if (!result.ok) {
        patch(item.key, { state: 'failed', error: result.error, progress: 100 })
        return
      }

      patch(item.key, { state: 'done', progress: 100 })
    },
    [patch, tripId]
  )

  const enqueue = useCallback(
    async (files: File[]) => {
      if (!files.length) return

      const queued: QueueItem[] = files.map((file) => {
        const rejection = rejectionFor(file)
        return {
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          file,
          state: rejection ? 'failed' : 'queued',
          progress: rejection ? 100 : 0,
          error: rejection ?? undefined,
        }
      })

      setItems((prev) => [...prev, ...queued])

      if (busy.current) return
      busy.current = true

      try {
        for (const item of queued) {
          if (item.state === 'failed') continue
          await uploadOne(item)
        }
      } finally {
        busy.current = false
        // One refresh at the end rather than per file: each one re-renders the
        // whole gallery and re-signs every URL.
        router.refresh()
      }
    },
    [router, uploadOne]
  )

  const atLimit = photosLimit !== null && photosUsed >= photosLimit
  const active = items.some((i) => ['queued', 'reading', 'uploading', 'saving'].includes(i.state))

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void enqueue(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors',
          dragging ? 'border-primary bg-accent' : 'border-border',
          atLimit && 'opacity-60'
        )}
      >
        <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop photos here</p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, AVIF or HEIC · up to 25 MB each
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void enqueue(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={active}
          onClick={() => inputRef.current?.click()}
        >
          {active ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {active ? 'Uploading…' : 'Choose photos'}
        </Button>
      </div>

      {/* The upgrade card, shown at the moment of maximum motivation rather than
          as a modal wall — the plan's rule for every quota. */}
      {quotaMessage && (
        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">You have used every photo on this trip</p>
          <p className="text-sm text-muted-foreground">{quotaMessage}</p>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/settings" />}
          >
            See plans
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {item.file.name}
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {formatBytes(item.file.size)}
                </span>
              </span>

              {item.state === 'failed' ? (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                  {item.error}
                </span>
              ) : item.state === 'done' ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="size-3.5" aria-hidden />
                  Added
                </span>
              ) : (
                <Progress value={item.progress} className="w-28" />
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Dismiss ${item.file.name}`}
                onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
