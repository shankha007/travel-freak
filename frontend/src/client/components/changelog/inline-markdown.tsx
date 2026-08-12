import Link from 'next/link'
import type { InlineSegment } from '@/shared/content/changelog'

/**
 * Renders the inline markdown the changelog allows.
 *
 * Segments come from the parser already decided, and each one becomes a React
 * node — never a string of HTML. That is the whole reason the parser returns
 * segments: `docs/CHANGELOG.md` is a file in the repository, and a file in the
 * repository should not be one `dangerouslySetInnerHTML` away from the document.
 */
export function InlineMarkdown({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        const key = `${segment.type}-${index}`

        switch (segment.type) {
          case 'strong':
            return (
              <strong key={key} className="font-medium text-foreground">
                {segment.value}
              </strong>
            )

          case 'code':
            return (
              <code
                key={key}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
              >
                {segment.value}
              </code>
            )

          case 'link': {
            const isExternal = /^https?:\/\//.test(segment.href)
            if (isExternal) {
              return (
                <a
                  key={key}
                  href={segment.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {segment.value}
                </a>
              )
            }
            // Only site-absolute paths are routable. A relative link in the
            // markdown points at a file in the repository — meaningful in the
            // diff, meaningless on the page — so it renders as its own text.
            if (!segment.href.startsWith('/')) return <span key={key}>{segment.value}</span>

            return (
              <Link
                key={key}
                href={segment.href}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {segment.value}
              </Link>
            )
          }

          default:
            return <span key={key}>{segment.value}</span>
        }
      })}
    </>
  )
}
