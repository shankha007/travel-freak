/**
 * Parser for `docs/CHANGELOG.md`.
 *
 * The markdown file is the source of truth for release history — it is what a
 * contributor edits and what review sees in a diff. This turns it into typed
 * data so `/changelog` can render a real timeline instead of a wall of prose,
 * and so a malformed entry fails a test rather than shipping as a page that
 * quietly drops a release.
 *
 * Deliberately strict: an unrecognised section heading throws. The alternative
 * is silently swallowing a change nobody notices is missing until a user asks
 * where it went. The format is documented in the file it parses.
 *
 * Pure and dependency-free, so it runs in a unit test without a filesystem.
 */

/** The kinds of change a release can contain. The set is closed on purpose. */
export const CHANGE_KINDS = [
  'added',
  'changed',
  'fixed',
  'removed',
  'security',
  'infrastructure',
] as const

export type ChangeKind = (typeof CHANGE_KINDS)[number]

export interface ChangeKindMeta {
  /** Heading as written in the markdown, and the label shown on the page. */
  label: string
  /** Tailwind classes for the section pill. */
  badgeClass: string
  /** Tailwind class for the dot that precedes the label. */
  dotClass: string
  /** One-line explanation, used in the page's legend. */
  description: string
}

/**
 * Colour and copy for each kind.
 *
 * Same accessibility contract as the globe's region states: the colour is
 * supporting detail and the label always renders, because "green means new" is
 * not information anyone can rely on.
 */
export const CHANGE_KIND_META: Record<ChangeKind, ChangeKindMeta> = {
  added: {
    label: 'Added',
    badgeClass: 'bg-change-added/12 text-change-added ring-change-added/25',
    dotClass: 'bg-change-added',
    description: 'Something that did not exist before.',
  },
  changed: {
    label: 'Changed',
    badgeClass: 'bg-change-changed/12 text-change-changed ring-change-changed/25',
    dotClass: 'bg-change-changed',
    description: 'Existing behaviour that now works differently.',
  },
  fixed: {
    label: 'Fixed',
    badgeClass: 'bg-change-fixed/12 text-change-fixed ring-change-fixed/25',
    dotClass: 'bg-change-fixed',
    description: 'A bug that was reachable from the product.',
  },
  removed: {
    label: 'Removed',
    badgeClass: 'bg-change-removed/12 text-change-removed ring-change-removed/25',
    dotClass: 'bg-change-removed',
    description: 'Something taken away, and what replaces it.',
  },
  security: {
    label: 'Security',
    badgeClass: 'bg-change-security/12 text-change-security ring-change-security/25',
    dotClass: 'bg-change-security',
    description: 'Anything affecting what other people can see.',
  },
  infrastructure: {
    label: 'Infrastructure',
    badgeClass: 'bg-change-infra/12 text-change-infra ring-change-infra/25',
    dotClass: 'bg-change-infra',
    description: 'Groundwork with no screen of its own.',
  },
}

/** A run of inline markdown, already decided so the page never parses text. */
export type InlineSegment =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string }

export interface ChangeEntry {
  /** Leading `**Label** —`, pulled out for typography. Null when absent. */
  label: string | null
  /** The rest of the bullet. */
  body: InlineSegment[]
}

export interface ChangeSection {
  kind: ChangeKind
  entries: ChangeEntry[]
}

export interface Release {
  /** `0.11.0`, or `Unreleased` for work merged but not yet cut. */
  version: string
  /** URL fragment for deep-linking a release. */
  slug: string
  /** ISO `YYYY-MM-DD`, or null for an undated `Unreleased` block. */
  date: string | null
  /** Short name for the release. Empty string when the heading has none. */
  title: string
  /** The blockquote under the heading, if there is one. */
  summary: InlineSegment[] | null
  sections: ChangeSection[]
  /** Total entries across every section. */
  entryCount: number
}

/** Raised for anything the format does not allow, with the offending line. */
export class ChangelogFormatError extends Error {
  constructor(message: string, line: number) {
    super(`${message} (docs/CHANGELOG.md line ${line})`)
    this.name = 'ChangelogFormatError'
  }
}

const RELEASE_HEADING = /^##\s+(.+?)\s*$/
const SECTION_HEADING = /^###\s+(.+?)\s*$/
const BULLET = /^[-*]\s+(.+?)\s*$/
const CONTINUATION = /^\s{2,}(\S.*?)\s*$/
const QUOTE = /^>\s?(.*?)\s*$/
const FENCE = /^\s*```/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** Everything above this marker is prose for contributors, not release history. */
const RELEASES_MARKER = /^<!--\s*releases\s*-->\s*$/
/** `**Label** — body`, with an em dash, hyphen or colon as the separator. */
const LABELLED = /^\*\*(.+?)\*\*\s*(?:[—–-]|:)\s*(.*)$/
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

/** Lower-cases and hyphenates a version into a stable fragment. */
export function releaseSlug(version: string): string {
  return `v${version
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

/**
 * Splits a line of markdown into the four inline forms the changelog uses.
 *
 * Returning segments rather than HTML is the point: the page renders React
 * nodes, so no part of this file can inject markup into the document.
 */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(INLINE)) {
    const start = match.index
    if (start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, start) })
    }

    const [full, code, strong, linkText, href] = match
    if (code !== undefined) segments.push({ type: 'code', value: code })
    else if (strong !== undefined) segments.push({ type: 'strong', value: strong })
    else if (linkText !== undefined && href !== undefined) {
      segments.push({ type: 'link', value: linkText, href })
    }

    cursor = start + full.length
  }

  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) })
  return segments
}

