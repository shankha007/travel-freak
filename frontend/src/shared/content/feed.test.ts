import { describe, expect, it } from 'vitest'
import { buildRssFeed, escapeXml, toRfc822, type FeedItem } from '@/shared/content/feed'

/**
 * A feed is published to machines, so the failure mode is not an ugly page — it
 * is a reader that drops the whole document and shows nothing. These are the
 * cases that produce that: an unescaped character from a title somebody wrote,
 * and a date in a format the spec does not name.
 */

const item = (overrides: Partial<FeedItem> = {}): FeedItem => ({
  title: 'Three weeks in Ladakh',
  url: 'https://travelfreak.app/b/three-weeks-in-ladakh',
  description: 'Passes, monasteries and altitude.',
  publishedAt: '2026-08-01T09:30:00.000Z',
  ...overrides,
})

const feed = (items: FeedItem[]) =>
  buildRssFeed({
    title: 'Ada — TravelFreak',
    siteUrl: 'https://travelfreak.app/u/ada',
    feedUrl: 'https://travelfreak.app/u/ada/feed.xml',
    description: 'Posts by Ada.',
    items,
    now: new Date('2026-08-18T00:00:00.000Z'),
  })

describe('escapeXml', () => {
  it('escapes all five predefined entities', () => {
    expect(escapeXml(`Tom & Jerry's <"trip">`)).toBe(
      'Tom &amp; Jerry&apos;s &lt;&quot;trip&quot;&gt;'
    )
  })

  it('escapes the ampersand before anything that introduces one', () => {
    // The classic double-escape bug: run `<` first and its `&lt;` becomes
    // `&amp;lt;`.
    expect(escapeXml('<')).toBe('&lt;')
  })

  it('drops a control character rather than emitting it', () => {
    // A NUL or a vertical tab pasted into a title makes the document
    // unparseable, and a reader drops every item rather than that one.
    expect(escapeXml(`Ladakh${String.fromCharCode(0)}`)).toBe('Ladakh')
    expect(escapeXml(`La${String.fromCharCode(11)}dakh`)).toBe('Ladakh')
  })

  it('keeps the whitespace XML permits', () => {
    expect(escapeXml('a\tb\nc')).toBe('a\tb\nc')
  })

  it('leaves an emoji alone', () => {
    // The strip is over code points, so a surrogate pair must survive intact.
    expect(escapeXml('Ladakh 🏔️')).toBe('Ladakh 🏔️')
  })
})

describe('toRfc822', () => {
  it('formats a date the way pubDate requires', () => {
    expect(toRfc822(new Date('2026-08-01T09:30:00.000Z'))).toBe('Sat, 01 Aug 2026 09:30:00 +0000')
  })

  it('uses a numeric offset, not the word GMT', () => {
    // `toUTCString()` says "GMT", which validators reject.
    expect(toRfc822(new Date('2026-01-05T00:00:00.000Z'))).not.toContain('GMT')
    expect(toRfc822(new Date('2026-01-05T00:00:00.000Z'))).toContain('+0000')
  })

  it('pads a single-digit day and hour', () => {
    expect(toRfc822(new Date('2026-01-05T04:07:09.000Z'))).toBe('Mon, 05 Jan 2026 04:07:09 +0000')
  })
})

describe('buildRssFeed', () => {
  it('declares itself as RSS 2.0 with the self link', () => {
    const xml = feed([item()])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('href="https://travelfreak.app/u/ada/feed.xml" rel="self"')
  })

  it('renders one item per post, with the URL as its guid', () => {
    const xml = feed([item(), item({ url: 'https://travelfreak.app/b/bhutan', title: 'Bhutan' })])
    expect(xml.match(/<item>/g)).toHaveLength(2)
    expect(xml).toContain('<guid isPermaLink="true">https://travelfreak.app/b/bhutan</guid>')
  })

  it('escapes an item title, so one apostrophe cannot break the feed', () => {
    const xml = feed([item({ title: `Ada's <trip> & more` })])
    expect(xml).toContain('<title>Ada&apos;s &lt;trip&gt; &amp; more</title>')
  })

  it('omits pubDate for an undated item rather than inventing one', () => {
    const xml = feed([item({ publishedAt: null })])
    expect(xml).not.toContain('<pubDate>')
    // The channel still needs a build date, and falls back to now.
    expect(xml).toContain('<lastBuildDate>Tue, 18 Aug 2026 00:00:00 +0000</lastBuildDate>')
  })

  it('takes lastBuildDate from the newest item when there is one', () => {
    // Items arrive newest first, so the first dated one is the newest.
    const xml = feed([item(), item({ publishedAt: '2020-01-01T00:00:00.000Z' })])
    expect(xml).toContain('<lastBuildDate>Sat, 01 Aug 2026 09:30:00 +0000</lastBuildDate>')
  })

  it('names an author as dc:creator and never as an email address', () => {
    const xml = feed([item({ author: 'Ada Lovelace' })])
    expect(xml).toContain('<dc:creator>Ada Lovelace</dc:creator>')
    // RSS's own `author` element is defined as an email address; publishing one
    // because a display name was wanted is not a trade anyone agreed to.
    expect(xml).not.toContain('<author>')
  })

  it('is a valid document with no items at all', () => {
    const xml = feed([])
    expect(xml).toContain('<channel>')
    expect(xml).toContain('</rss>')
    expect(xml).not.toContain('<item>')
  })
})
