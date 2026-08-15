import 'server-only'

import { createClient } from '@/server/supabase/server'
import { checkChecklistQuota, getEntitlements, type QuotaCheck } from '@/server/entitlements'
import { getPlannerTrip } from '@/server/queries/planner'
import { checklistProgress, combinedProgress, type ChecklistProgress } from '@/shared/packing'
import type { Database } from '@/shared/types/database'

/**
 * Packing lists and checklists — screen 23.
 *
 * Two reads and a stitch, like the itinerary: every list and every line on the
 * trip come back together rather than one query per list.
 *
 * Progress is computed by `shared/packing.ts` rather than here, because "14 of
 * 20" is read on the morning of a flight and an empty list must not round to
 * done.
 */

type ChecklistKind = Database['public']['Enums']['checklist_kind']

export interface PackingItem {
  id: string
  checklistId: string
  label: string
  category: string
  quantity: number
  isDone: boolean
  notes: string
  orderIndex: number
}

export interface Checklist {
  id: string
  kind: ChecklistKind
  title: string
  orderIndex: number
  items: PackingItem[]
  progress: ChecklistProgress
}

export interface PackingData {
  tripId: string
  tripTitle: string
  tripType: string | null
  startDate: string | null
  lists: Checklist[]
  /** Every line on every list, as one number for the header. */
  overall: ChecklistProgress
  /** Whether another list may be created, and why not when it may not. */
  quota: QuotaCheck
  /** `limits.checklists === null`: templates are the unlimited plans' feature. */
  templatesAllowed: boolean
}

export async function getPacking(tripId: string): Promise<PackingData | null> {
  const trip = await getPlannerTrip(tripId)
  if (!trip) return null

  const supabase = await createClient()

  const [listsResult, itemsResult, quota, entitlements] = await Promise.all([
    supabase
      .from('checklists')
      .select('id, kind, title, order_index')
      .eq('trip_id', tripId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('checklist_items')
      .select('id, checklist_id, label, category, quantity, is_done, notes, order_index')
      .eq('trip_id', tripId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    checkChecklistQuota(tripId),
    getEntitlements(),
  ])

  const itemsByList = new Map<string, PackingItem[]>()

  for (const row of itemsResult.data ?? []) {
    const item: PackingItem = {
      id: row.id,
      checklistId: row.checklist_id,
      label: row.label,
      category: row.category,
      quantity: row.quantity,
      isDone: row.is_done,
      notes: row.notes,
      orderIndex: row.order_index,
    }
    const existing = itemsByList.get(row.checklist_id)
    if (existing) existing.push(item)
    else itemsByList.set(row.checklist_id, [item])
  }

  const lists: Checklist[] = (listsResult.data ?? []).map((list) => {
    const items = itemsByList.get(list.id) ?? []
    return {
      id: list.id,
      kind: list.kind,
      title: list.title,
      orderIndex: list.order_index,
      items,
      progress: checklistProgress(items),
    }
  })

  return {
    tripId: trip.id,
    tripTitle: trip.title,
    tripType: trip.tripType,
    startDate: trip.startDate,
    lists,
    overall: combinedProgress(lists),
    quota,
    templatesAllowed: (entitlements.limits.checklists ?? null) === null,
  }
}
