/**
 * How a wish is ranked — screen 30.
 *
 * `wishlist_items.priority` is a smallint checked between 1 and 5, and 1 is the
 * top. That is an ordering, not a feeling, so every surface that shows it shows
 * the label: a bare "3" tells a reader nothing about which end is urgent, and
 * ordering by a number nobody can interpret is the same as not ordering.
 */

export const WISHLIST_PRIORITIES = [1, 2, 3, 4, 5] as const

export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number]

export const PRIORITY_LABEL: Record<WishlistPriority, string> = {
  1: 'Next up',
  2: 'Soon',
  3: 'Someday',
  4: 'Eventually',
  5: 'One day',
}

/** The default for a new wish: wanted, but not yet promised to. */
export const DEFAULT_PRIORITY: WishlistPriority = 3

export function isWishlistPriority(value: number): value is WishlistPriority {
  return WISHLIST_PRIORITIES.includes(value as WishlistPriority)
}

/** The label, or the bare number if the database ever holds something else. */
export function priorityLabel(value: number): string {
  return isWishlistPriority(value) ? PRIORITY_LABEL[value] : `Priority ${value}`
}
