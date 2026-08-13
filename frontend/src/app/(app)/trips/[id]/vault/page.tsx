import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, HardDrive } from 'lucide-react'
import { getVaultData } from '@/server/queries/vault'
import { formatBytes } from '@/shared/format'
import { PhotoUploader } from '@/client/components/vault/photo-uploader'
import { VaultViews } from '@/client/components/vault/vault-views'
import { Button } from '@/client/components/ui/button'
import { Progress } from '@/client/components/ui/progress'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/trips/[id]/vault'>): Promise<Metadata> {
  const { id } = await params
  const vault = await getVaultData(id)
  return { title: vault ? `${vault.tripTitle} · Vault` : 'Trip not found' }
}

export default async function VaultPage({ params }: PageProps<'/trips/[id]/vault'>) {
  const { id } = await params
  const vault = await getVaultData(id)

  // The vault is where you edit, so a public trip belonging to someone else is
  // a 404 here even though its photos are readable elsewhere.
  if (!vault) notFound()

  const { quota } = vault
  const photoPercent =
    quota.photosLimit === null
      ? 0
      : Math.min(100, Math.round((quota.photosUsed / quota.photosLimit) * 100))
  const storagePercent =
    quota.storageLimit === null
      ? 0
      : Math.min(100, Math.round((quota.storageUsed / quota.storageLimit) * 100))
  const photosLeft = quota.photosLimit === null ? null : quota.photosLimit - quota.photosUsed

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${id}`} />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {vault.tripTitle}
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Memory Vault</h1>
        <p className="text-sm text-muted-foreground">
          Photos and notes from this trip, in the order they happened.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <PhotoUploader
            tripId={vault.tripId}
            photosUsed={quota.photosUsed}
            photosLimit={quota.photosLimit}
          />

          <VaultViews
            photos={vault.photos}
            memories={vault.memories}
            places={vault.places}
            tripId={vault.tripId}
          />
        </div>

        {/* Quota meter. Both numbers are shown because both are real: the
            per-trip cap is what you hit first, the pool is the actual cost. */}
        <aside className="space-y-4 rounded-xl border p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Photos on this trip</span>
              <span className="text-muted-foreground tabular-nums">
                {quota.photosUsed}
                {quota.photosLimit === null ? '' : ` / ${quota.photosLimit}`}
              </span>
            </div>
            {quota.photosLimit !== null && <Progress value={photoPercent} />}
            {photosLeft !== null && (
              <p className="text-xs text-muted-foreground">
                {photosLeft <= 0
                  ? 'No photos left on this trip.'
                  : photosLeft === 1
                    ? '1 photo left on this trip.'
                    : `${photosLeft} photos left on this trip.`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="size-3.5" aria-hidden />
                Storage
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatBytes(quota.storageUsed)}
                {quota.storageLimit === null ? '' : ` / ${formatBytes(quota.storageLimit)}`}
              </span>
            </div>
            {quota.storageLimit !== null && <Progress value={storagePercent} />}
            <p className="text-xs text-muted-foreground">
              Shared across every trip. Deleting a photo frees its space straight away.
            </p>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Originals stay private. Photos are served over links that expire, and their location
              data is never published.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
