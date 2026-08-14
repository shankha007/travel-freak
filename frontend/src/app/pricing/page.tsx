import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import { SITE_OG_IMAGE } from '@/shared/og'
import { getPublicPlans } from '@/server/queries/plans'
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { PricingTable } from '@/client/components/pricing/pricing-table'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'

/**
 * Pricing — screen 3.
 *
 * Its own page rather than a band on the landing page, because pricing is a
 * destination: people arrive at it from the nav, from an upgrade prompt inside
 * the app, and from a link someone sent them. A section three screens down the
 * home page is none of those things.
 *
 * The numbers come from `plans`, which is also what `entitlements.ts` enforces
 * against. The previous copy was hand-written on the landing page and could
 * disagree with the database without anything failing.
 */

export const metadata: Metadata = {
  title: 'Pricing',
  description: `What ${BRAND.name} costs: the globe and unlimited writing are free, and you pay for photos, storage and collaboration.`,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    type: 'website',
    title: pageTitle('Pricing'),
    description: 'Free forever at country level. Paid plans add photos, storage and detail.',
    images: [SITE_OG_IMAGE],
  },
}

// Prices change rarely, so the page is cached and rebuilt hourly rather than
// queried per visitor. Nothing on it is user-specific.
export const revalidate = 3600

const FAQ = [
  {
    q: 'What happens to my trips if I stop paying?',
    a: 'Nothing is deleted. Your account returns to Explorer limits: everything stays readable and exportable, and you simply cannot add beyond the free allowance until you upgrade again.',
  },
  {
    q: 'Is the globe really free?',
    a: 'Yes, at country level, with no trial clock. Paid plans add subdivision detail — states and provinces — everywhere. India is state-level on every plan.',
  },
  {
    q: 'Who can see my trips?',
    a: 'Nobody, until you say so. Every trip is private by default; you choose per trip whether it is private, unlisted behind a link, or public.',
  },
  {
    q: 'Can I export my data?',
    a: 'JSON export is on every plan, including the free one. Paid plans add PDF and a full media archive.',
  },
]

export default async function PricingPage() {
  const plans = await getPublicPlans()

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader current="/pricing" />

      <main className="flex-1">
        <section className="border-b bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 lg:py-20">
            <Badge variant="secondary" className="w-fit">
              Pricing
            </Badge>

            <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Free where it counts. Paid where it costs us.
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
              The globe, unlimited blogs and your travel resume cost nothing, forever. Photos,
              storage and collaboration are what you pay for — because they are what we pay for.
            </p>

            <p className="mt-6 flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden />
              Private by default. No ads, on any plan.
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 lg:py-16">
          {plans.length > 0 ? (
            <PricingTable plans={plans} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Plans could not be loaded just now. Everything on the free tier is still free —{' '}
              <Link href="/register" className="underline">
                start there
              </Link>
              .
            </p>
          )}
        </div>

        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-3xl px-4 py-14 md:px-6">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Questions worth answering first
            </h2>

            <dl className="mt-8 space-y-6">
              {FAQ.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-medium">{q}</dt>
                  <dd className="mt-1.5 text-sm text-muted-foreground">{a}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
                Start free
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/" />}>
                What this is
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
