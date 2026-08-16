import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { checkCollaboratorQuota, type QuotaCheck } from '@/server/entitlements'
import { getPlannerTrip } from '@/server/queries/planner'
import { inviteState, type CollaboratorRole, type InviteState } from '@/shared/collaborators'

/**
 * Who is on a trip, and who has been asked — screen 24.
 *
 * Two audiences, and they are not the same read.
 *
 * `getTripPeople()` is the owner's list. It shows every row including the ones
 * that were declined, because "I invited them and they said no" is an answer
 * and a screen that silently drops it invites the owner to send the invitation
 * again.
 *
 * `getMyInvitations()` is the other side, and it cannot be a table read at all:
 * a pending invitee is not yet a collaborator, so `trips_select_collaborator`
 * hides the trip and they would be looking at an invitation to something with
 * no title. `list_my_invitations()` — security definer, added in
 * `20260815000200` — returns the few facts the screen needs and nothing else
 * about a trip they have not agreed to see.
 */

export interface TripPerson {
  id: string
  userId: string | null
  invitedEmail: string | null
  role: CollaboratorRole
  state: InviteState
  invitedAt: string
  acceptedAt: string | null
  declinedAt: string | null
  /** From the profile, once there is an account behind the row. */
  displayName: string | null
  username: string | null
  avatarUrl: string | null
}

export interface TripPeople {
  tripId: string
  tripTitle: string
  /** True when the caller owns the trip — only an owner may invite or remove. */
  isOwner: boolean
  people: TripPerson[]
  /** Whether another person may be invited, and why not when they may not. */
  quota: QuotaCheck
}

export async function getTripPeople(tripId: string): Promise<TripPeople | null> {
  const trip = await getPlannerTrip(tripId)
  if (!trip) return null

  const supabase = await createClient()
  const user = await requireUser()

  // Whose trip this is decides what the screen offers, so it is asked directly
  // rather than inferred from whether any rows came back.
  const { data: owned } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  const isOwner = owned !== null

  const [{ data: rows }, quota] = await Promise.all([
    supabase
      .from('trip_collaborators')
      .select('id, user_id, invited_email, role, accepted_at, declined_at, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true }),
    // Only meaningful for an owner; a collaborator is shown the list without
    // the controls, so the count is not used.
    isOwner
      ? checkCollaboratorQuota(tripId)
      : Promise.resolve<QuotaCheck>({ allowed: false, used: 0, limit: 0 }),
  ])

  const collaboratorRows = rows ?? []

  // Profiles for the rows that have an account behind them. One read rather
  // than one per person, and skipped entirely for a trip whose invitations are
  // all still outstanding.
  const userIds = collaboratorRows.map((r) => r.user_id).filter((id): id is string => id !== null)

  const { data: profiles } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds)
    : { data: [] }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  return {
    tripId: trip.id,
    tripTitle: trip.title,
    isOwner,
    quota,
    people: collaboratorRows.map((row) => {
      const profile = row.user_id ? profileById.get(row.user_id) : undefined
      return {
        id: row.id,
        userId: row.user_id,
        invitedEmail: row.invited_email,
        role: row.role,
        state: inviteState({ acceptedAt: row.accepted_at, declinedAt: row.declined_at }),
        invitedAt: row.created_at,
        acceptedAt: row.accepted_at,
        declinedAt: row.declined_at,
        displayName: profile?.display_name ?? null,
        username: profile?.username ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      }
    }),
  }
}

export interface Invitation {
  tripId: string
  tripTitle: string
  role: CollaboratorRole
  invitedAt: string
  inviterName: string
  inviterUsername: string | null
}

/** The invitations waiting for the signed-in user, newest first. */
export async function getMyInvitations(): Promise<Invitation[]> {
  const supabase = await createClient()
  await requireUser()

  const { data } = await supabase.rpc('list_my_invitations')

  return (data ?? []).map((row) => ({
    tripId: row.trip_id,
    tripTitle: row.trip_title,
    role: row.role,
    invitedAt: row.invited_at,
    inviterName: row.inviter_name ?? 'Someone',
    inviterUsername: row.inviter_username ?? null,
  }))
}
