import { z } from 'zod'
import { ITINERARY_KINDS, ITINERARY_STATUSES } from '@/shared/itinerary'

/**
 * A day and an entry on it, on the way in — screen 21.
 *
 * Almost everything is optional, because a plan is written in the order it is
 * thought of: "Kyoto, somewhere for ramen" is a real itinerary entry and
 * insisting on a time or a price would turn a planning tool into a form.
 */

/** Matches the `numeric(12, 2)` column: enough for any booking, never rounded. */
const MAX_COST = 9_999_999_999

/** `HH:MM`, which is what `<input type="time">` submits. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Standalone, because `itineraryItemSchema` carries a `.refine()` and a refined
 * object does not expose `.shape` to reach back into. The one-click status
 * toggle validates against this directly.
 */
export const itineraryStatusSchema = z.enum(ITINERARY_STATUSES)

const optionalTime = z
  .string()
  .trim()
  .regex(TIME, { error: 'Use a time like 14:30' })
  .nullable()
  .default(null)
  // An untouched time input submits an empty string; that is "not set", not invalid.
  .or(z.literal('').transform(() => null))

export const itineraryDaySchema = z.object({
  /** Present when editing; absent when adding. */
  id: z.uuid().nullish(),
  tripId: z.uuid({ error: 'Which trip is this?' }),
  /** Null for a trip with no dates. `Day 3` is still a day. */
  dayDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use a date like 2026-03-04' })
    .nullable()
    .default(null)
    .or(z.literal('').transform(() => null)),
  title: z.string().trim().max(120, { error: 'Keep the title under 120 characters' }).default(''),
  notes: z.string().trim().max(2000, { error: 'Keep the notes under 2000 characters' }).default(''),
})

export const itineraryItemSchema = z
  .object({
    id: z.uuid().nullish(),
    dayId: z.uuid({ error: 'Which day is this on?' }),
    kind: z.enum(ITINERARY_KINDS).default('activity'),
    // The one thing an entry cannot do without: a plan you cannot read back is
    // not a plan.
    title: z
      .string()
      .trim()
      .min(1, { error: 'Give it a name' })
      .max(160, { error: 'Keep the name under 160 characters' }),
    notes: z
      .string()
      .trim()
      .max(2000, { error: 'Keep the notes under 2000 characters' })
      .default(''),
    timeStart: optionalTime,
    timeEnd: optionalTime,
    cost: z
      .number()
      .nonnegative({ error: 'A cost cannot be negative' })
      .max(MAX_COST, { error: 'That cost is larger than the column can hold' })
      .nullable()
      .default(null),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .length(3, { error: 'Use a three-letter currency code, like INR' })
      .default('INR'),
    bookingRef: z
      .string()
      .trim()
      .max(120, { error: 'Keep the reference under 120 characters' })
      .default(''),
    url: z
      .union([z.literal(''), z.url({ error: 'That does not look like a link' })])
      .default('')
      .refine((value) => value === '' || /^https?:/i.test(value), {
        // A `javascript:` URL stored here would be rendered as an anchor on a
        // page the author trusts. The database cannot check this; the form can.
        error: 'Links must start with http:// or https://',
      }),
    status: itineraryStatusSchema.default('planned'),
  })
  .refine((v) => v.timeStart === null || v.timeEnd === null || v.timeEnd >= v.timeStart, {
    error: 'The end time is before the start',
    path: ['timeEnd'],
  })

export type ItineraryDayValues = z.output<typeof itineraryDaySchema>
export type ItineraryItemValues = z.output<typeof itineraryItemSchema>
