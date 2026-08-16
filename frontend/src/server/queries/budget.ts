import 'server-only'

import { createClient } from '@/server/supabase/server'
import { canUseFullBudget } from '@/server/entitlements'
import { getPlannerTrip } from '@/server/queries/planner'
import { summariseBudget, type BudgetSummary } from '@/shared/budget'
import { costByCurrency, type CurrencyTotal } from '@/shared/itinerary'
import type { Database } from '@/shared/types/database'

/**
 * The budget planner — screen 22.
 *
 * `trips.budget_planned` is the plan and `expenses` is what happened; every
 * comparison between them is done by `shared/budget.ts`, which is pure and
 * tested because these are claims about somebody's money.
 *
 * The itinerary's own costs are read too. They are a third number and a
 * different one: what the plan says a trip *will* cost, as opposed to what was
 * budgeted for it and what has been spent. Showing it here is what makes the
 * two planner screens one feature rather than two.
 */

type ExpenseCategory = Database['public']['Enums']['expense_category']

export interface ExpenseRow {
  id: string
  category: ExpenseCategory
  title: string
  amount: number
  currency: string
  spentAt: string | null
  paidBy: string
  notes: string
  createdAt: string
  /**
   * What this expense settles, when it was recorded from the itinerary rather
   * than typed in. Carries the planned figure so the row can show both numbers —
   * the interesting one is the difference, and reading it back off the itinerary
   * would mean a second query for a fact this join already has.
   */
  fromPlan: { itemId: string; title: string; cost: number | null; currency: string } | null
}

export interface BudgetData {
  tripId: string
  tripTitle: string
  currency: string
  budgetPlanned: number | null
  expenses: ExpenseRow[]
  summary: BudgetSummary
  /** What the itinerary expects to cost, per currency. */
  itineraryPlanned: CurrencyTotal[]
  /** `budget_full`: the category breakdown and its chart. */
  full: boolean
}

export async function getBudget(tripId: string): Promise<BudgetData | null> {
  const trip = await getPlannerTrip(tripId)
  if (!trip) return null

  // Owner only, and this line is the whole enforcement on the read side.
  //
  // `expenses` has one policy — `user_id = auth.uid()` — so a collaborator
  // opening this screen saw an empty expense list, which is correct. What they
  // also saw was `trips.budget_planned`: a column on the trip row, which RLS
  // hands to any collaborator, rendered under a sentence promising that only
  // the owner could see it. The list was private and the plan was not, and the
  // page said both were. It 404s for anyone but the owner now, which is the
  // same answer the policy already gave for the half that mattered.
  if (!trip.isOwner) return null

  const supabase = await createClient()

  const [expensesResult, itineraryResult, full] = await Promise.all([
    supabase
      .from('expenses')
      .select(
        `id, category, title, amount, currency, spent_at, paid_by, notes, created_at,
         itinerary_items ( id, title, cost, currency )`
      )
      .eq('trip_id', tripId)
      // Newest spend first, and an undated one sorts by when it was recorded
      // rather than disappearing to the bottom of a list nobody scrolls.
      .order('spent_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase.from('itinerary_items').select('cost, currency').eq('trip_id', tripId),
    canUseFullBudget(),
  ])

  const expenses: ExpenseRow[] = (expensesResult.data ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    // `numeric` arrives as a string from PostgREST when it is large enough to
    // lose precision as a float; both forms are normalised here.
    amount: Number(row.amount),
    currency: row.currency,
    spentAt: row.spent_at,
    paidBy: row.paid_by,
    notes: row.notes,
    createdAt: row.created_at,
    fromPlan: row.itinerary_items
      ? {
          itemId: row.itinerary_items.id,
          title: row.itinerary_items.title,
          cost: row.itinerary_items.cost === null ? null : Number(row.itinerary_items.cost),
          currency: row.itinerary_items.currency,
        }
      : null,
  }))

  return {
    tripId: trip.id,
    tripTitle: trip.title,
    currency: trip.currency,
    budgetPlanned: trip.budgetPlanned,
    expenses,
    summary: summariseBudget({
      expenses,
      planned: trip.budgetPlanned,
      plannedCurrency: trip.currency,
    }),
    itineraryPlanned: costByCurrency(
      (itineraryResult.data ?? []).map((row) => ({
        cost: row.cost === null ? null : Number(row.cost),
        currency: row.currency,
      }))
    ),
    full,
  }
}
