import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Check,
  Globe2,
  Heart,
  Images,
  MapPinned,
  Route,
  ShieldCheck,
} from 'lucide-react'
import { BRAND, pageTitle } from '@/shared/brand'
import { DEMO_REGIONS } from '@/client/features/globe/fixtures'
import { HeroGlobe } from '@/client/components/globe/hero-globe'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { RegionLegend } from '@/client/components/globe/region-legend'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'

export const metadata: Metadata = {
  title: pageTitle(),
  description: BRAND.description,
}

const FEATURES = [
  {
    icon: Globe2,
    title: 'A globe that fills in',
    body: 'Every trip you log paints a country. Green for visited, blue for where you are now, yellow for what is planned. Free, at country level, forever.',
  },
  {
    icon: Images,
    title: 'A vault for the memories',
    body: 'Photos, notes, quotes and the places that mattered — pinned to where they happened, not buried in a camera roll.',
  },
  {
    icon: BookOpen,
    title: 'Blogs worth reading',
    body: 'A proper editor with maps, galleries and trip summaries as blocks. Publish publicly or keep it to yourself.',
  },
  {
    icon: Route,
    title: 'Plan the next one',
    body: 'Day-by-day itineraries, budgets that track planned against actual, and packing lists you can reuse.',
  },
  {
    icon: MapPinned,
    title: 'Maps beyond the globe',
    body: 'A 2D world map and state-level tracking for India, so the places you know best are not one flat colour.',
  },
  {
    icon: Heart,
    title: 'A resume for your travels',
    body: 'Countries, cities, distance and years on the road, on a public URL you can actually share.',
  },
]

const PLANS = [
  {
    name: 'Explorer',
    price: '₹0',
    cadence: 'free forever',
    highlights: [
      '15 trips',
      '5 photos per trip',
      '3D globe, country level',
      'Unlimited blogs and notes',
      'Travel resume',
    ],
  },
  {
    name: 'Voyager',
    price: '₹399',
    cadence: 'per month',
    featured: true,
    highlights: [
      'Unlimited trips',
      '200 photos per trip · 30 GB',
      'States and provinces on the globe',
      'Full itinerary and budget',
      '3 collaborators per trip',
    ],
  },
  {
    name: 'Nomad',
    price: '₹799',
    cadence: 'per month',
    highlights: [
      '500 photos per trip · 100 GB',
      'Video and audio diaries',
      'City pins, routes, timeline playback',
      'Unlimited collaborators',
      'Photobook and media export',
    ],
  },
]

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
        <span className="font-semibold tracking-tight">{BRAND.name}</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/register" />}>
            Get started
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-12 md:px-6 lg:grid-cols-2 lg:py-20">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit">
              Your personal travel OS
            </Badge>

            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Every place you have been, on one globe.
            </h1>

            <p className="max-w-lg text-lg text-pretty text-muted-foreground">
              {BRAND.description}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
                Start your globe
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/globe" />}
              >
                See a live one
              </Button>
            </div>

            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden />
              Private by default. No ads, on any plan.
            </p>
          </div>

          {/* The product is the globe, so the hero is the actual component with
              demo data — not a screenshot that can drift from reality. */}
          <div className="relative min-h-[380px] overflow-hidden rounded-xl border bg-gradient-to-b from-sky-50 to-slate-100 lg:min-h-[460px] dark:from-slate-900 dark:to-slate-950">
            <HeroGlobe regions={DEMO_REGIONS} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
              <RegionLegend className="pointer-events-auto w-fit rounded-lg bg-white/85 px-3 py-2 backdrop-blur dark:bg-black/60" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Not another itinerary tool</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Planning is the easy part. What lasts is what you remember — so that is what this is
              built around.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Card className="h-full">
                    <CardContent className="space-y-2 p-5">
                      <Icon className="size-5 text-muted-foreground" aria-hidden />
                      <h3 className="font-medium">{title}</h3>
                      <p className="text-sm text-muted-foreground">{body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Simple pricing</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The globe and unlimited writing are free. You pay for photos, storage and
              collaboration — the parts that cost us money.
            </p>

            <ul className="mt-8 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <li key={plan.name}>
                  <Card className={plan.featured ? 'h-full border-primary' : 'h-full'}>
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{plan.name}</h3>
                          {plan.featured && <Badge>Most popular</Badge>}
                        </div>
                        <p className="mt-2">
                          <span className="text-3xl font-semibold tabular-nums">{plan.price}</span>{' '}
                          <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                        </p>
                      </div>

                      <ul className="space-y-2 text-sm">
                        {plan.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-2">
                            <Check
                              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            {h}
                          </li>
                        ))}
                      </ul>

                      <Button
                        variant={plan.featured ? 'default' : 'outline'}
                        className="mt-auto w-full"
                        nativeButton={false}
                        render={<Link href="/register" />}
                      >
                        {plan.name === 'Explorer' ? 'Start free' : `Choose ${plan.name}`}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <p>
            {BRAND.name} — {BRAND.tagline}
          </p>
          <nav className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/globe" className="hover:text-foreground">
              Globe
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
