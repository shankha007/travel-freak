import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, GitCommitVertical, Rocket, Sparkles } from 'lucide-react'
import { getReleases } from '@/server/content/changelog'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import { SITE_OG_IMAGE } from '@/shared/og'
import {
  CHANGE_KINDS,
  CHANGE_KIND_META,
  summarizeChangelog,
  type Release,
} from '@/shared/content/changelog'
import { cn } from '@/shared/utils'
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { ReleaseIndex } from '@/client/components/changelog/release-index'
import { ReleaseTimeline } from '@/client/components/changelog/release-timeline'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'

/**
 * Public changelog.
 *
 * Statically rendered: the content is a committed file, not a query, so there is
 * nothing per-visitor about it and no reason for a request to touch the database
 * or the filesystem. A release ships when `docs/CHANGELOG.md` ships.
 *
 * Deliberately outside the authenticated shell and outside `PROTECTED` in
 * `proxy.ts` — the changelog is a reason to sign up, so it cannot need an account.
 */
export const dynamic = 'force-static'

export const metadata: Metadata = {
  // The root layout's template appends the brand name; only Open Graph, which has
  // no template, spells the full title out.
  title: 'Changelog',
  description: `Everything shipped in ${BRAND.name}, newest first — new features, changes and fixes.`,
  alternates: { canonical: `${SITE_URL}/changelog` },
  openGraph: {
    type: 'website',
    title: pageTitle('Changelog'),
    description: `Everything shipped in ${BRAND.name}, newest first.`,
    images: [SITE_OG_IMAGE],
  },
}

function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** The few numbers worth stating before anyone starts scrolling. */
function Stats({ releases }: { releases: Release[] }) {
  const { releaseCount, entryCount, latestDate, firstDate } = summarizeChangelog(releases)

  const stats = [
    {
      icon: Rocket,
      value: String(releaseCount),
      label: releaseCount === 1 ? 'release' : 'releases',
    },
    { icon: GitCommitVertical, value: String(entryCount), label: 'changes shipped' },
    ...(latestDate
      ? [{ icon: Sparkles, value: null, label: `last shipped ${formatMonth(latestDate)}` }]
      : []),
    // Only worth saying once the history spans more than the month it started in.
    ...(firstDate && latestDate && formatMonth(firstDate) !== formatMonth(latestDate)
      ? [{ icon: CalendarDays, value: null, label: `building since ${formatMonth(firstDate)}` }]
      : []),
  ]

  return (
    <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
      {stats.map(({ icon: Icon, value, label }) => (
        <li key={label} className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
          {value && <span className="text-lg font-semibold tabular-nums">{value}</span>}
          <span className="text-sm text-muted-foreground">{label}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Key for the section colours.
 *
 * Same rule as the globe legend: the colour is never the only signal, so the
 * label is always next to it — here and on every entry.
 */
function KindLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {CHANGE_KINDS.map((kind) => {
        const meta = CHANGE_KIND_META[kind]
        return (
          <li key={kind} className="flex items-center gap-1.5" title={meta.description}>
            <span className={cn('size-2 rounded-full', meta.dotClass)} aria-hidden />
            <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default async function ChangelogPage() {
  const releases = await getReleases()

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader current="/changelog" />

      <main className="flex-1">
        {/* Hero. The gradient is the same sky-to-slate pair as the landing globe,
            so the two pages read as one product. */}
        <section className="border-b bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 lg:py-20">
            <Badge variant="secondary" className="w-fit">
              Shipping log
            </Badge>

            <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Every change, in the order it happened.
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
              {BRAND.name} is built in the open. This is the whole history — features, the behaviour
              behind them, and the bugs that were worth telling you about.
            </p>

            <div className="mt-8">
              <Stats releases={releases} />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button nativeButton={false} render={<Link href="/register" />}>
                Start your globe
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
                What this is
              </Button>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 lg:py-16">
          <div className="mb-10 border-b pb-6">
            <KindLegend />
          </div>

          <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
            <ReleaseIndex releases={releases} />
            <ReleaseTimeline releases={releases} />
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
