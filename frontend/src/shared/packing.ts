/**
 * Packing lists and checklists — screen 23.
 *
 * Two things live here, both pure.
 *
 * **Progress**, because "14 of 20" is the entire point of a packing list and it
 * is read on the morning of a flight. It has to be right when the list is empty,
 * when everything is ticked, and when a list holds one item.
 *
 * **Templates**, because nobody wants to type "passport" again. These are
 * ordinary data — a title, a category and a quantity per line — so a template is
 * a starting point somebody then edits, not a special kind of list. Applying one
 * writes normal rows and the template is forgotten; that is why a template can
 * be changed here later without rewriting anybody's saved list.
 */

export const CHECKLIST_KINDS = ['packing', 'todo'] as const

export type ChecklistKind = (typeof CHECKLIST_KINDS)[number]

export const CHECKLIST_KIND_LABEL: Record<ChecklistKind, string> = {
  packing: 'Packing',
  todo: 'To do',
}

export function isChecklistKind(value: string): value is ChecklistKind {
  return (CHECKLIST_KINDS as readonly string[]).includes(value)
}

/** Enough of an item to count; the query type carries the rest. */
export interface CountableItem {
  isDone: boolean
  quantity: number
}

export interface ChecklistProgress {
  done: number
  total: number
  /** 0–100, rounded. An empty list is 0 rather than NaN or 100. */
  percent: number
  /** True only when there is something to have finished. */
  complete: boolean
  remaining: number
}

export function checklistProgress(items: readonly CountableItem[]): ChecklistProgress {
  const total = items.length
  const done = items.filter((i) => i.isDone).length

  return {
    done,
    total,
    // An empty list has finished nothing, not everything: 0/0 rendered as 100%
    // would tell someone their empty packing list is packed.
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
    remaining: total - done,
  }
}

/** Progress across several lists at once, for the trip page's summary line. */
export function combinedProgress(lists: readonly { items: CountableItem[] }[]): ChecklistProgress {
  return checklistProgress(lists.flatMap((l) => l.items))
}

/**
 * Items grouped under their category heading, in first-seen order.
 *
 * Insertion order rather than alphabetical: `order_index` is what the list is
 * sorted by, so the categories come out in the order the writer built them, and
 * a category renamed does not jump across the screen.
 */
export interface ItemGroup<T> {
  category: string
  items: T[]
}

export function groupByCategory<T extends { category: string }>(
  items: readonly T[]
): ItemGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const category = item.category.trim()
    const existing = groups.get(category)
    if (existing) existing.push(item)
    else groups.set(category, [item])
  }

  return [...groups].map(([category, grouped]) => ({ category, items: grouped }))
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateItem {
  label: string
  category: string
  quantity?: number
}

export interface ChecklistTemplate {
  id: string
  title: string
  kind: ChecklistKind
  /** One line on what it is for, shown on the card that applies it. */
  summary: string
  /**
   * Trip types this is offered for first. Empty means every trip — the
   * essentials do not depend on who you are travelling with.
   */
  tripTypes: readonly string[]
  items: readonly TemplateItem[]
}

