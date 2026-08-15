import { z } from 'zod'
import { CHECKLIST_KINDS } from '@/shared/packing'

/**
 * Lists and the lines on them, on the way in — screen 23.
 *
 * Both need a name and nothing else. A packing list is written while walking
 * around a room, so every field beyond the label is optional and the quantity
 * defaults to one — "socks" means a pair of socks until somebody says otherwise.
 */

export const checklistSchema = z.object({
  /** Present when renaming; absent when creating. */
  id: z.uuid().nullish(),
  tripId: z.uuid({ error: 'Which trip is this?' }),
  kind: z.enum(CHECKLIST_KINDS).default('packing'),
  title: z
    .string()
    .trim()
    .min(1, { error: 'Give the list a name' })
    .max(120, { error: 'Keep the name under 120 characters' }),
})

export const checklistItemSchema = z.object({
  id: z.uuid().nullish(),
  checklistId: z.uuid({ error: 'Which list is this on?' }),
  label: z
    .string()
    .trim()
    .min(1, { error: 'Give it a name' })
    .max(160, { error: 'Keep the name under 160 characters' }),
  category: z
    .string()
    .trim()
    .max(60, { error: 'Keep the category under 60 characters' })
    .default(''),
  quantity: z
    .number()
    .int({ error: 'Use a whole number' })
    .min(1, { error: 'One is the fewest you can pack' })
    .max(999, { error: 'That is more than the column will hold' })
    .default(1),
  notes: z.string().trim().max(500, { error: 'Keep the notes under 500 characters' }).default(''),
})

/** Applying a template writes ordinary rows; this is what names which one. */
export const applyTemplateSchema = z.object({
  tripId: z.uuid({ error: 'Which trip is this?' }),
  templateId: z.string().trim().min(1, { error: 'Pick a template' }),
})

export type ChecklistValues = z.output<typeof checklistSchema>
export type ChecklistItemValues = z.output<typeof checklistItemSchema>
