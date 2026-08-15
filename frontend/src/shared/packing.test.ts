import { describe, expect, it } from 'vitest'
import {
  CHECKLIST_TEMPLATES,
  checklistProgress,
  combinedProgress,
  groupByCategory,
  templateById,
  templatesFor,
} from '@/shared/packing'

const item = (isDone: boolean) => ({ isDone, quantity: 1 })

describe('checklistProgress', () => {
  it('counts what is ticked', () => {
    expect(checklistProgress([item(true), item(false), item(false), item(true)])).toEqual({
      done: 2,
      total: 4,
      percent: 50,
      complete: false,
      remaining: 2,
    })
  })

  it('does not call an empty list finished', () => {
    expect(checklistProgress([])).toEqual({
      done: 0,
      total: 0,
      percent: 0,
      complete: false,
      remaining: 0,
    })
  })

  it('finishes a list only when every line is ticked', () => {
    expect(checklistProgress([item(true)]).complete).toBe(true)
    expect(checklistProgress([item(true), item(false)]).complete).toBe(false)
  })

  it('rounds rather than truncating', () => {
    expect(checklistProgress([item(true), item(false), item(false)]).percent).toBe(33)
    expect(checklistProgress([item(true), item(true), item(false)]).percent).toBe(67)
  })
})

describe('combinedProgress', () => {
  it('counts every list as one', () => {
    expect(
      combinedProgress([{ items: [item(true), item(false)] }, { items: [item(true), item(true)] }])
    ).toMatchObject({ done: 3, total: 4, percent: 75 })
  })

  it('survives a trip with no lists at all', () => {
    expect(combinedProgress([])).toMatchObject({ total: 0, percent: 0, complete: false })
  })
})

describe('groupByCategory', () => {
  it('keeps categories in the order they first appear', () => {
    const groups = groupByCategory([
      { category: 'Documents', label: 'Passport' },
      { category: 'Clothes', label: 'Socks' },
      { category: 'Documents', label: 'Visa' },
    ])

    expect(groups.map((g) => g.category)).toEqual(['Documents', 'Clothes'])
    expect(groups[0]?.items).toHaveLength(2)
  })

  it('collects uncategorised items under one empty heading', () => {
    const groups = groupByCategory([
      { category: '', label: 'Charger' },
      { category: '   ', label: 'Book' },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.category).toBe('')
  })
})

describe('templates', () => {
  it('gives every template a unique id', () => {
    const ids = CHECKLIST_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no template with an empty item list', () => {
    for (const template of CHECKLIST_TEMPLATES) {
      expect(template.items.length).toBeGreaterThan(0)
    }
  })

  it('offers a matching trip type first', () => {
    expect(templatesFor('business')[0]?.id).toBe('business')
    expect(templatesFor('family')[0]?.id).toBe('family')
  })

  it('still offers everything, so a solo traveller can pack for the cold', () => {
    expect(templatesFor('business')).toHaveLength(CHECKLIST_TEMPLATES.length)
    expect(templatesFor('business').map((t) => t.id)).toContain('cold-weather')
  })

  it('falls back to the universal ones for a trip with no type', () => {
    const first = templatesFor(null)[0]
    expect(first?.tripTypes).toHaveLength(0)
  })

  it('finds a template by id and nothing by a made-up one', () => {
    expect(templateById('essentials')?.title).toBe('Essentials')
    expect(templateById('nonsense')).toBeUndefined()
  })
})
