'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { checkChecklistQuota, getEntitlements } from '@/server/entitlements'
import { templateById } from '@/shared/packing'
import {
  applyTemplateSchema,
  checklistItemSchema,
  checklistSchema,
} from '@/shared/validation/checklist'
import { fieldErrorsOf, textFields, type FormState } from '@/shared/validation/form-state'

/**
 * Checklist writes — screen 23.
 *
 * Same rule as the itinerary: **the parent proves the ownership.** An item
 * names a list, the list is read back through the caller's own client so RLS
 * answers, and the trip written onto the row is the list's own. The composite
 * foreign key in the migration refuses any row where those two disagree.
 *
 * The quota — `limits.checklists`, read per trip — is checked before a list is
 * created, and again before a template is applied, because a template creates a
 * list like any other route in.
 */

function repaint(tripId: string) {
  revalidatePath(`/trips/${tripId}/packing`)
  // The trip page carries how much of the packing is done.
  revalidatePath(`/trips/${tripId}`)
}

/**
 * One function per table rather than one parameterised by both: PostgREST's
 * generated types tie the column name to the table, so a shared helper would
 * have to widen the column to a union neither table accepts.
 */
async function nextListIndex(tripId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('checklists')
    .select('order_index')
    .eq('trip_id', tripId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.order_index ?? -1) + 1
}

async function nextItemIndex(checklistId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('checklist_items')
    .select('order_index')
    .eq('checklist_id', checklistId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.order_index ?? -1) + 1
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function saveChecklist(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(formData, 'tripId', 'kind', 'title')
  const rawId = formData.get('id')

  const parsed = checklistSchema.safeParse({
    id: typeof rawId === 'string' && rawId !== '' ? rawId : null,
    ...values,
    kind: values.kind || 'packing',
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    }
  }

  const { id, tripId, kind, title } = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  if (!id) {
    // Renaming a list is always allowed; creating one is what the plan limits.
    // An account that has gone over its cap by downgrading keeps every list it
    // has and simply cannot add another — nothing is deleted, ever.
    const quota = await checkChecklistQuota(tripId)
    if (!quota.allowed) return { error: quota.reason ?? 'That is one list too many.', values }
  }

  const { error } = id
    ? await supabase.from('checklists').update({ title, kind }).eq('id', id).eq('user_id', user.id)
    : await supabase.from('checklists').insert({
        trip_id: tripId,
        user_id: user.id,
        kind,
        title,
        order_index: await nextListIndex(tripId),
      })

  if (error) return { error: 'Could not save that list. Please try again.', values }

  repaint(tripId)
  return { error: null, saved: true }
}

export async function deleteChecklist(_prev: FormState, formData: FormData): Promise<FormState> {
  const { id, tripId } = textFields(formData, 'id', 'tripId')
  if (!id || !tripId) return { error: 'Nothing to remove.' }

  const supabase = await createClient()
  const user = await requireUser()

  // Every line on the list goes with it, by `on delete cascade`. The dialog
  // says how many before this runs.
  const { error } = await supabase.from('checklists').delete().eq('id', id).eq('user_id', user.id)

  if (error) return { error: 'Could not remove that list. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

/**
 * Creates a list from a template.
 *
 * The template is copied, not referenced: what lands in the database is an
 * ordinary list of ordinary rows, which is what lets somebody delete half of it
 * and add three things of their own without the result being a broken template.
 * It also means editing a template here later cannot rewrite anybody's packing.
 */
export async function applyChecklistTemplate(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const values = textFields(formData, 'tripId', 'templateId')
  const parsed = applyTemplateSchema.safeParse(values)

  if (!parsed.success) {
    return { error: 'Pick a template to start from.', values }
  }

  const template = templateById(parsed.data.templateId)
  if (!template) return { error: 'That template no longer exists.', values }

  const { tripId } = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  const { limits, planName } = await getEntitlements()
  if ((limits.checklists ?? null) !== null) {
    return {
      error: `Templates come with the unlimited plans. ${planName} lists are built by hand — everything else on this screen works the same.`,
      values,
    }
  }

  const quota = await checkChecklistQuota(tripId)
  if (!quota.allowed) return { error: quota.reason ?? 'That is one list too many.', values }

  const { data: list, error: listError } = await supabase
    .from('checklists')
    .insert({
      trip_id: tripId,
      user_id: user.id,
      kind: template.kind,
      title: template.title,
      order_index: await nextListIndex(tripId),
    })
    .select('id')
    .single()

  if (listError || !list) return { error: 'Could not start that list. Please try again.', values }

  const { error: itemsError } = await supabase.from('checklist_items').insert(
    template.items.map((item, index) => ({
      checklist_id: list.id,
      trip_id: tripId,
      user_id: user.id,
      label: item.label,
      category: item.category,
      quantity: item.quantity ?? 1,
      order_index: index,
    }))
  )

  if (itemsError) {
    // An empty list with a template's name would look like the template failed
    // silently. Taking it back leaves the screen as it was.
    await supabase.from('checklists').delete().eq('id', list.id).eq('user_id', user.id)
    return { error: 'Could not fill that list in. Please try again.', values }
  }

  repaint(tripId)
  return { error: null, saved: true }
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function saveChecklistItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(formData, 'checklistId', 'label', 'category', 'quantity', 'notes')

  const rawQuantity = values.quantity.trim()
  const quantity = rawQuantity === '' ? 1 : Number(rawQuantity)

  if (!Number.isFinite(quantity)) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { quantity: 'Enter a whole number' },
      values,
    }
  }

  const rawId = formData.get('id')
  const parsed = checklistItemSchema.safeParse({
    id: typeof rawId === 'string' && rawId !== '' ? rawId : null,
    ...values,
    quantity,
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    }
  }

  const item = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  const { data: list } = await supabase
    .from('checklists')
    .select('id, trip_id')
    .eq('id', item.checklistId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!list) return { error: 'That list is not here any more.', values }

  const row = {
    checklist_id: list.id,
    trip_id: list.trip_id,
    user_id: user.id,
    label: item.label,
    category: item.category,
    quantity: item.quantity,
    notes: item.notes,
  }

  const { error } = item.id
    ? await supabase.from('checklist_items').update(row).eq('id', item.id).eq('user_id', user.id)
    : await supabase.from('checklist_items').insert({
        ...row,
        order_index: await nextItemIndex(list.id),
      })

  if (error) return { error: 'Could not save that. Please try again.', values }

  repaint(list.trip_id)
  return { error: null, saved: true }
}

export async function deleteChecklistItem(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { id, tripId } = textFields(formData, 'id', 'tripId')
  if (!id || !tripId) return { error: 'Nothing to remove.' }

  const supabase = await createClient()
  const user = await requireUser()

  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not remove that. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

/**
 * Ticks one line off, or puts it back.
 *
 * The only thing this screen does at any volume, so it is one action, one
 * round trip, and no dialog. The new value is sent rather than toggled from
 * what the server reads back, so two taps in quick succession cannot land as
 * one — the second says what it means rather than flipping whatever it finds.
 */
export async function setChecklistItemDone(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { id, tripId, done } = textFields(formData, 'id', 'tripId', 'done')
  if (!id || !tripId) return { error: 'Nothing to tick off.' }

  const supabase = await createClient()
  const user = await requireUser()

  const { error } = await supabase
    .from('checklist_items')
    .update({ is_done: done === 'true' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not update that. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}
