'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Minus, Sparkles } from 'lucide-react'
import type { PublicPlan } from '@/server/queries/plans'
import {
  COMPARISON,
  annualSavingPercent,
  formatPrice,
  monthlyEquivalent,
  planHighlights,
  type FeatureValue,
} from '@/shared/pricing'
import { cn } from '@/shared/utils'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'

/**
 * The pricing cards and the comparison table.
 *
 * Client-side only for the monthly/annual switch — everything shown is computed
 * from the `plans` rows the server passed in, never fetched here. The plan a
 * card describes and the plan the server enforces are the same row.
 *
 * The tier that is highlighted is not hardcoded: it is the cheapest paid plan,
 * so a new middle tier becomes the recommendation without anyone remembering to
 * move a flag.
 */

type Billing = 'monthly' | 'annual'

export function PricingTable({ plans }: { plans: PublicPlan[] }) {
  const [billing, setBilling] = useState<Billing>('monthly')

  const paid = plans.filter((p) => p.priceInr > 0)
  const featuredCode = paid.length ? paid[0].code : null
  const anyAnnual = plans.some((p) => p.priceInrYearly > 0)

  return (
    <div className="space-y-14">
      {anyAnnual && <BillingSwitch value={billing} onChange={setBilling} plans={plans} />}

      <ul className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            billing={billing}
            featured={plan.code === featuredCode}
          />
        ))}
      </ul>

      <Comparison plans={plans} />
    </div>
  )
}

function BillingSwitch({
  value,
  onChange,
  plans,
}: {
  value: Billing
  onChange: (value: Billing) => void
  plans: PublicPlan[]
}) {
  // The largest saving on offer, so the nudge is a fact rather than a promise.
  const best = plans.reduce<number | null>((best, plan) => {
    const saving = annualSavingPercent(plan.priceInr, plan.priceInrYearly)
    return saving !== null && (best === null || saving > best) ? saving : best
  }, null)

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="inline-flex rounded-full border bg-muted/50 p-1"
      >
        {(['monthly', 'annual'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              value === option
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {best !== null && (
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="size-3" aria-hidden />
          Save up to {best}% annually
        </Badge>
      )}
    </div>
  )
}

function PlanCard({
  plan,
  billing,
  featured,
}: {
  plan: PublicPlan
  billing: Billing
  featured: boolean
}) {
  const isFree = plan.priceInr === 0
  const annual = billing === 'annual' && plan.priceInrYearly > 0

  // On the annual tab the headline stays a monthly number, with the billed
  // total underneath: comparing ₹3,499 to ₹399 is not a comparison anyone
  // wants to do in their head.
  const headline = annual
    ? (monthlyEquivalent(plan.priceInrYearly, 'INR') ?? formatPrice(plan.priceInr, 'INR'))
    : formatPrice(plan.priceInr, 'INR')

  const saving = annualSavingPercent(plan.priceInr, plan.priceInrYearly)

  return (
    <li>
      <div
        className={cn(
          'relative flex h-full flex-col gap-6 rounded-2xl border p-6 transition-shadow',
          featured
            ? 'border-primary/60 bg-card shadow-lg ring-1 shadow-primary/10 ring-primary/20'
            : 'bg-card/60 hover:shadow-md'
        )}
      >
        {featured && <Badge className="absolute -top-2.5 left-6">Most popular</Badge>}

        <div>
          <h3 className="font-heading text-lg font-semibold">{plan.name}</h3>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{headline}</span>
            <span className="text-sm text-muted-foreground">
              {isFree ? 'free forever' : 'per month'}
            </span>
          </p>
          <p className="mt-1 min-h-5 text-xs text-muted-foreground">
            {annual && !isFree
              ? `${formatPrice(plan.priceInrYearly, 'INR')} billed yearly${saving ? ` · ${saving}% off` : ''}`
              : !isFree
                ? 'Billed monthly. Cancel whenever.'
                : 'No card, no trial clock.'}
          </p>
        </div>

        <ul className="space-y-2.5 text-sm">
          {planHighlights(plan.limits).map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <Button
          variant={featured ? 'default' : 'outline'}
          className="mt-auto w-full"
          nativeButton={false}
          render={<Link href="/register" />}
        >
          {isFree ? 'Start free' : `Choose ${plan.name}`}
        </Button>
      </div>
    </li>
  )
}

function Comparison({ plans }: { plans: PublicPlan[] }) {
  return (
    <section aria-labelledby="compare" className="space-y-5">
      <div>
        <h2 id="compare" className="font-heading text-2xl font-semibold tracking-tight">
          Compare every plan
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every number here is the limit the app actually enforces, read from the same place the
          server reads it.
        </p>
      </div>

      {/* The table scrolls inside itself rather than pushing the page sideways. */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <caption className="sr-only">Feature comparison across plans</caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="p-3 text-left font-medium">
                Feature
              </th>
              {plans.map((plan) => (
                <th key={plan.code} scope="col" className="p-3 text-left font-medium">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>

          {COMPARISON.map((group) => (
            <tbody key={group.title}>
              <tr className="border-b bg-muted/20">
                <th
                  scope="colgroup"
                  colSpan={plans.length + 1}
                  className="p-3 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  {group.title}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <th scope="row" className="p-3 text-left font-normal">
                    {row.label}
                    {row.hint && (
                      <span className="block text-xs text-muted-foreground">{row.hint}</span>
                    )}
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.code} className="p-3 align-top">
                      <Cell value={row.value(plan.limits)} plan={plan.name} feature={row.label} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}

/** A tick is not readable text, so every cell carries a screen-reader label. */
function Cell({ value, plan, feature }: { value: FeatureValue; plan: string; feature: string }) {
  if (value.kind === 'text') return <span className="tabular-nums">{value.text}</span>

  const included = value.kind === 'yes'
  return (
    <>
      {included ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Minus className="size-4 text-muted-foreground/60" aria-hidden />
      )}
      <span className="sr-only">
        {feature} {included ? 'is included in' : 'is not included in'} {plan}
      </span>
    </>
  )
}
