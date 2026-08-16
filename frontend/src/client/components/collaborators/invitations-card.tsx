'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, MailOpen, X } from 'lucide-react'
import { acceptInvitation, declineInvitation } from '@/server/actions/collaborators'
import type { Invitation } from '@/server/queries/collaborators'
import { ROLE_SUMMARY, roleLabel, type CollaboratorRole } from '@/shared/collaborators'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Invitations waiting for you — the other side of screen 24.
 *
 * Shown on `/trips`, because that is where the trip will appear once it is
 * accepted and the invitation is a trip that is not there yet.
 *
 * The role is spelled out before the decision rather than after it. Accepting
 * grants somebody else's trip a place in your account, and "Editor" on its own
 * does not tell you what you would be agreeing to.
 */
export function InvitationsCard({ invitations }: { invitations: Invitation[] }) {
  if (invitations.length === 0) return null

  return (
    <section aria-label="Invitations" className="space-y-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <MailOpen className="size-4 text-muted-foreground" aria-hidden />
          {invitations.length === 1
            ? 'You have been invited to a trip'
            : `You have been invited to ${invitations.length} trips`}
        </h2>
      </div>

      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <li key={invitation.tripId}>
            <InvitationRow invitation={invitation} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const router = useRouter()
  const [acceptState, acceptAction] = useActionState(acceptInvitation, EMPTY_FORM_STATE)
  const [declineState, declineAction] = useActionState(declineInvitation, EMPTY_FORM_STATE)

  useEffect(() => {
    if (acceptState.saved || declineState.saved) router.refresh()
  }, [acceptState, declineState, router])

  const error = acceptState.error ?? declineState.error

  // "as a editor" — the roles are Editor and Viewer today, and the article has
  // to agree with whichever word is there rather than with the two we happen to
  // ship. Computed from the label, so a third role cannot reintroduce this.
  const role = roleLabel(invitation.role).toLowerCase()
  const article = /^[aeiou]/.test(role) ? 'an' : 'a'

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{invitation.tripTitle}</p>
            <p className="text-sm text-muted-foreground">
              {invitation.inviterName} invited you as {article}{' '}
              <strong className="font-medium">{role}</strong>.{' '}
              {ROLE_SUMMARY[invitation.role as CollaboratorRole] ?? ''}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <form action={declineAction}>
              <input type="hidden" name="tripId" value={invitation.tripId} />
              <DeclineButton />
            </form>
            <form action={acceptAction}>
              <input type="hidden" name="tripId" value={invitation.tripId} />
              <AcceptButton />
            </form>
          </div>
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
      </CardContent>
    </Card>
  )
}

function AcceptButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Check className="size-3.5" aria-hidden />
      )}
      Accept
    </Button>
  )
}

function DeclineButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" variant="ghost" disabled={pending}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <X className="size-3.5" aria-hidden />
      )}
      Decline
    </Button>
  )
}
