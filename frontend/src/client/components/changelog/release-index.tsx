import type { Release } from '@/shared/content/changelog'
import { cn } from '@/shared/utils'

/**
 * Sticky list of releases beside the timeline.
 *
 * Plain fragment links, so it works before any JavaScript arrives and each
 * release stays copy-pasteable as a URL. Hidden below `lg` — on a phone the
 * timeline is the index.
 */
export function ReleaseIndex({ releases }: { releases: Release[] }) {
  return (
    <nav aria-label="Releases" className="hidden lg:block">
      <div className="sticky top-10">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Releases
        </p>
        <ul className="mt-3 space-y-0.5 border-l border-border">
          {releases.map((release) => (
            <li key={release.slug}>
              <a
                href={`#${release.slug}`}
                className={cn(
                  '-ml-px flex flex-col gap-0.5 border-l-2 border-transparent py-1.5 pl-3 text-sm transition-colors',
                  'hover:border-primary/40 hover:text-foreground'
                )}
              >
                <span className="font-mono text-xs text-muted-foreground">{release.version}</span>
                <span className="truncate text-foreground/80">{release.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
