import { describe, expect, it } from 'vitest'
import { sanitizePostHtml } from './sanitize'

describe('sanitizePostHtml', () => {
  it('keeps the formatting a post is actually made of', () => {
    const html =
      '<p>Manali to <strong>Leh</strong> over five passes.</p><h2>Day one</h2><ul><li>Rohtang</li></ul>'

    expect(sanitizePostHtml(html)).toBe(html)
  })

  it('drops script tags and their contents', () => {
    const out = sanitizePostHtml('<p>Hi</p><script>fetch("/api/steal")</script>')

    expect(out).toBe('<p>Hi</p>')
  })

  it('strips inline event handlers', () => {
    const out = sanitizePostHtml('<p onclick="alert(1)">Tap</p>')

    expect(out).toBe('<p>Tap</p>')
  })

  it('rejects javascript: and data: urls', () => {
    expect(sanitizePostHtml('<a href="javascript:alert(1)">go</a>')).not.toContain('javascript:')
    // An SVG data URI in an <img> is a script delivery mechanism.
    expect(sanitizePostHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="">')).not.toContain(
      'data:'
    )
  })

  it('hardens outbound links', () => {
    const out = sanitizePostHtml('<a href="https://example.com">example</a>')

    expect(out).toContain('rel="nofollow noopener noreferrer"')
    expect(out).toContain('href="https://example.com"')
  })

  it('removes iframes, styles and forms outright', () => {
    const out = sanitizePostHtml(
      '<iframe src="https://evil.test"></iframe><style>body{display:none}</style>' +
        '<form action="/x"><input name="password"></form><p>text</p>'
    )

    expect(out).toBe('<p>text</p>')
  })

  it('handles empty content', () => {
    expect(sanitizePostHtml('')).toBe('')
  })
})
