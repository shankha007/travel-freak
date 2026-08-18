import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { cronSecret } from '@/server/env'
import { buildPendingDerivatives } from '@/server/media/derivative-jobs'

/**
 * The scheduled job that builds public image derivatives.
 *
 * Publishing a trip already starts this work through `after()`, so on the happy
 * path there is nothing here to do. This exists for the unhappy ones: a serverless
 * function that hit its timeout half way through a gallery, a trip published
 * before any of this existed, a transform that failed on a truncated upload and
 * is worth one more attempt tomorrow.
 *
 * Same guard as `purge-trash`, for a weaker reason. That endpoint destroys data
 * and this one only spends CPU — but an unauthenticated endpoint that runs a
 * sharp pipeline for every unconverted photograph on the platform is a way to
 * make somebody else pay for compute, so it is closed the same way. A missing
 * `CRON_SECRET` closes it rather than opening it.
 *
 * Idempotent, like the purge: work is chosen by `public_path is null`, so a
 * double run finds nothing the second time and a missed night costs a night.
 */
export const dynamic = 'force-dynamic'

/**
 * Long enough for a batch of re-encodes, which is the whole point of moving them
 * off a page request. The batch itself is capped in `derivative-jobs.ts` so a run
 * that cannot finish leaves its remainder for the next one rather than dying
 * with nothing to show.
 */
export const maxDuration = 300

function authorized(request: Request): boolean {
  const secret = cronSecret()
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const offered = header.startsWith('Bearer ') ? header.slice(7) : ''

  // Fixed-length digests, as in `purge-trash`: `timingSafeEqual` demands equal
  // lengths, and comparing raw would leak the secret's length through a throw.
  const a = Buffer.from(offered.padEnd(64, '\0').slice(0, 64))
  const b = Buffer.from(secret.padEnd(64, '\0').slice(0, 64))

  return offered.length === secret.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const result = await buildPendingDerivatives()

  // 207 when some photo would not convert. The rest were built, and a scheduler
  // that read this as a plain failure would retry work that is already done —
  // while a plain 200 would hide a photograph that is never going to appear on a
  // page somebody published.
  const status = result.errors.length > 0 ? 207 : 200

  if (result.errors.length > 0) {
    console.error('build-derivatives: finished with errors', result)
  }

  return NextResponse.json(result, { status, headers: { 'Cache-Control': 'no-store' } })
}
