import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getBudget } from '@/server/queries/budget'
import { BudgetView } from '@/client/components/budget/budget-view'
import { Button } from '@/client/components/ui/button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/trips/[id]/budget'>): Promise<Metadata> {
  const { id } = await params
  const budget = await getBudget(id)
  return { title: budget ? `${budget.tripTitle} · Budget` : 'Trip not found' }
}

export default async function BudgetPage({ params }: PageProps<'/trips/[id]/budget'>) {
  const { id } = await params
  const budget = await getBudget(id)

  // Owner only. `expenses` is owner-only by policy — no collaborator clause at
  // all — and `getBudget()` turns that into a 404 for everybody else, because
  // the planned figure this screen also shows rides on the trip row and RLS
  // hands that to collaborators.
  if (!budget) notFound()

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
          {budget.tripTitle}
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground">
          What this trip was meant to cost, and what it actually did. This screen is yours alone —
          collaborators see the budget you set, because it is part of the plan, but never what you
          spent against it, and no trip page publishes either.
        </p>
      </header>

      <BudgetView budget={budget} />
    </div>
  )
}
