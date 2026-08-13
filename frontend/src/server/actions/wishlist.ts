'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { countryName } from '@/shared/geo/countries'
import { wishlistItemSchema } from '@/shared/validation/wishlist'

/**
 * Wishlist writes — screen 30.
 *
 * Every one of these repaints the globe, because `wishlist_items` is a source
 * for the `visited_regions` aggregate and a trigger rebuilds it on write. So
 * the revalidations below are not housekeeping: without them a country stays
 * yellow on the globe after its wish has been deleted.
 */

/** Every route whose contents change when a wish does. */
const PAINTED_BY_WISHES = ['/wishlist', '/globe', '/maps/world', '/maps/india', '/dashboard']

function repaint() {
  for (const path of PAINTED_BY_WISHES) revalidatePath(path)
}

/** What was submitted, echoed back verbatim. See `WishlistState.values`. */
export interface WishlistSubmission {
  countryCode: string
  title: string
  notes: string
  estBudget: string
  currency: string
  priority: string
  bestSeason: string
}

export interface WishlistState {
  error: string | null
  fieldErrors?: Record<string, string>
  /** Set on the way out, so the dialog knows to close itself. */
  saved?: boolean
  /**
   * The rejected submission, so the form can render it again.
   *
   * React resets an uncontrolled form once its action returns, which on a
   * failure means the writer loses everything they typed to be told they
   * picked a country twice. Sending the values back is what lets the fields
   * be re-seeded with them.
   */
  values?: WishlistSubmission
}

/** Reads the form as plain strings, before any of it is trusted. */
function submissionOf(formData: FormData): WishlistSubmission {
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }

  return {
    countryCode: text('countryCode'),
    title: text('title'),
    notes: text('notes'),
    estBudget: text('estBudget'),
    currency: text('currency'),
    priority: text('priority'),
    bestSeason: text('bestSeason'),
  }
}

/**
 * Creates a wish, or updates the one whose id is supplied.
 *
 * One form and one action for both, because the two differ by exactly one field
 * and splitting them would mean two copies of the same validation and the same
 * duplicate handling.
 */
export async function saveWishlistItem(
  _prev: WishlistState,
  formData: FormData
): Promise<WishlistState> {
  const values = submissionOf(formData)
  const budget = values.estBudget.trim() !== '' ? Number(values.estBudget) : null

  // A budget that is not a number at all would reach Zod as NaN, which reads as
  // "expected number" — true, but not the sentence a reader can act on.
  if (budget !== null && !Number.isFinite(budget)) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { estBudget: 'Enter a number' },
      values,
    }
  }

  const rawId = formData.get('id')
  const parsed = wishlistItemSchema.safeParse({
    id: typeof rawId === 'string' && rawId !== '' ? rawId : null,
    countryCode: values.countryCode,
    title: values.title,
    notes: values.notes,
    estBudget: budget,
    currency: values.currency || 'INR',
    priority: Number(values.priority),
    bestSeason: values.bestSeason,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors, values }
  }

  const { id, countryCode, title, notes, estBudget, currency, priority, bestSeason } = parsed.data

  const supabase = await createClient()
  const user = await requireUser()

  const row = {
    user_id: user.id,
    country_code: countryCode,
    title,
    notes,
    est_budget: estBudget,
    currency,
    priority,
    best_season: bestSeason,
  }

  // Scoped by user_id as well as id: RLS would refuse someone else's row anyway,
  // but a silent no-op is a worse answer than never having tried.
  const { error } = id
    ? await supabase.from('wishlist_items').update(row).eq('id', id).eq('user_id', user.id)
    : await supabase.from('wishlist_items').insert(row)

  if (error) {
    // `wishlist_items_unique` is one row per country per user. Adding a country
    // that is already on the list is a normal mistake, not a failure.
    if (error.code === '23505') {
      return {
        error: `${countryName(countryCode)} is already on your wishlist. Edit the entry you have.`,
        values,
      }
    }
    return { error: 'Could not save that. Please try again.', values }
  }

  repaint()
  return { error: null, saved: true }
}

export interface DeleteWishlistState {
  error: string | null
}

export async function deleteWishlistItem(
  _prev: DeleteWishlistState,
  formData: FormData
): Promise<DeleteWishlistState> {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) return { error: 'Nothing to remove.' }

  const supabase = await createClient()
  const user = await requireUser()

  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not remove that. Please try again.' }

  repaint()
  return { error: null }
}
