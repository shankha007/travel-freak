/**
 * RSS 2.0, built by hand.
 *
 * A feed is four tags and a date format, and every library that generates one
 * brings a dependency to keep current for the sake of a string template. What is
 * genuinely easy to get wrong is the escaping and the date, so both live here and
 * both are tested.
 *
 * RSS rather than Atom because the readers that still exist all take RSS, and
 * because `pubDate` in RFC 822 is the one format a reader will not silently
 * misparse — an ISO 8601 timestamp is valid Atom and is ignored by more than one
 * RSS reader, which shows the whole feed as undated rather than as broken.
 */

export interface FeedItem {
  title: string
  /** Absolute URL. Doubles as the item's guid. */
  url: string
  /** Plain text, not HTML — an excerpt rather than the post. */
  description: string
  /** ISO timestamp, or null for an item whose date is unknown. */
  publishedAt: string | null
  /** Shown as the item's author when the profile is public enough to name. */
  author?: string
}

export interface FeedOptions {
  title: string
  /** The page a reader should open, not the feed's own URL. */
  siteUrl: string
  /** The feed's own absolute URL, for `atom:link rel="self"`. */
  feedUrl: string
  description: string
  items: FeedItem[]
  /** Overridable so a test is not a statement about today. */
  now?: Date
}

/**
 * Drops the control characters XML 1.0 cannot represent at all.
 *
 * A strip rather than an escape, because there is nothing to escape them to — and
 * it matters more than it sounds: one stray character from a paste makes the
 * whole document unparseable and takes every item in the feed down with it.
 *
 * Written as a loop over code points rather than a regex, so the range is stated
 * in hex that a reader can check rather than as literal bytes in the source.
 */
function stripForbiddenXmlChars(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) as number
    // Tab, newline and carriage return are the three C0 characters XML 1.0
    // permits, so they are the three exceptions.
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue
    out += char
  }
  return out
}

/**
 * Escapes text for an XML text node or attribute.
 *
 * All five predefined entities, not the three that usually suffice: a post title
 * containing an apostrophe is common, and a feed that emits a raw one inside an
 * attribute is malformed rather than merely ugly.
 */
export function escapeXml(value: string): string {
  return stripForbiddenXmlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * RFC 822, as `pubDate` requires.
 *
 * Written out rather than taken from `toUTCString()`, which produces "GMT" where
 * RFC 822 asks for a numeric offset — accepted by most readers and rejected by
 * validators, which is a bug report waiting to happen. The day and month names
 * are the English abbreviations the format specifies, so they are listed here
 * rather than localised: a locale-aware month name would make the feed
 * unparseable on a server set to another language.
 */
export function toRfc822(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ` +
    `${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())} +0000`
  )
}

/** Renders the document. Pure, so `feed.test.ts` can assert on every part of it. */
export function buildRssFeed({
  title,
  siteUrl,
  feedUrl,
  description,
  items,
  now = new Date(),
}: FeedOptions): string {
  const entries = items.map((item) => {
    const parts = [
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.url)}</link>`,
      // The URL is the guid, and `isPermaLink="true"` says so. A slug change
      // therefore reads as a new item, which is the right trade: the alternative
      // is exposing a database id in a public document forever.
      `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
      `      <description>${escapeXml(item.description)}</description>`,
    ]
    // Omitted rather than guessed: an undated item is shown as undated, where a
    // fabricated date would reorder somebody's writing.
    if (item.publishedAt) {
      parts.push(`      <pubDate>${toRfc822(new Date(item.publishedAt))}</pubDate>`)
    }
    // `dc:creator`, not `author` — the RSS `author` element is defined as an
    // email address, and publishing one because a display name was wanted is not
    // a trade anyone agreed to.
    if (item.author) {
      parts.push(`      <dc:creator>${escapeXml(item.author)}</dc:creator>`)
    }
    return `    <item>\n${parts.join('\n')}\n    </item>`
  })

  const newest = items.find((i) => i.publishedAt)?.publishedAt

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <lastBuildDate>${toRfc822(newest ? new Date(newest) : now)}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${entries.join('\n')}
  </channel>
</rss>
`
}
