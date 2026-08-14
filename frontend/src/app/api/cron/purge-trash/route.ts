import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { cronSecret } from '@/server/env'
import { purgeExpiredTrash } from '@/server/account/purge-trash'

/**
 * The scheduled job that empties expired trash.
 *
 * A route rather than a database job, because half of the work is not in the
 * database: the photographs are objects in a bucket, and only the application
 * holds a key that can delete them. `vercel.json` calls this daily; anything
 * that can make an HTTP request on a timer works the same way.
 *
 * Guarded by a shared secret, checked in constant time. Without it this is an
 * unauthenticated endpoint that destroys data — and while it only ever deletes
 * what is already past its window, "only" is doing more work in that sentence
 * than anyone should be comfortable with.
 *
 * A missing `CRON_SECRET` closes the endpoint rather than opening it. A deploy
 * that forgets the variable gets a purge nobody can run, which is a bug that
 * shows up as storage growing; the other way round is a bug that shows up as
 * somebody's trips being gone.
 */
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const secret = cronSecret()
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const offered = header.startsWith('Bearer ') ? header.slice(7) : ''

  // Compared over fixed-length digests rather than the raw strings: the buffers
  // must be the same length for `timingSafeEqual`, and comparing raw would leak
  // the secret's length through a thrown error.
  const a = Buffer.from(offered.padEnd(64, '\0').slice(0, 64))
  const b = Buffer.from(secret.padEnd(64, '\0').slice(0, 64))

  return offered.length === secret.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  const result = await purgeExpiredTrash()

  // 207 when something in storage refused to go: the rows are gone as promised,
  // and a scheduler that treats this as a failure would retry work that is
  // already done. The body says what happened either way.
  const status = result.errors.length > 0 ? 207 : 200

  if (result.errors.length > 0) {
    console.error('purge-trash: finished with errors', result)
  }

  return NextResponse.json(result, { status, headers: { 'Cache-Control': 'no-store' } })
}
