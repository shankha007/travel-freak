import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getPacking } from '@/server/queries/packing'
import { PackingBoard } from '@/client/components/packing/packing-board'
import { Button } from '@/client/components/ui/button'
import { Progress } from '@/client/components/ui/progress'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/trips/[id]/packing'>): Promise<Metadata> {
  const { id } = await params
  const packing = await getPacking(id)
  return { title: packing ? `${packing.tripTitle} · Packing` : 'Trip not found' }
}

export default async function PackingPage({ params }: PageProps<'/trips/[id]/packing'>) {
  const { id } = await params
  const packing = await getPacking(id)

  if (!packing) notFound()

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
          {packing.tripTitle}
        </Button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Packing</h1>
          <p className="text-sm text-muted-foreground">
            What goes in the bag, and what has to happen before you leave.
          </p>
        </div>

        {packing.overall.total > 0 && (
          <div className="w-full max-w-56 space-y-1">
            <p className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ready</span>
              <span className="tabular-nums">
                {packing.overall.done} / {packing.overall.total}
              </span>
            </p>
            <Progress value={packing.overall.percent} />
          </div>
        )}
      </header>

      <PackingBoard packing={packing} />
    </div>
  )
}
