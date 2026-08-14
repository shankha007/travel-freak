import { describe, expect, it } from 'vitest'
import { BRAND } from '@/shared/brand'
import { LEGAL_DOCS, getLegalDoc, relatedLegalDocs, type LegalDoc } from './legal'

/**
 * These pages are rendered from data, so a malformed document is a broken page
 * that nobody would notice until a reader hit it — legal pages get read rarely
 * and usually at the worst moment. The checks below are the ones that would
 * otherwise be caught by a person.
 */

const ids = LEGAL_DOCS.map((d) => d.id)

describe('the legal documents', () => {
  it('are addressable exactly once each', () => {
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(LEGAL_DOCS.map((d) => d.path)).size).toBe(LEGAL_DOCS.length)
  })

  it('are reachable by id, and refuse an unknown one', () => {
    for (const doc of LEGAL_DOCS) expect(getLegalDoc(doc.id)).toBe(doc)
    // @ts-expect-error — the point is what happens when the type is bypassed.
    expect(() => getLegalDoc('cookies')).toThrow()
  })

  it('link to each other and never to themselves', () => {
    for (const doc of LEGAL_DOCS) {
      const related = relatedLegalDocs(doc.id)
      expect(related).toHaveLength(LEGAL_DOCS.length - 1)
      expect(related.map((d) => d.id)).not.toContain(doc.id)
    }
  })

  it.each(LEGAL_DOCS.map((doc): [string, LegalDoc] => [doc.id, doc]))(
    '%s is a well-formed document',
    (_id, doc) => {
      expect(doc.title.length).toBeGreaterThan(0)
      expect(doc.summary.length).toBeGreaterThan(0)
      expect(doc.path).toBe(`/${doc.id}`)
      expect(doc.sections.length).toBeGreaterThan(0)

      // Anchors are what the contents list links to; two sections sharing one
      // would send half the links to the wrong place.
      const sectionIds = doc.sections.map((s) => s.id)
      expect(new Set(sectionIds).size).toBe(sectionIds.length)

      for (const section of doc.sections) {
        expect(section.id).toMatch(/^[a-z0-9-]+$/)
        expect(section.heading.length).toBeGreaterThan(0)
        expect(section.blocks.length).toBeGreaterThan(0)

        for (const block of section.blocks) {
          if (block.kind === 'list') {
            expect(block.items.length).toBeGreaterThan(0)
            for (const item of block.items) expect(item.trim().length).toBeGreaterThan(0)
          } else {
            expect(block.text.trim().length).toBeGreaterThan(0)
          }
        }
      }
    }
  )

  it('state the version they are, as a real date that has already arrived', () => {
    for (const doc of LEGAL_DOCS) {
      expect(doc.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const date = new Date(`${doc.effective}T00:00:00Z`)
      expect(Number.isNaN(date.getTime())).toBe(false)
      // A policy that takes effect next month is a policy nobody has agreed to.
      expect(date.getTime()).toBeLessThanOrEqual(Date.now())
    }
  })

  it('give a reader somewhere to write, in every document', () => {
    // A legal page with no address is a page that cannot be acted on. Both
    // addresses come from `brand.ts`, so a rename does not orphan them.
    for (const doc of LEGAL_DOCS) {
      const text = JSON.stringify(doc)
      const addressed =
        text.includes(BRAND.support.email) || text.includes(BRAND.support.privacyEmail)
      expect(addressed, `${doc.id} names no contact address`).toBe(true)
    }
  })
})
