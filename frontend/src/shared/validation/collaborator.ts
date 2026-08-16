import { z } from 'zod'
import { INVITABLE_ROLES } from '@/shared/collaborators'

/**
 * An invitation, on the way in — screen 24.
 *
 * An address and a role, and that is the whole form. You invite the person you
 * travelled with, and at the moment you invite them you know their email and
 * nothing else — asking for a username would mean asking them for it first,
 * which is the thing the invitation was supposed to do.
 *
 * The address is lower-cased here as well as being stored in a `citext` column.
 * Both matter: the column makes the comparison case-insensitive, and this makes
 * what is displayed back to the owner match what they will see in their own
 * mail client.
 */

export const inviteSchema = z.object({
  tripId: z.uuid({ error: 'Which trip is this?' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: 'Who are you inviting?' })
    .max(254, { error: 'That address is longer than an address can be' })
    .pipe(z.email({ error: 'That does not look like an email address' })),
  role: z.enum(INVITABLE_ROLES, { error: 'Pick what they can do' }).default('viewer'),
})

/** Changing somebody's role, or removing them. Both name a row, not an address. */
export const collaboratorRowSchema = z.object({
  id: z.uuid({ error: 'Which person?' }),
  tripId: z.uuid({ error: 'Which trip is this?' }),
})

export const changeRoleSchema = collaboratorRowSchema.extend({
  role: z.enum(INVITABLE_ROLES, { error: 'Pick what they can do' }),
})

export type InviteValues = z.output<typeof inviteSchema>
export type ChangeRoleValues = z.output<typeof changeRoleSchema>
