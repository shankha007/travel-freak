import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Bug, LifeBuoy, ShieldAlert } from 'lucide-react'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import { getSessionUser } from '@/server/auth'
import { ContactForm } from '@/client/components/marketing/contact-form'
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { Reveal, RevealGroup, RevealItem } from '@/client/components/motion/reveal'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Contact — screen 6.
 *
 * Dynamic rather than static, for one reason: a signed-in visitor gets their
 * address filled in. That is worth a request, because the commonest way a bug
 * report becomes unanswerable is a typo in the only field we could have replied
 * to.
 *
 * Outside `PROTECTED` in `proxy.ts`. Requiring an account to report that sign-in
 * is broken would be its own joke.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with the people who build ${BRAND.name} — support, bugs, privacy requests and feedback.`,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    type: 'website',
    title: pageTitle('Contact'),
    description: `Write to the people who build ${BRAND.name}.`,
  },
}

const ROUTES = [
  {
    icon: Bug,
    title: 'Something is broken',
    body: 'Which screen, what you expected, and what happened instead. A screenshot helps. Bugs are usually the fastest thing to get fixed, because they are the clearest thing to reproduce.',
  },
  {
    icon: ShieldAlert,
    title: 'A security issue',
    body: 'Tell us before you tell anyone else, and please do not go looking through other people’s data while you check. We will credit you on the changelog if you would like us to.',
  },
  {
    icon: LifeBuoy,
    title: 'Your data',
    body: 'Export, correction or deletion. Self-service screens are being built; until they land we do these by hand, within 30 days of you asking.',
  },
  {
    icon: BookOpen,
    title: 'Before you write',
    body: 'The changelog says what shipped and when, and the status of a screen marked “soon” is usually there. It is the fastest answer to “is this missing or is it broken?”.',
  },
]

export default async function ContactPage() {
  const user = await getSessionUser()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${BRAND.name}`,
    url: `${SITE_URL}/contact`,
    description: `Get in touch with the people who build ${BRAND.name}.`,
  }

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader current="/contact" />

      <main className="flex-1">
        <section className="border-b bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-12 md:px-6 lg:py-16">
            <Badge variant="secondary" className="w-fit">
              Contact
            </Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Write to the people who build it.
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              There is no ticket queue and no bot in front of us. Messages land in the same inbox
              the developers read, and we answer within about three working days.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <ContactForm defaultEmail={user?.email ?? ''} />
            </Reveal>

            <div className="space-y-8">
              <RevealGroup>
                <RevealItem>
                  <h2 className="text-lg font-semibold tracking-tight">What to send</h2>
                </RevealItem>
                <ul className="mt-4 grid gap-4">
                  {ROUTES.map(({ icon: Icon, title, body }) => (
                    <RevealItem as="li" key={title}>
                      <Card className="h-full">
                        <CardContent className="flex gap-4 p-5">
                          <Icon
                            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div className="space-y-1">
                            <h3 className="font-medium">{title}</h3>
                            <p className="text-sm text-pretty text-muted-foreground">{body}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </RevealItem>
                  ))}
                </ul>
              </RevealGroup>

              <Reveal className="space-y-3 border-t pt-6 text-sm text-muted-foreground">
                <p>
                  Prefer your own mail client? Write to{' '}
                  <a
                    href={`mailto:${BRAND.support.email}`}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {BRAND.support.email}
                  </a>
                  , or{' '}
                  <a
                    href={`mailto:${BRAND.support.privacyEmail}`}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {BRAND.support.privacyEmail}
                  </a>{' '}
                  for anything about your data. Both reach the same people.
                </p>
                <p>
                  What we do with what you send is covered by the{' '}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    privacy policy
                  </Link>
                  : we reply to it, and we do not add you to anything.
                </p>
              </Reveal>
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
