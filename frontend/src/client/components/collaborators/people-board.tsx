'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  changeCollaboratorRole,
  inviteCollaborator,
  leaveTrip,
  removeCollaborator,
} from '@/server/actions/collaborators'
import type { TripPeople, TripPerson } from '@/server/queries/collaborators'
import {
  INVITABLE_ROLES,
  INVITE_STATE_LABEL,
  ROLE_CAPABILITIES,
  ROLE_LABEL,
  ROLE_SUMMARY,
  collaboratorName,
  roleLabel,
} from '@/shared/collaborators'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { useActionToast } from '@/client/hooks/use-action-toast'
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
import { Label } from '@/client/components/ui/label'

/**
 * Who is on a trip — screen 24.
 *
 * The screen is two different screens depending on who is looking. An owner
 * gets the invite form and the controls; a collaborator gets the same list
 * read-only plus the one thing that is theirs to decide, which is whether to
 * stay. That is not a cosmetic difference — `collaborators_manage_owner` is
 * keyed on owning the trip, so the controls an owner sees are exactly the ones
 * the database would let them use.
 */

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  accepted: 'default',
  pending: 'outline',
  declined: 'secondary',
}

export function PeopleBoard({ people: data }: { people: TripPeople }) {
  const [removing, setRemoving] = useState<TripPerson | null>(null)
  const [leaving, setLeaving] = useState(false)

  const onTrip = data.people.filter((p) => p.state === 'accepted')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            {onTrip.length === 0
              ? 'Nobody else is on this trip.'
              : `${onTrip.length} ${
                  onTrip.length === 1 ? 'person' : 'people'
                } on this trip, besides you.`}
          </p>
          {data.isOwner && data.quota.limit !== null && data.quota.limit > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {data.quota.used} of {data.quota.limit} on this trip
            </p>
          )}
        </div>

        {!data.isOwner && (
          <Button variant="outline" onClick={() => setLeaving(true)}>
            <LogOut className="size-4" aria-hidden />
            Leave this trip
          </Button>
        )}
      </div>

      {data.isOwner && <InviteForm tripId={data.tripId} quota={data.quota} />}

      {data.people.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Users className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Plan it together</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Invite the people you are travelling with and they can see the trip and help build the
              itinerary. What you actually spent stays with you — the expenses are yours alone.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.people.map((person) => (
            <li key={person.id}>
              <PersonRow
                person={person}
                tripId={data.tripId}
                isOwner={data.isOwner}
                onRemove={() => setRemoving(person)}
              />
            </li>
          ))}
        </ul>
      )}

      <RoleReference />

      <RemovePersonDialog
        person={removing}
        tripId={data.tripId}
        onClose={() => setRemoving(null)}
      />

      <LeaveDialog
        tripId={data.tripId}
        tripTitle={data.tripTitle}
        open={leaving}
        onOpenChange={setLeaving}
      />
    </div>
  )
}

function PersonRow({
  person,
  tripId,
  isOwner,
  onRemove,
}: {
  person: TripPerson
  tripId: string
  isOwner: boolean
  onRemove: () => void
}) {
  const name = collaboratorName(person)

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{name}</span>
            <Badge variant={STATE_VARIANT[person.state] ?? 'outline'}>
              {INVITE_STATE_LABEL[person.state]}
            </Badge>
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {/* The address is shown next to a resolved name too: it is how the
                owner knows which of two people called Sam this is. */}
            {person.username ? `@${person.username}` : null}
            {person.username && person.invitedEmail ? ' · ' : null}
            {person.invitedEmail}
            {!person.username && !person.invitedEmail ? 'Invited directly' : null}
          </p>
        </div>

        {isOwner && person.state !== 'declined' ? (
          <RolePicker person={person} tripId={tripId} />
        ) : (
          <Badge variant="outline">{roleLabel(person.role)}</Badge>
        )}

        {isOwner && (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={onRemove}>
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Changing what somebody can do, in one gesture.
 *
 * A select that submits on change, like the itinerary's status picker. Two
 * roles would fit two buttons, but the label of a button has to describe the
 * state it moves to while showing the state you are in, and a select shows both.
 */
function RolePicker({ person, tripId }: { person: TripPerson; tripId: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(changeCollaboratorRole, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'Role changed.' })

  useEffect(() => {
    if (state.saved) router.refresh()
  }, [state, router])

  const name = collaboratorName(person)

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={person.id} />
      <input type="hidden" name="tripId" value={tripId} />
      <select
        name="role"
        defaultValue={person.role}
        aria-label={`What ${name} can do`}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {INVITABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]}
          </option>
        ))}
      </select>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}

function InviteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : disabled ? (
        <Lock className="size-4" aria-hidden />
      ) : (
        <UserPlus className="size-4" aria-hidden />
      )}
      Invite
    </Button>
  )
}

