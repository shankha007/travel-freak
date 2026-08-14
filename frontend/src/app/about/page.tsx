import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, EyeOff, FileDown, Globe2, Mail, ScrollText, Sparkles } from 'lucide-react'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { RevealGroup, RevealItem } from '@/client/components/motion/reveal'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * About — screen 5.
 *
 * Deliberately about the product and the rules it is built to, not about a team:
 * there is no company story to tell yet, and inventing one is the kind of thing
 * a reader can smell. Every claim on this page is enforced somewhere in the
 * codebase — the privacy default by RLS, the free tier by `plans`, the export by
 * the plan matrix — so nothing here can quietly become untrue.
 */

export const metadata: Metadata = {
  title: 'About',
  description: `Why ${BRAND.name} exists: a travel log built around what you remember, private by default, with no ads on any plan.`,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: 'website',
    title: pageTitle('About'),
    description: 'A personal travel OS built around memories rather than itineraries.',
  },
}

// Nothing on this page is user-specific or read from the database.
export const revalidate = 86400

const PRINCIPLES = [
  {
    icon: EyeOff,
    title: 'Private until you say otherwise',
    body: 'Every trip, photo and post starts private. Publishing is a decision you make per item, and pulling something back really does pull it back — an old share link to a trip you made private resolves to nothing.',
  },
  {
    icon: Sparkles,
    title: 'No ads, on any plan',
    body: 'Including the free one. The paid plans exist to cover photos, storage and collaboration — the parts that cost real money — which is why the globe and unlimited writing do not need to be sold to anyone.',
  },
  {
    icon: FileDown,
    title: 'Your data leaves with you',
    body: 'JSON export is on every plan, free included. Stopping paying returns you to the free limits; it never deletes what you wrote, and a deleted trip sits in the trash for 30 days before it is gone.',
  },
  {
    icon: Globe2,
    title: 'Free where it counts',
    body: 'The globe fills in at country level for nothing, forever, with no trial clock. India is state-level on every plan, because a country you know that well should not be one flat colour.',
  },
]

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${BRAND.name}`,
    url: `${SITE_URL}/about`,
    description: BRAND.description,
  }

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader current="/about" />

      <main className="flex-1">
        <section className="border-b bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-14 md:px-6 lg:py-20">
            <Badge variant="secondary" className="w-fit">
              About
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Built for the part of a trip that lasts.
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              Planning software is a solved problem. What nobody keeps is the rest of it — where you
              actually went, what it looked like, and the thing you would tell a friend about it two
              years later. {BRAND.name} is a place for that, with a map that fills in as you go.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">Why it exists</h2>
              <p className="text-pretty text-muted-foreground">
                A trip usually ends up in four places at once: a folder of photos nobody opens, a
                spreadsheet of bookings, a chat thread, and a scratched map on a wall. None of them
                knows about the others, so the trip stops being one thing the moment it is over.
              </p>
              <p className="text-pretty text-muted-foreground">
                So the unit here is the trip, and everything hangs off it. Places carry pins, so a
                route can be drawn and a distance measured. Photos and notes sit in a vault attached
                to the trip rather than to a date. Posts link back to the trip they are about. And
                the globe is not a decoration on top — it is the same rows, painted.
              </p>
              <p className="text-pretty text-muted-foreground">
                It is also honest about what it does not know. A photo without GPS is placed by the
                dates of the stop it falls in, and said to be a guess. A trip pinned only in part
                measures only the legs it can see. Software that quietly fills in the gaps produces
                a map you cannot trust.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight">What it promises</h2>
              <RevealGroup as="ul" className="mt-4 grid gap-4 sm:grid-cols-2">
                {PRINCIPLES.map(({ icon: Icon, title, body }) => (
                  <RevealItem as="li" key={title}>
                    <Card className="h-full">
                      <CardContent className="space-y-2 p-5">
                        <Icon className="size-5 text-muted-foreground" aria-hidden />
                        <h3 className="font-medium">{title}</h3>
                        <p className="text-sm text-muted-foreground">{body}</p>
                      </CardContent>
                    </Card>
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <ScrollText className="size-5 text-muted-foreground" aria-hidden />
                  Built in the open
                </h2>
                <p className="text-pretty text-muted-foreground">
                  {BRAND.name} is early, and says so. Every release is written up on the public
                  changelog — what shipped, what changed and what was fixed — so you can see the
                  pace and judge it for yourself before trusting it with a decade of photographs.
                </p>
                <Button variant="outline" nativeButton={false} render={<Link href="/changelog" />}>
                  Read the changelog
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>

              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <Mail className="size-5 text-muted-foreground" aria-hidden />
                  Talk to us
                </h2>
                <p className="text-pretty text-muted-foreground">
                  Something broken, something missing, or a country whose states you want mapped
                  next? Use the{' '}
                  <Link
                    href="/contact"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    contact form
                  </Link>
                  , or write to{' '}
                  <a
                    href={`mailto:${BRAND.support.email}`}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {BRAND.support.email}
                  </a>
                  . Both are read by the people who build this, not by a queue.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Start with one trip</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Log somewhere you have already been. The globe paints it, and the rest follows from
                there.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
                Start your globe
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/b" />}>
                Read the blogs
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
