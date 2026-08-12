import { CHANGE_KIND_META, type Release } from '@/shared/content/changelog'
import { cn } from '@/shared/utils'
import { InlineMarkdown } from './inline-markdown'

/** `2026-08-12` → `12 August 2026`. Matches the date style used by the reader. */
function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function isUnreleased(release: Release): boolean {
  return release.date === null
}

/**
 * The timeline itself: one vertical rule, one node per release.
 *
 * The rule is a border on the list and each dot sits on it, so the line is
 * continuous however tall a release grows. The last item stops the border rather
 * than the line running past the final release into the footer.
 */
export function ReleaseTimeline({ releases }: { releases: Release[] }) {
  return (
    <ol className="relative">
      {releases.map((release) => (
        <li
          key={release.slug}
          id={release.slug}
          // scroll-mt keeps a deep-linked release clear of the top of the window.
          className="relative scroll-mt-24 border-l border-border pb-14 pl-6 last:border-transparent last:pb-0 sm:pl-10"
        >
          {/* Sits astride the rule; the ring punches a hole in it. */}
          <span
            className={cn(
              'absolute top-1.5 -left-[6px] size-3 rounded-full ring-4 ring-background',
              isUnreleased(release) ? 'bg-globe-planned' : 'bg-primary'
            )}
            aria-hidden
          />

          <article aria-labelledby={`${release.slug}-title`}>
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ring-1 ring-inset',
                    isUnreleased(release)
                      ? 'bg-globe-planned/12 text-foreground ring-globe-planned/30'
                      : 'bg-primary/10 text-primary ring-primary/25'
                  )}
                >
                  {release.version}
                </span>

                {release.date ? (
                  <time
                    dateTime={release.date}
                    className="text-sm text-muted-foreground tabular-nums"
                  >
                    {formatReleaseDate(release.date)}
                  </time>
                ) : (
                  <span className="text-sm text-muted-foreground">In progress</span>
                )}

                <span className="text-sm text-muted-foreground">
                  {release.entryCount} {release.entryCount === 1 ? 'change' : 'changes'}
                </span>
              </div>

              <h2
                id={`${release.slug}-title`}
                className="font-heading text-2xl font-semibold tracking-tight text-balance"
              >
                <a href={`#${release.slug}`} className="hover:underline hover:underline-offset-4">
                  {release.title}
                </a>
              </h2>

              {release.summary && (
                <p className="max-w-2xl text-pretty text-muted-foreground">
                  <InlineMarkdown segments={release.summary} />
                </p>
              )}
            </header>

            <div className="mt-6 space-y-6">
              {release.sections.map((section) => {
                const meta = CHANGE_KIND_META[section.kind]
                return (
                  <section key={section.kind}>
                    <h3
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide uppercase ring-1 ring-inset',
                        meta.badgeClass
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full', meta.dotClass)} aria-hidden />
                      {meta.label}
                    </h3>

                    <ul className="mt-3 space-y-3">
                      {section.entries.map((entry, index) => (
                        <li
                          key={index}
                          className="relative pl-4 text-sm/6 text-pretty text-muted-foreground before:absolute before:top-[0.6rem] before:left-0 before:size-1 before:rounded-full before:bg-border"
                        >
                          {entry.label && (
                            <span className="font-medium text-foreground">{entry.label} — </span>
                          )}
                          <InlineMarkdown segments={entry.body} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          </article>
        </li>
      ))}
    </ol>
  )
}
