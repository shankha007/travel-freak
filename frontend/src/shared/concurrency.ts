/**
 * Bounded-concurrency mapping.
 *
 * `Promise.all(items.map(fn))` starts everything at once and a `for` loop starts
 * one thing at a time. Neither suits work that is both slow and expensive: the
 * public trip page may have to re-encode two dozen photos, where all-at-once
 * means two dozen simultaneous downloads and sharp pipelines competing for the
 * same cores, and one-at-a-time means the visitor waits for their sum.
 *
 * Results come back in input order regardless of the order they finish in, so a
 * caller can treat this as a drop-in for `Promise.all(items.map(fn))`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const width = Math.max(1, Math.min(Math.floor(limit), items.length))
  const results = new Array<R>(items.length)
  let next = 0

  // Each worker pulls the next index until there are none left, so one slow
  // item delays only its own worker rather than a whole batch.
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: width }, worker))

  return results
}
