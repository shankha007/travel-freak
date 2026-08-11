import { describe, expect, it } from 'vitest'
import { countWords, excerptFrom, htmlToText, readingMinutes } from './reading'

describe('htmlToText', () => {
  it('strips tags and keeps the words', () => {
    expect(htmlToText('<p>Manali to <strong>Leh</strong>.</p>')).toBe('Manali to Leh.')
  })

  it('does not glue words across block boundaries', () => {
    // Without the block-boundary handling this reads "oneTwo".
    expect(htmlToText('<p>one</p><p>Two</p>')).toBe('one Two')
    expect(htmlToText('<li>one</li><li>two</li>')).toBe('one two')
    expect(htmlToText('one<br>two')).toBe('one two')
  })

  it('decodes the entities an editor actually emits', () => {
    expect(htmlToText('<p>tea&nbsp;&amp;&nbsp;biscuits</p>')).toBe('tea & biscuits')
  })
})

describe('countWords', () => {
  it('counts words, not spaces', () => {
    expect(countWords('one two three')).toBe(3)
    expect(countWords('')).toBe(0)
  })
})

describe('readingMinutes', () => {
  it('never returns zero for a short post', () => {
    expect(readingMinutes('<p>Still a draft.</p>')).toBe(1)
  })

  it('rounds to the nearest minute at 200 words per minute', () => {
    const words = Array.from({ length: 600 }, () => 'word').join(' ')
    expect(readingMinutes(`<p>${words}</p>`)).toBe(3)
  })

  it('handles empty content', () => {
    expect(readingMinutes('')).toBe(1)
  })
})

describe('excerptFrom', () => {
  it('returns short posts whole', () => {
    expect(excerptFrom('<p>Eleven days up. Four back down.</p>')).toBe(
      'Eleven days up. Four back down.'
    )
  })

  it('cuts on a word boundary and marks the cut', () => {
    const text = Array.from({ length: 60 }, () => 'word').join(' ')
    const out = excerptFrom(`<p>${text}</p>`, 50)

    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(51)
    expect(out).not.toContain('wor…')
  })
})
