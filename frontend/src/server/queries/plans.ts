import 'server-only'

import { cache } from 'react'
import { createClient } from '@/server/supabase/server'
import type { PlanLimitsShape } from '@/shared/pricing'

/**
 * The plans behind the public pricing page.
 *
 * Readable by anyone — `plans` is the one table with an anon read policy,
 * because the prices are the product's shop window. Nothing here is
 * user-scoped, so the same rows serve a signed-out visitor and the upgrade
 * prompts inside the app.
 */

export interface PublicPlan {
  code: string
  name: string
  /** Minor units: 39900 is ₹399. */
  priceInr: number
  priceInrYearly: number
  priceUsd: number
  priceUsdYearly: number
  limits: PlanLimitsShape
}

export const getPublicPlans = cache(async function getPublicPlans(): Promise<PublicPlan[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('plans')
    .select('code, name, price_inr, price_inr_yearly, price_usd, price_usd_yearly, limits')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    priceInr: row.price_inr,
    priceInrYearly: row.price_inr_yearly,
    priceUsd: row.price_usd,
    priceUsdYearly: row.price_usd_yearly,
    limits: (row.limits ?? {}) as PlanLimitsShape,
  }))
})
