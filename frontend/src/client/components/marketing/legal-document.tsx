import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import type { LegalBlock, LegalDoc } from '@/shared/content/legal'
import { relatedLegalDocs } from '@/shared/content/legal'
import { Reveal } from '@/client/components/motion/reveal'
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'

/**
 * One renderer for all three legal documents — screen 11.
 *
 * A server component: the documents are constants, so there is nothing to fetch
 * and nothing per-visitor. The only client islands are the reveals, and the
 * `<noscript>` rule in the root layout means a reader without JavaScript still
 * gets the whole document.
 *
 * The layout is a two-column reading page with a sticky contents list, because
 * these are documents people arrive at with one question — "what happens to my
 * photos" — and scrolling a wall of headings to find it is the failure mode.
 */

/** The `<head>` for a legal route, derived from the document itself. */
export function legalMetadata(doc: LegalDoc): Metadata {
  return {
    title: doc.title,
    description: doc.summary,
    alternates: { canonical: `${SITE_URL}${doc.path}` },
    openGraph: {
      type: 'article',
      title: pageTitle(doc.title),
      description: doc.summary,
    },
  }
}

function formatEffective(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'list') {
    return (
      <ul className="ml-5 list-disc space-y-2 text-pretty text-muted-foreground">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  if (block.kind === 'note') {
    return (
      // Set apart deliberately: these are the paragraphs that say what the
      // software does *not* do yet, and they are the ones a skimming reader
      // most needs to see.
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-pretty dark:border-amber-900/60 dark:bg-amber-950/30">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
        <p>{block.text}</p>
      </div>
    )
  }

  return <p className="text-pretty text-muted-foreground">{block.text}</p>
}

export function LegalDocumentPage({ doc }: { doc: LegalDoc }) {
  const related = relatedLegalDocs(doc.id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: doc.title,
    url: `${SITE_URL}${doc.path}`,
    description: doc.summary,
    dateModified: doc.effective,
    isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
  }

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader current={doc.path} />

      <main className="flex-1">
        <section className="border-b bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-12 md:px-6 lg:py-16">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="w-fit">
                Legal
              </Badge>
              {/* A policy with no date is a policy that can be rewritten
                  quietly, so the version is stated where it cannot be missed. */}
              <span className="text-sm text-muted-foreground">
                In effect since {formatEffective(doc.effective)}
              </span>
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {doc.title}
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{doc.summary}</p>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="order-2 max-w-2xl space-y-10 lg:order-1">
            {doc.sections.map((section) => (
              <Reveal key={section.id} id={section.id} className="scroll-mt-20">
                <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
                <div className="mt-3 space-y-4">
                  {section.blocks.map((block, index) => (
                    <Block key={index} block={block} />
                  ))}
                </div>
              </Reveal>
            ))}

            <div className="border-t pt-8">
              <h2 className="text-lg font-semibold tracking-tight">The other two</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These documents refer to each other, so none of them is the whole story on its own.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {related.map((other) => (
                  <Button
                    key={other.id}
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={other.path} />}
                  >
                    {other.title}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                ))}
                <Button variant="ghost" nativeButton={false} render={<Link href="/contact" />}>
                  Ask a question
                </Button>
              </div>
            </div>
          </div>

          {/* Contents. A `<nav>` rather than a styled list, so a screen reader
              can jump to it, and first in the DOM on a phone where the sticky
              column collapses to a header.

              On a phone the list itself scrolls inside a capped box: eleven
              headings at full height push the document most of a screen down,
              which is a table of contents charging rent on the thing it indexes.
              A fixed height rather than a disclosure, because a `<details>` that
              has to be open on desktop and shut on mobile cannot be expressed
              without JavaScript. */}
          <nav aria-label="On this page" className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-20">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                On this page
              </p>
              <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto text-sm lg:max-h-none lg:overflow-visible">
                {doc.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </main>

      <MarketingFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