/**
 * The invite form.
 *
 * An address and a role. It stays on the screen when the plan does not allow
 * another invitation, disabled and with the reason next to it, rather than
 * disappearing — a control that vanishes teaches nobody what they would get by
 * upgrading.
 */
function InviteForm({ tripId, quota }: { tripId: string; quota: TripPeople['quota'] }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, formAction] = useActionState(inviteCollaborator, EMPTY_FORM_STATE)

  useEffect(() => {
    if (!state.saved) return
    formRef.current?.reset()
    inputRef.current?.focus()
    router.refresh()
  }, [state, router])

  const err = (field: string) => state.fieldErrors?.[field]
  const rejected = state.values

  return (
    <Card>
      <CardContent className="p-5">
        <form ref={formRef} action={formAction} className="space-y-3">
          <input type="hidden" name="tripId" value={tripId} />

          <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Their email</Label>
              <Input
                ref={inputRef}
                id="inviteEmail"
                name="email"
                type="email"
                defaultValue={rejected?.email ?? ''}
                placeholder="them@example.com"
                maxLength={254}
                required
                disabled={!quota.allowed}
                aria-describedby={err('email') ? 'invite-email-error' : undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteRole">What they can do</Label>
              <select
                key={rejected?.role ?? 'viewer'}
                id="inviteRole"
                name="role"
                defaultValue={rejected?.role ?? 'viewer'}
                disabled={!quota.allowed}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>

            <InviteButton disabled={!quota.allowed} />
          </div>

          {err('email') && (
            <p id="invite-email-error" role="alert" className="text-sm text-destructive">
              {err('email')}
            </p>
          )}

          {!quota.allowed && quota.reason && (
            <p className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {quota.reason}{' '}
                <Link href="/upgrade" className="underline underline-offset-2">
                  See the plans
                </Link>
                .
              </span>
            </p>
          )}

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          {/* Said plainly rather than discovered: there is no transactional
              email in this codebase yet, so an invitation is delivered by the
              app and not by the inbox. */}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            No email is sent yet. They will see the invitation on their own Trips screen when they
            next sign in with this address — so tell them it is waiting.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

/** What each role means, spelled out, including what it cannot do. */
function RoleReference() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">What the roles mean</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {INVITABLE_ROLES.map((role) => (
          <li key={role}>
            <Card className="h-full">
              <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                  <p className="font-medium">{ROLE_LABEL[role]}</p>
                  <p className="text-sm text-muted-foreground">{ROLE_SUMMARY[role]}</p>
                </div>

                {/* Two lists under two headings, not one list with two icons.
                    The tick and the cross are decorative and `aria-hidden`, so
                    a single list announces every line as a capability — "See
                    what the trip cost" read out as something an editor can do,
                    which is the exact opposite of what the row means. The
                    heading is what carries the negation to anyone who is not
                    looking at the icons. */}
                <div className="space-y-1">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Can
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {ROLE_CAPABILITIES[role].can.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Cannot
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {ROLE_CAPABILITIES[role].cannot.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <X className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ConfirmSubmit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? busy : label}
    </Button>
  )
}

function RemovePersonDialog({
  person,
  tripId,
  onClose,
}: {
  person: TripPerson | null
  tripId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(removeCollaborator, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'Removed from the trip.' })

  useEffect(() => {
    if (!state.saved) return
    onClose()
    router.refresh()
  }, [state, onClose, router])

  const name = person ? collaboratorName(person) : ''

  return (
    <Dialog open={person !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take {name} off this trip?</DialogTitle>
          <DialogDescription>
            {person?.state === 'pending'
              ? 'The invitation is withdrawn. If they open the app looking for it, it will not be there.'
              : 'They stop seeing the trip immediately. Anything they added — photos, notes, itinerary entries — belongs to the trip and stays.'}
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
          <input type="hidden" name="id" value={person?.id ?? ''} />
          <input type="hidden" name="tripId" value={tripId} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Keep them
            </Button>
            <ConfirmSubmit
              label={person?.state === 'pending' ? 'Withdraw it' : 'Remove them'}
              busy="Removing…"
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LeaveDialog({
  tripId,
  tripTitle,
  open,
  onOpenChange,
}: {
  tripId: string
  tripTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(leaveTrip, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'You have left the trip.' })

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    // Leaving means losing the trip, so there is nothing left to refresh into.
    router.push('/trips')
  }, [state, onOpenChange, router])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave {tripTitle}?</DialogTitle>
          <DialogDescription>
            It stops appearing in your trips and you will not be able to open it again unless the
            owner invites you back. Nothing you added to it is removed — it belongs to the trip.
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
          <input type="hidden" name="tripId" value={tripId} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Stay on it
            </Button>
            <ConfirmSubmit label="Leave it" busy="Leaving…" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
