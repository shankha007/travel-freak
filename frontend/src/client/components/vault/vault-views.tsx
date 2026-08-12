'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Camera, Images, MapPin, MapPinned, Quote, Sparkles, Star, Trash2 } from 'lucide-react'
import { deleteMemory } from '@/server/actions/media'
import type { VaultMemory, VaultPhoto } from '@/server/queries/vault'
import { PhotoDetailDialog } from '@/client/components/vault/photo-detail-dialog'
import { MemoryComposer } from '@/client/components/vault/memory-composer'
import { Button } from '@/client/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import { cn } from '@/shared/utils'

/**
 * The vault's three views — Timeline, Gallery, Map.
 *
 * Timeline is the default because it is the one that reads like a trip: photos
 * and notes interleaved in the order they happened, which is what the plan
 * means by memories rather than files.
 */

const MEMORY_ICON: Record<string, typeof Quote> = {
  quote: Quote,
  favorite_location: MapPin,
  photo: Camera,
  note: Sparkles,
}

type TimelineEntry =
  | { kind: 'photo'; at: string | null; photo: VaultPhoto }
  | { kind: 'memory'; at: string | null; memory: VaultMemory }

function formatDay(iso: string | null): string {
  if (!iso) return 'Undated'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Photos and notes in one chronological list, grouped by day. */
function buildTimeline(photos: VaultPhoto[], memories: VaultMemory[]) {
  const entries: TimelineEntry[] = [
    ...photos.map((photo) => ({
      kind: 'photo' as const,
      at: photo.takenAt ?? photo.createdAt,
      photo,
    })),
    ...memories.map((memory) => ({
      kind: 'memory' as const,
      at: memory.happenedAt ?? memory.createdAt,
      memory,
    })),
  ]

  entries.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))

  const days = new Map<string, TimelineEntry[]>()
  for (const entry of entries) {
    const day = entry.at ? entry.at.slice(0, 10) : 'undated'
    days.set(day, [...(days.get(day) ?? []), entry])
  }

  return [...days.entries()]
}

export function VaultViews({
  photos,
  memories,
  tripId,
}: {
  photos: VaultPhoto[]
  memories: VaultMemory[]
  tripId: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<VaultPhoto | null>(null)
  const timeline = buildTimeline(photos, memories)
  const located = photos.filter((p) => p.hasLocation).length

  async function removeMemory(id: string) {
    await deleteMemory(id)
    router.refresh()
  }

  return (
    <>
      <Tabs defaultValue="timeline" className="gap-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="gallery">
            Gallery
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
              {photos.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <MemoryComposer tripId={tripId} />

          {timeline.length === 0 ? (
            <EmptyState message="Nothing here yet. Photos and notes appear in the order they happened." />
          ) : (
            <ol className="space-y-6">
              {timeline.map(([day, entries]) => (
                <li key={day} className="space-y-3">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {formatDay(entries[0].at)}
                  </h3>

                  <ul className="space-y-3 border-l pl-5">
                    {entries.map((entry) =>
                      entry.kind === 'photo' ? (
                        <li key={entry.photo.id} className="relative">
                          <Dot />
                          <button
                            type="button"
                            onClick={() => setSelected(entry.photo)}
                            className="group flex items-center gap-3 text-left"
                          >
                            <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                              {entry.photo.url && (
                                <Image
                                  src={entry.photo.url}
                                  alt={entry.photo.altText || 'Trip photo'}
                                  fill
                                  sizes="64px"
                                  className="object-cover transition-transform group-hover:scale-105"
                                />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm">
                                {entry.photo.caption || 'Photo'}
                              </span>
                              {entry.photo.isFeatured && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Star className="size-3 fill-current" aria-hidden />
                                  Cover photo
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ) : (
                        <li key={entry.memory.id} className="group relative">
                          <Dot />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm">{entry.memory.body}</p>
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {(() => {
                                  const Icon = MEMORY_ICON[entry.memory.kind] ?? Sparkles
                                  return <Icon className="size-3" aria-hidden />
                                })()}
                                <span className="capitalize">
                                  {entry.memory.kind.replace('_', ' ')}
                                </span>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete note"
                              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                              onClick={() => void removeMemory(entry.memory.id)}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </Button>
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        {/* -------------------------------------------------------- gallery */}
        <TabsContent value="gallery">
          {photos.length === 0 ? (
            <EmptyState message="No photos yet. Drop a few in above." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(photo)}
                    className={cn(
                      'group relative block aspect-square w-full overflow-hidden rounded-lg bg-muted',
                      'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
                    )}
                  >
                    {photo.url && (
                      <Image
                        src={photo.url}
                        alt={photo.altText || photo.caption || 'Trip photo'}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    )}

                    {photo.isFeatured && (
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 p-1">
                        <Star className="size-3 fill-current" aria-hidden />
                        <span className="sr-only">Cover photo</span>
                      </span>
                    )}

                    {photo.caption && (
                      <span className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs text-white">
                        {photo.caption}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------ map */}
        <TabsContent value="map">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <MapPinned className="size-6 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium">The map view is waiting on coordinates</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {located > 0
                  ? `${located} of these photos carry GPS from your camera. Places on this trip have no coordinates yet, so there is nothing to plot them against — that lands with the world map screen.`
                  : 'Places on this trip are country and city only. Coordinates arrive with the world map screen and its picker.'}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Keyed so opening a different photo remounts the dialog with that
          photo's caption and alt text, instead of syncing props into state. */}
      {selected && (
        <PhotoDetailDialog key={selected.id} photo={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

function Dot() {
  return (
    <span
      className="absolute top-2 -left-[23px] size-2 rounded-full bg-primary ring-4 ring-background"
      aria-hidden
    />
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Images className="size-6 text-muted-foreground" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
