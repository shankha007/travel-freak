/**
 * What a collaborator is allowed to do — screen 24.
 *
 * Pure, and tested, because this is a permissions table and the cost of getting
 * it wrong is somebody reading or changing a thing that is not theirs. Nothing
 * here *enforces* anything: RLS does that, in `20260807000100_init.sql` and
 * `20260815000200_collaborators.sql`. This is the description the interface
 * renders from, and the test below is what keeps the description honest — a
 * screen that promises a viewer cannot edit, while the policy allows it, is
 * worse than a screen that says nothing.
 *
 * **`owner` is not a value this app ever writes.** The owner of a trip is
 * `trips.user_id`; the enum carries `owner` because it was declared that way,
 * and a check constraint now forbids the row. It appears here only so a row
 * that somehow holds it renders as something rather than as a blank.
 */

/** The roles an invitation can carry. */
export const INVITABLE_ROLES = ['editor', 'viewer'] as const

export type InvitableRole = (typeof INVITABLE_ROLES)[number]

/** Every role the enum can hold, including the one nothing writes. */
export const COLLABORATOR_ROLES = ['owner', 'editor', 'viewer'] as const

export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number]

export const ROLE_LABEL: Record<CollaboratorRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

/** One line each, shown next to the role when it is being chosen. */
export const ROLE_SUMMARY: Record<CollaboratorRole, string> = {
  owner: 'Created the trip. Can do everything, including delete it.',
  editor: 'Can change the trip, its places, photos, memories and plan.',
  viewer: 'Can see the trip and its plan. Changes nothing.',
}

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value)
}

export function roleLabel(value: string): string {
  return value in ROLE_LABEL ? ROLE_LABEL[value as CollaboratorRole] : value
}

/**
 * The things a role can and cannot do, as the screen states them.
 *
 * `can` and `cannot` are both listed because the second is the half people
 * actually need before handing someone access, and an interface that only
 * enumerates permissions leaves the reader to infer the boundary.
 */
export interface RoleCapabilities {
  can: readonly string[]
  cannot: readonly string[]
}

/**
 * The line these draw, precisely.
 *
 * "They cannot see the budget" is the obvious thing to write here and it is not
 * true. Two different numbers are involved and only one of them is private:
 *
 *   `trips.budget_planned`  a column on the trip row, which RLS hands to any
 *                           collaborator along with the title and the dates.
 *                           It is part of the shared plan.
 *   `expenses`              one policy, `user_id = auth.uid()`, no collaborator
 *                           clause at all. What was actually spent is the
 *                           owner's alone, and `/budget` 404s for anyone else.
 *
 * The wording below says which is which, because the earlier draft claimed no
 * role could see the budget while the trip page next to it displayed the
 * planned figure to exactly those roles.
 */
export const ROLE_CAPABILITIES: Record<InvitableRole, RoleCapabilities> = {
  editor: {
    can: [
      'See the trip, its route and its photographs',
      'See what the trip is budgeted to cost',
      'Edit the trip and its places',
      'Add photos, notes and memories',
      'Build the itinerary and the packing lists',
    ],
    cannot: [
      'See what it actually cost — the expenses stay with the owner',
      'Invite or remove anybody',
      'Delete the trip',
      'Publish it or create a share link',
    ],
  },
  viewer: {
    can: [
      'See the trip, its route and its photographs',
      'See what the trip is budgeted to cost',
      'Read the itinerary and the packing lists',
    ],
    cannot: [
      'Change anything at all',
      'See what it actually cost — the expenses stay with the owner',
      'Invite or remove anybody',
      'Delete the trip',
    ],
  },
}

/**
 * Whether a role may write to the trip.
 *
 * Mirrors `can_edit_trip()`, which is the thing that actually decides. Used to
 * label the interface, never to gate a write.
 */
export function roleCanEdit(role: string): boolean {
  return role === 'editor' || role === 'owner'
}

/**
 * The state one row of the collaborator list is in.
 *
 * Derived rather than stored: `accepted_at` and `declined_at` are the columns,
 * and a check constraint keeps them from both being set. Three states beat two
 * booleans on a screen where "invited" and "declined" call for entirely
 * different copy and different buttons.
 */
export type InviteState = 'pending' | 'accepted' | 'declined'

export function inviteState(row: {
  acceptedAt: string | null
  declinedAt: string | null
}): InviteState {
  if (row.acceptedAt !== null) return 'accepted'
  if (row.declinedAt !== null) return 'declined'
  return 'pending'
}

export const INVITE_STATE_LABEL: Record<InviteState, string> = {
  pending: 'Invited',
  accepted: 'On the trip',
  declined: 'Declined',
}

/**
 * How somebody is named before they have an account.
 *
 * An invitation by address is the common case — you invite the person you
 * travelled with, not their username — so for most of a row's life there is no
 * profile to read a name from and the address is the only identity there is.
 */
export function collaboratorName(row: {
  displayName: string | null
  username: string | null
  invitedEmail: string | null
}): string {
  const named = row.displayName?.trim()
  if (named) return named
  if (row.username) return row.username
  return row.invitedEmail ?? 'Someone'
}
