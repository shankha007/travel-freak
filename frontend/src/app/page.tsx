import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
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
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { Reveal, RevealGroup, RevealItem } from '@/client/components/motion/reveal'
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

export default async function Home({ searchParams }: PageProps<'/'>) {
  // Where `deleteAccount` lands. The account is gone by the time this renders,
  // so there is nowhere else to say it — an acknowledgement on a screen behind
  // a login would be a message nobody can reach.
  const { deleted } = await searchParams

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="flex flex-1 flex-col">
        {deleted && (
          <div role="status" className="border-b bg-muted/40 px-4 py-3 text-center text-sm md:px-6">
            Your account and everything in it have been deleted. Thank you for having tried this —
            you are welcome back any time, and you would be starting fresh.
          </div>
        )}

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

            {/* The cards arrive one after another as the grid scrolls in. The
                hero above deliberately does not: it holds the globe and the
                largest text on the page, and animating what a visitor is
                already looking at delays the only thing they came for. */}
            <RevealGroup as="ul" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
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
        </section>

        {/* Pricing lives at /pricing. What belongs here is the one sentence that
            answers "can I afford this?", and a door to the page that details it —
            the tiers themselves were three cards of small print between the
            reader and the sign-up button. */}
        <section className="border-t">
          <Reveal className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Free where it counts
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                The globe, unlimited blogs and your travel resume cost nothing, forever. You pay
                only for photos, storage and collaboration — the parts that cost us money.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/pricing" />}>
                See the plans
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/register" />}
              >
                Start free
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
