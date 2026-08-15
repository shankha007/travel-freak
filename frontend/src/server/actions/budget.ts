'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { expenseSchema } from '@/shared/validation/expense'
import { fieldErrorsOf, textFields, type FormState } from '@/shared/validation/form-state'

/**
 * Expense writes — screen 22.
 *
 * Recording a spend is free on every plan. `budget_full` gates the category
 * breakdown and its chart, not the ability to add to your own budget — a
 * budget you cannot write to is not a budget, and locking the input would mean
 * the free tier's "basic totals" had nothing to total.
 *
 * `expenses` has one policy, `user_id = auth.uid()`, and no collaborator clause:
 * what a trip cost is the most private thing in the schema. So the trip is
 * checked as the caller's own here rather than through `can_edit_trip()`.
 */

function repaint(tripId: string) {
  revalidatePath(`/trips/${tripId}/budget`)
  // The trip page shows the spend line next to the planned budget.
  revalidatePath(`/trips/${tripId}`)
}

export async function saveExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(
    formData,
    'tripId',
    'category',
    'title',
    'amount',
    'currency',
    'spentAt',
    'paidBy',
    'notes'
  )

  const amount = Number(values.amount)

  // An empty or unparseable amount reaches Zod as NaN, which reports "expected
  // number" — accurate, and not a sentence anybody can act on.
  if (values.amount.trim() === '' || !Number.isFinite(amount)) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { amount: 'How much was it?' },
      values,
    }
  }

  const rawId = formData.get('id')
  const parsed = expenseSchema.safeParse({
    id: typeof rawId === 'string' && rawId !== '' ? rawId : null,
    ...values,
    amount,
    category: values.category || 'misc',
    currency: values.currency || 'INR',
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    }
  }

  const expense = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  // The trip has to be the caller's own and still alive. RLS would refuse
  // somebody else's anyway; this turns that into a sentence rather than a
  // silent no-op, and stops an expense being filed against a deleted trip.
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', expense.tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return { error: 'That trip is not here any more.', values }

  const row = {
    trip_id: trip.id,
    user_id: user.id,
    category: expense.category,
    title: expense.title,
    amount: expense.amount,
    currency: expense.currency,
    spent_at: expense.spentAt,
    paid_by: expense.paidBy,
    notes: expense.notes,
  }

  const { error } = expense.id
    ? await supabase.from('expenses').update(row).eq('id', expense.id).eq('user_id', user.id)
    : await supabase.from('expenses').insert(row)

  if (error) return { error: 'Could not save that. Please try again.', values }

  repaint(trip.id)
  return { error: null, saved: true }
}

export async function deleteExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const { id, tripId } = textFields(formData, 'id', 'tripId')
  if (!id || !tripId) return { error: 'Nothing to remove.' }

  const supabase = await createClient()
  const user = await requireUser()

  // No trash for an expense: it is one row and a number, and inventing a
  // recovery path for it would be less honest than saying it is gone.
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', user.id)

  if (error) return { error: 'Could not remove that. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

/**
 * Sets what the trip was meant to cost.
 *
 * `trips.budget_planned` rather than a column on a table of its own, because it
 * is what the trip form, the analytics screen and the public trip page already
 * read. The budget screen is a second way into the same field, so a plan set
 * here shows up everywhere a plan is shown.
 */
export async function setPlannedBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(formData, 'tripId', 'budgetPlanned', 'currency')
  if (!values.tripId) return { error: 'Nothing to budget.' }

  const blank = values.budgetPlanned.trim() === ''
  const planned = blank ? null : Number(values.budgetPlanned)

  // Null rather than zero when cleared. Zero is a budget of nothing, which is a
  // different statement from having no budget — `summariseBudget()` treats them
  // differently and so does the screen.
  if (planned !== null && (!Number.isFinite(planned) || planned < 0)) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { budgetPlanned: 'Enter an amount, or leave it blank' },
      values,
    }
  }

  const currency = values.currency.trim().toUpperCase()
  if (currency.length !== 3) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { currency: 'Use a three-letter currency code, like INR' },
      values,
    }
  }

  const supabase = await createClient()
  const user = await requireUser()

  const { error } = await supabase
    .from('trips')
    .update({ budget_planned: planned, currency })
    .eq('id', values.tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (error) return { error: 'Could not save the budget. Please try again.', values }

  repaint(values.tripId)
  // Analytics groups planned budgets by currency, so changing either moves it.
  revalidatePath('/analytics')
  return { error: null, saved: true }
}
