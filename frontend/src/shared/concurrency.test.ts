import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './concurrency'

/** A task that resolves only when `release()` is called, so timing is explicit. */
function deferred<T>() {
  let release!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('mapWithConcurrency', () => {
  it('returns results in input order, not completion order', async () => {
    const result = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms))
      return ms
    })

    expect(result).toEqual([30, 10, 20])
  })

  it('passes the index alongside the item', async () => {
    const result = await mapWithConcurrency(['a', 'b'], 1, async (item, index) => `${index}${item}`)

    expect(result).toEqual(['0a', '1b'])
  })

  it('runs no more than the limit at once', async () => {
    let running = 0
    let peak = 0

    await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      4,
      async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running -= 1
      }
    )

    expect(peak).toBe(4)
  })

  it('starts the next item as soon as a worker frees up', async () => {
    // The point of the worker pool: with three items, a limit of two and a
    // first item that never finishes, the third must still start — a batching
    // implementation would leave it waiting on the stuck one.
    const stuck = deferred<string>()
    const started: number[] = []

    const all = mapWithConcurrency([0, 1, 2], 2, async (item) => {
      started.push(item)
      if (item === 0) return stuck.promise
      return `done ${item}`
    })

    await new Promise((r) => setTimeout(r, 0))
    expect(started).toEqual([0, 1, 2])

    stuck.release('done 0')
    expect(await all).toEqual(['done 0', 'done 1', 'done 2'])
  })

  it('handles an empty list without starting a worker', async () => {
    let calls = 0
    expect(
      await mapWithConcurrency([], 4, async () => {
        calls += 1
      })
    ).toEqual([])
    expect(calls).toBe(0)
  })

  it('treats a limit below one as one rather than stalling forever', async () => {
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n * 2)).toEqual([2, 4])
  })

  it('rejects when an item does, like Promise.all', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('nope')
        return n
      })
    ).rejects.toThrow('nope')
  })
})
