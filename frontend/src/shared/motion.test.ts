import { describe, expect, it } from 'vitest'
import { MAX_STAGGER_DELAY, STAGGER_STEP, staggerDelay } from './motion'

describe('staggerDelay', () => {
  it('gives the first item no delay', () => {
    expect(staggerDelay(0)).toBe(0)
  })

  it('steps evenly while it is under the cap', () => {
    expect(staggerDelay(1)).toBeCloseTo(STAGGER_STEP)
    expect(staggerDelay(2)).toBeCloseTo(STAGGER_STEP * 2)
  })

  it('caps a long list, so the last card is not a second late', () => {
    expect(staggerDelay(40)).toBe(MAX_STAGGER_DELAY)
    expect(staggerDelay(400)).toBe(MAX_STAGGER_DELAY)
  })

  it('treats a nonsense index as no delay rather than NaN', () => {
    // A NaN delay reaches Framer Motion as a transition that never resolves,
    // which leaves the element invisible for good.
    expect(staggerDelay(Number.NaN)).toBe(0)
    expect(staggerDelay(-3)).toBe(0)
  })
})
