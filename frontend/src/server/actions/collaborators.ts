'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { checkCollaboratorQuota } from '@/server/entitlements'
import {
  changeRoleSchema,
  collaboratorRowSchema,
  inviteSchema,
} from '@/shared/validation/collaborator'
import { fieldErrorsOf, textFields, type FormState } from '@/shared/validation/form-state'

/**
 * Collaborator writes — screen 24.
 *
 * Two halves with different rules, and the split is the point.
 *
 * **The owner's half** — invite, re-role, remove — writes `trip_collaborators`
 * directly, through `collaborators_manage_owner`, which is keyed on owning the
 * trip. Nothing here needs elevated access.
 *
 * **The invitee's half** — accept, decline, leave — cannot write the table at
 * all. `20260815000200` removed the invitee's UPDATE policy because a policy
 * cannot say "you may change this row but not its `role`", and the one it
 * replaced let a viewer promote itself to editor. So these three go through
 * security-definer functions that write only the columns they name.
 */

function repaint(tripId: string) {
  revalidatePath(`/trips/${tripId}/people`)
  revalidatePath(`/trips/${tripId}`)
  // A trip joined or left appears in or disappears from the list, and the
  // invitation banner lives there too.
  revalidatePath('/trips')
}

// ---------------------------------------------------------------------------
// The owner's half
// ---------------------------------------------------------------------------

export async function inviteCollaborator(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(formData, 'tripId', 'email', 'role')

  const parsed = inviteSchema.safeParse({ ...values, role: values.role || 'viewer' })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    }
  }

  const { tripId, email, role } = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  // Inviting yourself is the mistake this catches first, because it is the one
  // the database would answer with a constraint rather than a sentence.
  if (email === user.email.toLowerCase()) {
    return {
      error: 'That is your own address — the trip is already yours.',
      fieldErrors: { email: 'Invite somebody else' },
      values,
    }
  }

  // Only an owner invites. RLS enforces it; this turns a silent no-op into a
  // sentence, and stops an invitation being sent to a deleted trip.
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return { error: 'That trip is not here any more.', values }

  const quota = await checkCollaboratorQuota(tripId)
  if (!quota.allowed) {
    return { error: quota.reason ?? 'That is one person too many.', values }
  }

  const { error } = await supabase.from('trip_collaborators').insert({
    trip_id: tripId,
    invited_email: email,
    role,
    invited_by: user.id,
  })

  if (error) {
    // `trip_collaborators_unique_email` is one invitation per address per trip.
    // Inviting the same person twice is a normal mistake, not a failure.
    if (error.code === '23505') {
      return {
        error: `${email} has already been invited to this trip.`,
        fieldErrors: { email: 'Already invited' },
        values,
      }
    }
    return { error: 'Could not send that invitation. Please try again.', values }
  }

  repaint(tripId)
  return { error: null, saved: true }
}

export async function changeCollaboratorRole(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const values = textFields(formData, 'id', 'tripId', 'role')
  const parsed = changeRoleSchema.safeParse(values)

  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const { id, tripId, role } = parsed.data
  const supabase = await createClient()
  await requireUser()

  // `collaborators_manage_owner` is what permits this, so a non-owner's update
  // matches no row rather than being refused — hence the count check below.
  const { error, count } = await supabase
    .from('trip_collaborators')
    .update({ role }, { count: 'exact' })
    .eq('id', id)
    .eq('trip_id', tripId)

  if (error) return { error: 'Could not change that. Please try again.' }
  if (!count) return { error: 'That person is not on this trip any more.' }

  repaint(tripId)
  return { error: null, saved: true }
}

export async function removeCollaborator(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(formData, 'id', 'tripId')
  const parsed = collaboratorRowSchema.safeParse(values)

  if (!parsed.success) return { error: 'Nothing to remove.' }

  const { id, tripId } = parsed.data
  const supabase = await createClient()
  await requireUser()

  // Deleted rather than marked: a person taken off a trip has no standing row
  // to explain, and leaving one would keep them in a list they are not in.
  const { error } = await supabase
    .from('trip_collaborators')
    .delete()
    .eq('id', id)
    .eq('trip_id', tripId)

  if (error) return { error: 'Could not remove that person. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

// ---------------------------------------------------------------------------
// The invitee's half
//
// None of these writes the table. See the header.
// ---------------------------------------------------------------------------

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const { tripId } = textFields(formData, 'tripId')
  if (!tripId) return { error: 'Nothing to accept.' }

  const supabase = await createClient()
  await requireUser()

  const { data, error } = await supabase.rpc('accept_trip_invitation', { p_trip_id: tripId })

  if (error) return { error: 'Could not accept that invitation. Please try again.' }
  // The function answers false when there was nothing pending — withdrawn,
  // already answered, or the trip deleted underneath it.
  if (data !== true) return { error: 'That invitation is no longer open.' }

  repaint(tripId)
  return { error: null, saved: true }
}

export async function declineInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const { tripId } = textFields(formData, 'tripId')
  if (!tripId) return { error: 'Nothing to decline.' }

  const supabase = await createClient()
  await requireUser()

  const { data, error } = await supabase.rpc('decline_trip_invitation', { p_trip_id: tripId })

  if (error) return { error: 'Could not decline that invitation. Please try again.' }
  if (data !== true) return { error: 'That invitation is no longer open.' }

  repaint(tripId)
  return { error: null, saved: true }
}

/**
 * Leaving a trip somebody else owns.
 *
 * A delete rather than a decline, so the owner's list does not keep showing
 * somebody who is not there. Nothing on the trip is touched — photos, notes and
 * itinerary entries added while collaborating belong to the trip, not to the
 * person who has walked away from it.
 */
export async function leaveTrip(_prev: FormState, formData: FormData): Promise<FormState> {
  const { tripId } = textFields(formData, 'tripId')
  if (!tripId) return { error: 'Nothing to leave.' }

  const supabase = await createClient()
  await requireUser()

  const { data, error } = await supabase.rpc('leave_trip', { p_trip_id: tripId })

  if (error) return { error: 'Could not leave that trip. Please try again.' }
  if (data !== true) return { error: 'You are not on that trip.' }

  repaint(tripId)
  return { error: null, saved: true }
}
