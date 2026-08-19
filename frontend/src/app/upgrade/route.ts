import { NextResponse } from 'next/server'
import { getSessionUser } from '@/server/auth'
import { getEntitlements } from '@/server/entitlements'
import { captureFunnelEvent } from '@/server/funnel'
import { SITE_URL } from '@/shared/brand'

/**
 * The last step of the funnel, and a redirect to `/pricing`.
 *
 * ## Why a hop rather than recording it on `/pricing`
 *
 * Because `/pricing` has two audiences and this step is about one of them. It is
 * linked from the public marketing nav as well as from every in-app upgrade
 * prompt, so an event fired on the page itself would count a stranger reading the
 * plans as the same act as a paying decision by somebody who has just hit a
 * limit. Those are different questions and the funnel only asks the second.
 *
 * So the in-app prompts point here — thirteen of them, from the quota meter, the
 * uploader, the budget, the itinerary, packing, collaborators, the map, the trip
 * form and the analytics wall — and the marketing nav still links straight to
 * `/pricing`. The hop costs one redirect on a click that is about to become a
 * page load anyway.
 *
 * ## What is recorded, and what is not
 *
 * A signed-in visitor only. An anonymous one has no distinct id worth inventing —
 * `signed_up` is step one, so anyone before it is outside the funnel by
 * definition — and they are forwarded exactly the same way.
 *
 * The event is `upgrade_viewed` rather than `upgraded`, and the distinction is
 * the honest one: there is no billing in this codebase yet, so the furthest thing
 * that can be observed is the intent. When Phase 3 wires a gateway, the
 * conversion event lands beside this one and this stays as the step before it.
 */
export async function GET() {
  const user = await getSessionUser()

  if (user) {
    const { planCode } = await getEntitlements()
    captureFunnelEvent(user.id, 'upgrade_viewed', { from_plan: planCode })
  }

  // 307, not 308: this is not a permanent move, and a browser that cached it
  // permanently would stop reporting every future click.
  return NextResponse.redirect(`${SITE_URL}/pricing`, 307)
}
