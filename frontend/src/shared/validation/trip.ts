import { z } from 'zod'
import { isKnownCountry } from '@/shared/geo/countries'

/**
 * Trip input schema, shared by the form and the Server Action.
 *
 * One definition means a hand-crafted POST faces exactly the checks the UI
 * performs. The client parse is for error messages; the server parse is the
 * one that matters.
 */

export const TRIP_TYPES = ['solo', 'couple', 'friends', 'family', 'business'] as const
export const TRIP_STATUSES = ['planning', 'upcoming', 'ongoing', 'completed'] as const
export const VISIBILITIES = ['private', 'unlisted', 'public'] as const

/** Empty string from an unfilled input means "not set", not an invalid date. */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), { error: 'Use the date picker' })
  .transform((v) => (v === '' ? null : v))

export const tripPlaceSchema = z
  .object({
    /**
     * Present only when editing. Rows are matched on it so an edit updates the
     * places that already exist rather than replacing them — memories are pinned
     * to `trip_place_id`, and a delete-and-reinsert would unpin every one.
     */
    id: z.uuid().optional(),
    countryCode: z
      .string()
      .trim()
      .length(3, { error: 'Pick a country' })
      .refine(isKnownCountry, { error: 'That is not a country code we recognise' }),
    /** ISO 3166-2, e.g. 'IN-KA'. Optional — country-level is a valid trip. */
    regionCode: z.string().trim().max(10).optional().default(''),
    cityName: z.string().trim().max(120).optional().default(''),
    /**
     * The pin, when the writer set one on the map.
     *
     * Optional on purpose: a country and a city name are still a valid place, and
     * demanding a coordinate would make logging an old trip harder than
     * remembering it. What coordinates unlock is distance travelled and the vault's
     * map — both of which simply stay unmeasured without them.
     */
    lng: z.number().min(-180).max(180).nullable().optional().default(null),
    lat: z.number().min(-90).max(90).nullable().optional().default(null),
  })
  // A single coordinate is a bug in whatever sent it, not half a location.
  .refine((p) => (p.lng === null) === (p.lat === null), {
    error: 'A pin needs both a latitude and a longitude',
    path: ['lat'],
  })

export const createTripSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: 'Give the trip a title' })
      .max(120, { error: 'Keep the title under 120 characters' }),
    summary: z.string().trim().max(500, { error: 'Keep the summary under 500 characters' }),
    tripType: z.enum(TRIP_TYPES).nullable(),
    travelerCount: z.coerce
      .number()
      .int()
      .min(1, { error: 'At least one traveller' })
      .max(50, { error: 'That is a tour group, not a trip' }),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(TRIP_STATUSES),
    visibility: z.enum(VISIBILITIES),
    budgetPlanned: z
      .string()
      .trim()
      .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        error: 'Budget must be a positive number',
      })
      .transform((v) => (v === '' ? null : Number(v))),
    currency: z.string().trim().length(3).default('INR'),
    places: z
      .array(tripPlaceSchema)
      .min(1, { error: 'Add at least one place — this is what fills in your globe' })
      .max(50, { error: 'That is a lot of places. Split it into separate trips.' }),
  })
  // Mirrors the trips_date_order constraint, so the user sees a field error
  // rather than a database exception.
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    error: 'The end date cannot be before the start date',
    path: ['endDate'],
  })

export type CreateTripInput = z.input<typeof createTripSchema>
export type CreateTripValues = z.output<typeof createTripSchema>

/**
 * An edit submits the same fields as a create, so it validates against the same
 * schema. The difference is server-side: the slug is left alone (public URLs
 * must not change under a reader) and places are matched by id.
 */
export const updateTripSchema = createTripSchema

/**
 * Suggests a status from the dates, matching the nightly cron that keeps it
 * accurate later. The user can override it — someone logging a trip they took
 * last year should not have to fight the form.
 */
export function suggestStatus(
  startDate: string | null,
  endDate: string | null,
  today = new Date()
): (typeof TRIP_STATUSES)[number] {
  if (!startDate) return 'planning'
  const iso = today.toISOString().slice(0, 10)
  if (endDate && endDate < iso) return 'completed'
  if (startDate <= iso && (!endDate || endDate >= iso)) return 'ongoing'
  return 'upcoming'
}

/** URL-safe slug from a title. Uniqueness is settled server-side. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      // Strip combining marks so "Café" becomes "cafe", not "caf".
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'trip'
  )
}
