import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CHANGE_KINDS,
  ChangelogFormatError,
  parseChangelog,
  parseInline,
  releaseSlug,
  segmentsToText,
  summarizeChangelog,
} from './changelog'

const SAMPLE = `# Changelog

Prose for contributors, ignored by the parser.

\`\`\`md
## 9.9.9 — 2099-01-01 — Not a real release
\`\`\`

## Unreleased — Next up

> Why this exists.
> Second line of the same summary.

### Added

- **Something new** — with a trailing
  wrapped line.

## 0.2.0 — 2026-08-12 — Second

### Fixed

- A plain bullet with \`code\` and a [link](https://example.com).

### Security

- **Locked down** — one entry.

## 0.1.0 — 2026-08-11 — First

### Added

- Groundwork.
`

describe('parseInline', () => {
  it('splits code, bold and links out of the surrounding text', () => {
    expect(parseInline('read `docs` and **stop**')).toEqual([
      { type: 'text', value: 'read ' },
      { type: 'code', value: 'docs' },
      { type: 'text', value: ' and ' },
      { type: 'strong', value: 'stop' },
    ])
  })

  it('keeps link text and link target apart', () => {
    expect(parseInline('see [the plan](/docs/PROJECT_PLAN.md).')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'the plan', href: '/docs/PROJECT_PLAN.md' },
      { type: 'text', value: '.' },
    ])
  })

  it('returns plain text as a single segment', () => {
    expect(parseInline('nothing to see')).toEqual([{ type: 'text', value: 'nothing to see' }])
  })
})

describe('parseChangelog', () => {
  const releases = parseChangelog(SAMPLE)

  it('keeps the order written in the file', () => {
    // Not sorted: a string compare would put 0.9.0 above 0.10.0.
    expect(releases.map((r) => r.version)).toEqual(['Unreleased', '0.2.0', '0.1.0'])
  })

  it('ignores prose and fenced examples above the first release', () => {
    expect(releases.some((r) => r.version === '9.9.9')).toBe(false)
  })

  it('reads version, date and title off the heading', () => {
    expect(releases[1]).toMatchObject({
      version: '0.2.0',
      slug: 'v0-2-0',
      date: '2026-08-12',
      title: 'Second',
    })
  })

  it('allows Unreleased to have no date', () => {
    expect(releases[0].date).toBeNull()
  })

  it('joins a multi-line blockquote into one summary', () => {
    expect(segmentsToText(releases[0].summary ?? [])).toBe(
      'Why this exists. Second line of the same summary.'
    )
  })

  it('pulls the bold label off an entry and keeps the rest as the body', () => {
    const entry = releases[0].sections[0].entries[0]
    expect(entry.label).toBe('Something new')
    expect(segmentsToText(entry.body)).toBe('with a trailing wrapped line.')
  })

  it('leaves an unlabelled entry without a label', () => {
    const entry = releases[1].sections[0].entries[0]
    expect(entry.label).toBeNull()
    expect(segmentsToText(entry.body)).toBe('A plain bullet with code and a link.')
  })

  it('groups entries under their section kind', () => {
    expect(releases[1].sections.map((s) => s.kind)).toEqual(['fixed', 'security'])
  })

  it('counts entries per release', () => {
    expect(releases.map((r) => r.entryCount)).toEqual([1, 2, 1])
  })

  it('rejects a section heading that is not one of the kinds', () => {
    expect(() => parseChangelog('## 1.0.0 — 2026-01-01 — X\n\n### Tweaks\n\n- a\n')).toThrow(
      ChangelogFormatError
    )
  })

  it('rejects a dated release with no date', () => {
    expect(() => parseChangelog('## 1.0.0 — X\n\n### Added\n\n- a\n')).toThrow(ChangelogFormatError)
  })

  it('rejects an entry that is not under a section', () => {
    expect(() => parseChangelog('## 1.0.0 — 2026-01-01 — X\n\n- orphan\n')).toThrow(
      ChangelogFormatError
    )
  })

  it('rejects a release that repeats a section', () => {
    // Two "### Fixed" headings render as two Fixed blocks in one release, which
    // looks like a broken page rather than what it is — an entry added under a
    // new heading instead of the one already there.
    expect(() =>
      parseChangelog(
        '## 1.0.0 — 2026-01-01 — X\n\n### Fixed\n\n- a\n\n### Added\n\n- b\n\n### Fixed\n\n- c\n'
      )
    ).toThrow(/more than one "fixed" section/i)
  })

  it('still allows two releases to each have the same section', () => {
    const releases = parseChangelog(
      '## 1.1.0 — 2026-02-01 — Y\n\n### Fixed\n\n- a\n\n## 1.0.0 — 2026-01-01 — X\n\n### Fixed\n\n- b\n'
    )
    expect(releases.map((r) => r.sections.length)).toEqual([1, 1])
  })
})

describe('releaseSlug', () => {
  it('produces a stable fragment for a version', () => {
    expect(releaseSlug('0.11.0')).toBe('v0-11-0')
    expect(releaseSlug('Unreleased')).toBe('vunreleased')
  })
})

describe('summarizeChangelog', () => {
  it('counts the releases that shipped, and every entry including the uncut ones', () => {
    expect(summarizeChangelog(parseChangelog(SAMPLE))).toEqual({
      // Two, not three: `Unreleased` is a heading, not a release. Cutting a
      // version leaves an empty one at the top, and counting it would announce
      // a release on the day nothing shipped.
      releaseCount: 2,
      // Four: its entry is still a change a reader can see in the product.
      entryCount: 4,
      latestDate: '2026-08-12',
      firstDate: '2026-08-11',
    })
  })
})

/**
 * The real file, which is the point of the strictness above: a malformed entry
 * fails here rather than rendering as a page with a release missing.
 */
describe('docs/CHANGELOG.md', () => {
  const markdown = readFileSync(path.join(process.cwd(), '..', 'docs', 'CHANGELOG.md'), 'utf8')
  const releases = parseChangelog(markdown)

  it('parses', () => {
    expect(releases.length).toBeGreaterThan(0)
  })

  it('has a unique slug per release', () => {
    const slugs = releases.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every shipped release a title and at least one entry', () => {
    // Dated releases only. The `Unreleased` block is legitimately empty and
    // untitled for as long as it takes someone to merge the next thing — that
    // is the state a version cut leaves behind, and failing the suite on it
    // would mean every cut ships broken until it is filled in. What the rule is
    // actually for is a *released* version going out nameless or hollow.
    for (const release of releases.filter((r) => r.date !== null)) {
      expect(release.title, `${release.version} has no title`).not.toBe('')
      expect(release.entryCount, `${release.version} has no entries`).toBeGreaterThan(0)
    }
  })

  it('lists dated releases newest first', () => {
    const dates = releases.map((r) => r.date).filter((d): d is string => d !== null)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('uses only known section kinds', () => {
    for (const release of releases) {
      for (const section of release.sections) {
        expect(CHANGE_KINDS).toContain(section.kind)
      }
    }
  })
})
