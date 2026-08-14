import { describe, expect, it } from 'vitest'
import {
  EXPORT_SECTIONS,
  EXPORT_VERSION,
  buildExport,
  countSections,
  exportFilename,
  type ExportContents,
} from './export'

const empty: ExportContents = {
  profile: { username: 'ada' },
  trips: [],
  places: [],
  media: [],
  memories: [],
  albums: [],
  posts: [],
  wishlist: [],
  visitedCountries: [],
  visitedRegions: [],
}

const account = {
  id: 'a1',
  email: 'ada@example.com',
  username: 'ada',
  memberSince: '2025-01-01T00:00:00.000Z',
  plan: 'Explorer',
}

describe('countSections', () => {
  it('counts every list, including the empty ones', () => {
    const counts = countSections(empty)
    // A missing key is a bug; a zero is an answer. The reader cannot tell an
    // empty export from a broken one unless every section is present.
    for (const section of EXPORT_SECTIONS) {
      expect(counts[section]).toBe(0)
    }
    expect(Object.keys(counts)).toHaveLength(EXPORT_SECTIONS.length)
  })

  it('does not count the profile, which is one object rather than a list', () => {
    expect(countSections(empty)).not.toHaveProperty('profile')
  })

  it('reports what is actually there', () => {
    const counts = countSections({ ...empty, trips: [{}, {}, {}], posts: [{}] })
    expect(counts.trips).toBe(3)
    expect(counts.posts).toBe(1)
  })
})

describe('buildExport', () => {
  const doc = buildExport({
    account,
    data: { ...empty, trips: [{ id: 't1' }] },
    generatedAt: new Date('2026-08-14T09:30:00.000Z'),
  })

  it('carries enough to be read years later without this codebase', () => {
    expect(doc.format).toBe('travelfreak.export')
    expect(doc.version).toBe(EXPORT_VERSION)
    expect(doc.generatedAt).toBe('2026-08-14T09:30:00.000Z')
    expect(doc.account).toEqual(account)
    expect(doc.readme.length).toBeGreaterThan(0)
  })

  it('says in the file that the photographs themselves are not in the file', () => {
    // The one thing a person could be badly wrong about after deleting their
    // account on the strength of having "exported everything".
    const readme = doc.readme.join(' ')
    expect(readme).toMatch(/not in this document/i)
    expect(readme).toMatch(/storagePath/)
  })

  it('counts match the data it shipped', () => {
    expect(doc.counts.trips).toBe(1)
    expect(doc.data.trips).toHaveLength(1)
  })

  it('survives a round trip through JSON', () => {
    // It is written to a file and read by something else; anything that does
    // not serialise is a section that silently disappears.
    const round = JSON.parse(JSON.stringify(doc))
    expect(round).toEqual(doc)
  })
})

describe('exportFilename', () => {
  it('is dated, so two exports do not overwrite each other', () => {
    expect(exportFilename('ada', new Date('2026-08-14T09:30:00Z'))).toBe(
      'travelfreak-ada-2026-08-14.json'
    )
  })

  it('scrubs anything a filename should not carry', () => {
    expect(exportFilename('../../etc/passwd', new Date('2026-08-14T00:00:00Z'))).toBe(
      'travelfreak-etcpasswd-2026-08-14.json'
    )
  })

  it('falls back rather than producing a nameless file', () => {
    expect(exportFilename('!!!', new Date('2026-08-14T00:00:00Z'))).toBe(
      'travelfreak-account-2026-08-14.json'
    )
  })
})
