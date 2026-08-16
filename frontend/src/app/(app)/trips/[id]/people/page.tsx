import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTripPeople } from '@/server/queries/collaborators'
import { PeopleBoard } from '@/client/components/collaborators/people-board'
import { Button } from '@/client/components/ui/button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/trips/[id]/people'>): Promise<Metadata> {
  const { id } = await params
  const people = await getTripPeople(id)
  return { title: people ? `${people.tripTitle} · People` : 'Trip not found' }
}

export default async function PeoplePage({ params }: PageProps<'/trips/[id]/people'>) {
  const { id } = await params
  const people = await getTripPeople(id)

  if (!people) notFound()

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
          {people.tripTitle}
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-muted-foreground">
          {people.isOwner
            ? 'Who can see this trip and help plan it. They see what it is budgeted to cost, because that is part of the plan — what you actually spent stays with you.'
            : 'Who else is on this trip. Only the owner can invite or remove anybody.'}
        </p>
      </header>

      <PeopleBoard people={people} />
    </div>
  )
}
