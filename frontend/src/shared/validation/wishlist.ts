import { z } from 'zod'
import { isKnownCountry } from '@/shared/geo/countries'
import { DEFAULT_PRIORITY, WISHLIST_PRIORITIES } from '@/shared/wishlist'

/**
 * One wish, on the way in — screen 30.
 *
 * The country is the only required field, because it is the only one the globe
 * needs: a wish with nothing but a code still paints the country planned, which
 * is the whole point of the screen. Everything else is a note to your future
 * self and is allowed to be blank.
 */

/** Matches the `numeric(12, 2)` column: enough for any trip, and not silently rounded. */
const MAX_BUDGET = 9_999_999_999

export const wishlistItemSchema = z.object({
  /** Present when editing; absent when adding. */
  id: z.uuid().nullish(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, { error: 'Pick a country' })
    .refine(isKnownCountry, { error: 'That is not a country we know about' }),
  title: z.string().trim().max(120, { error: 'Keep the title under 120 characters' }).default(''),
  notes: z.string().trim().max(2000, { error: 'Keep the notes under 2000 characters' }).default(''),
  /**
   * Null rather than zero when left blank. Zero is a budget of nothing, which
   * is a different statement from not having thought about it yet.
   */
  estBudget: z
    .number()
    .nonnegative({ error: 'A budget cannot be negative' })
    .max(MAX_BUDGET, { error: 'That budget is larger than the column can hold' })
    .nullable()
    .default(null),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, { error: 'Use a three-letter currency code, like INR' })
    .default('INR'),
  priority: z
    .number()
    .int()
    .refine((n) => (WISHLIST_PRIORITIES as readonly number[]).includes(n), {
      error: 'Pick a priority',
    })
    .default(DEFAULT_PRIORITY),
  /** Free text on purpose: "Sep–Mar", "after the monsoon" and "shoulder season" are all answers. */
  bestSeason: z
    .string()
    .trim()
    .max(60, { error: 'Keep the season under 60 characters' })
    .default(''),
})

export type WishlistItemValues = z.output<typeof wishlistItemSchema>