/** Reads `0.11.0 — 2026-08-12 — Public trip pages` off a `##` heading. */
function parseReleaseHeading(
  heading: string,
  line: number
): { version: string; date: string | null; title: string } {
  const parts = heading
    .split('—')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const [version, ...rest] = parts
  if (!version) throw new ChangelogFormatError('Release heading has no version', line)

  const date = rest[0] && ISO_DATE.test(rest[0]) ? rest.shift()! : null
  if (date === null && version.toLowerCase() !== 'unreleased') {
    throw new ChangelogFormatError(`Release ${version} has no YYYY-MM-DD date`, line)
  }

  return { version, date, title: rest.join(' — ') }
}

function parseSectionHeading(heading: string, line: number): ChangeKind {
  const kind = heading.trim().toLowerCase()
  if (!(CHANGE_KINDS as readonly string[]).includes(kind)) {
    throw new ChangelogFormatError(
      `Unknown section "${heading}". Use one of: ${CHANGE_KINDS.join(', ')}`,
      line
    )
  }
  return kind as ChangeKind
}

function toEntry(raw: string): ChangeEntry {
  const labelled = LABELLED.exec(raw)
  if (labelled) {
    return { label: labelled[1], body: parseInline(labelled[2]) }
  }
  return { label: null, body: parseInline(raw) }
}

/**
 * Parses the whole file into releases, newest first.
 *
 * Order is taken from the file and never sorted. Version numbers are strings
 * that only look like semver — sorting them would put 0.9.0 above 0.10.0, and a
 * page whose order depends on a comparison nobody can see is worse than one
 * where the diff shows the order.
 *
 * History starts at the `<!-- releases -->` marker, so the file can open with
 * headed prose explaining how to write an entry. Fenced code blocks are ignored
 * throughout — that is where the format documents itself, and an example heading
 * must not read as a real release.
 */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = []
  const all = markdown.split(/\r?\n/)
  const markerAt = all.findIndex((line) => RELEASES_MARKER.test(line))
  const lines = markerAt === -1 ? all : all.slice(markerAt + 1)

  let release: (Release & { sections: ChangeSection[] }) | null = null
  let section: ChangeSection | null = null
  let summary: string[] = []
  let inFence = false

  const closeRelease = () => {
    if (!release) return
    release.summary = summary.length > 0 ? parseInline(summary.join(' ')) : null
    release.entryCount = release.sections.reduce((n, s) => n + s.entries.length, 0)
    releases.push(release)
  }

  const lineOffset = markerAt === -1 ? 0 : markerAt + 1

  lines.forEach((text, index) => {
    // Reported against the real file, not the slice, or the number is useless.
    const line = lineOffset + index + 1

    if (FENCE.test(text)) {
      inFence = !inFence
      return
    }
    if (inFence) return

    // `\s+` after `##` is what keeps this from matching a `###` section.
    const releaseHeading = RELEASE_HEADING.exec(text)
    if (releaseHeading) {
      const { version, date, title } = parseReleaseHeading(releaseHeading[1], line)
      closeRelease()
      release = {
        version,
        slug: releaseSlug(version),
        date,
        title,
        summary: null,
        sections: [],
        entryCount: 0,
      }
      section = null
      summary = []
      return
    }

    // Outside a release the remaining forms are contributor prose, not content.
    if (!release) return

    const sectionHeading = SECTION_HEADING.exec(text)
    if (sectionHeading) {
      const kind = parseSectionHeading(sectionHeading[1], line)
      section = { kind, entries: [] }
      release.sections.push(section)
      return
    }

    const quote = QUOTE.exec(text)
    if (quote) {
      // A blockquote after the first section would be a stray line, not a summary.
      if (section) throw new ChangelogFormatError('Summary must precede the sections', line)
      if (quote[1].length > 0) summary.push(quote[1])
      return
    }

    const bullet = BULLET.exec(text)
    if (bullet) {
      if (!section) {
        throw new ChangelogFormatError(
          `Entry outside a section in release ${release.version}`,
          line
        )
      }
      section.entries.push(toEntry(bullet[1]))
      return
    }

    // Wrapped bullet: markdown joins it to the entry above, so we do too.
    const continuation = CONTINUATION.exec(text)
    if (continuation && section && section.entries.length > 0) {
      const previous = section.entries[section.entries.length - 1]
      const extra = parseInline(` ${continuation[1]}`)
      previous.body = mergeSegments(previous.body, extra)
    }
  })

  closeRelease()
  return releases
}

/** Joins two segment runs, coalescing text so wrapped prose stays one node. */
function mergeSegments(left: InlineSegment[], right: InlineSegment[]): InlineSegment[] {
  const last = left[left.length - 1]
  const first = right[0]
  if (last?.type === 'text' && first?.type === 'text') {
    return [
      ...left.slice(0, -1),
      { type: 'text', value: last.value + first.value },
      ...right.slice(1),
    ]
  }
  return [...left, ...right]
}

/** Flattens segments back to plain text, for metadata and OG descriptions. */
export function segmentsToText(segments: InlineSegment[]): string {
  return segments.map((s) => s.value).join('')
}

export interface ChangelogSummary {
  releaseCount: number
  entryCount: number
  /** Newest dated release, ignoring an undated `Unreleased` block. */
  latestDate: string | null
  firstDate: string | null
}

export function summarizeChangelog(releases: Release[]): ChangelogSummary {
  const dates = releases.map((r) => r.date).filter((d): d is string => d !== null)
  return {
    releaseCount: releases.length,
    entryCount: releases.reduce((n, r) => n + r.entryCount, 0),
    latestDate: dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    firstDate: dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null,
  }
}
