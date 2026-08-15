import { z } from 'zod'
import { EXPENSE_CATEGORIES } from '@/shared/budget'

/**
 * One recorded spend, on the way in — screen 22.
 *
 * The amount is the only thing required. A receipt you have not labelled is
 * still money that left, and a screen that refuses to record it until you name
 * it is a screen people stop using halfway through a trip.
 */

/** Matches the `numeric(12, 2)` column. */
const MAX_AMOUNT = 9_999_999_999

export const expenseSchema = z.object({
  /** Present when editing; absent when adding. */
  id: z.uuid().nullish(),
  tripId: z.uuid({ error: 'Which trip is this?' }),
  category: z.enum(EXPENSE_CATEGORIES).default('misc'),
  title: z.string().trim().max(160, { error: 'Keep the label under 160 characters' }).default(''),
  amount: z
    .number()
    .nonnegative({ error: 'An amount cannot be negative' })
    .max(MAX_AMOUNT, { error: 'That amount is larger than the column can hold' }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, { error: 'Use a three-letter currency code, like INR' })
    .default('INR'),
  /**
   * Null rather than today when left blank. Guessing the date of a spend is how
   * a per-day breakdown ends up describing a day that never happened.
   */
  spentAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use a date like 2026-03-04' })
    .nullable()
    .default(null)
    .or(z.literal('').transform(() => null)),
  /** A name, not an account. Splitting up is Phase 1.2 and needs its own model. */
  paidBy: z.string().trim().max(80, { error: 'Keep the name under 80 characters' }).default(''),
  notes: z.string().trim().max(2000, { error: 'Keep the notes under 2000 characters' }).default(''),
})

export type ExpenseValues = z.output<typeof expenseSchema>