export const CHECKLIST_TEMPLATES: readonly ChecklistTemplate[] = [
  {
    id: 'essentials',
    title: 'Essentials',
    kind: 'packing',
    summary: 'The things that end a trip if you leave them behind.',
    tripTypes: [],
    items: [
      { label: 'Passport', category: 'Documents' },
      { label: 'Visa or entry permit', category: 'Documents' },
      { label: 'Travel insurance', category: 'Documents' },
      { label: 'Tickets and booking confirmations', category: 'Documents' },
      { label: 'Cards and some cash', category: 'Money' },
      { label: 'Phone and charger', category: 'Electronics' },
      { label: 'Power adapter', category: 'Electronics' },
      { label: 'Power bank', category: 'Electronics' },
      { label: 'Toothbrush and toothpaste', category: 'Toiletries' },
      { label: 'Any prescription medicine', category: 'Health' },
      { label: 'Basic first aid', category: 'Health' },
    ],
  },
  {
    id: 'before-you-go',
    title: 'Before you go',
    kind: 'todo',
    summary: 'The week before: the errands that are only errands if you remember them.',
    tripTypes: [],
    items: [
      { label: 'Check the passport expiry date', category: 'Paperwork' },
      { label: 'Tell the bank you are travelling', category: 'Paperwork' },
      { label: 'Download offline maps', category: 'Phone' },
      { label: 'Save booking references offline', category: 'Phone' },
      { label: 'Arrange airport transfer', category: 'Travel' },
      { label: 'Check the weather forecast', category: 'Travel' },
      { label: 'Set an out-of-office', category: 'Home' },
      { label: 'Sort out plants, pets and post', category: 'Home' },
    ],
  },
  {
    id: 'warm-weather',
    title: 'Warm weather',
    kind: 'packing',
    summary: 'Coast, desert, anywhere the sun is the problem.',
    tripTypes: [],
    items: [
      { label: 'Sunscreen', category: 'Sun' },
      { label: 'Sunglasses', category: 'Sun' },
      { label: 'Hat', category: 'Sun' },
      { label: 'Swimwear', category: 'Clothes' },
      { label: 'Light shirts', category: 'Clothes', quantity: 4 },
      { label: 'Sandals', category: 'Clothes' },
      { label: 'Reusable water bottle', category: 'Kit' },
      { label: 'Insect repellent', category: 'Health' },
    ],
  },
  {
    id: 'cold-weather',
    title: 'Cold weather',
    kind: 'packing',
    summary: 'Mountains and winters — layers, and the things that keep working when it freezes.',
    tripTypes: [],
    items: [
      { label: 'Thermal base layers', category: 'Layers', quantity: 2 },
      { label: 'Fleece or mid layer', category: 'Layers' },
      { label: 'Waterproof outer jacket', category: 'Layers' },
      { label: 'Gloves', category: 'Extremities' },
      { label: 'Warm hat', category: 'Extremities' },
      { label: 'Thick socks', category: 'Extremities', quantity: 4 },
      { label: 'Lip balm and moisturiser', category: 'Health' },
      { label: 'Spare battery — cold drains them', category: 'Electronics' },
    ],
  },
  {
    id: 'business',
    title: 'Work trip',
    kind: 'packing',
    summary: 'What a trip needs when somebody else is expecting you at nine.',
    tripTypes: ['business'],
    items: [
      { label: 'Laptop and charger', category: 'Work' },
      { label: 'Notebook and pen', category: 'Work' },
      { label: 'Business cards', category: 'Work' },
      { label: 'Presentation on a drive as well as the cloud', category: 'Work' },
      { label: 'Formal outfit', category: 'Clothes' },
      { label: 'Shoe polish or wipes', category: 'Clothes' },
      { label: 'Receipts folder for expenses', category: 'Admin' },
    ],
  },
  {
    id: 'family',
    title: 'Travelling with children',
    kind: 'packing',
    summary: 'The bag that has to be reachable, and everything that goes in it.',
    tripTypes: ['family'],
    items: [
      { label: 'Snacks for the journey', category: 'Journey bag' },
      { label: 'Something to do on the way', category: 'Journey bag' },
      { label: 'Spare clothes, packed on top', category: 'Journey bag' },
      { label: 'Wet wipes', category: 'Journey bag' },
      { label: "Children's medicine and thermometer", category: 'Health' },
      { label: 'Birth certificates or ID for the children', category: 'Documents' },
      { label: 'Favourite toy — the one that matters', category: 'Comfort' },
    ],
  },
] as const

/**
 * Templates, with the ones matching this trip's type first.
 *
 * Everything is still offered: a solo traveller may well want the cold-weather
 * list, and hiding it to make the sort look clever would be worse than a longer
 * list. `tripType` is null for a trip that never declared one.
 */
export function templatesFor(tripType: string | null): ChecklistTemplate[] {
  const matches = (t: ChecklistTemplate) =>
    tripType !== null && t.tripTypes.includes(tripType) ? 0 : t.tripTypes.length === 0 ? 1 : 2

  return [...CHECKLIST_TEMPLATES].sort((a, b) => matches(a) - matches(b))
}

export function templateById(id: string): ChecklistTemplate | undefined {
  return CHECKLIST_TEMPLATES.find((t) => t.id === id)
}
