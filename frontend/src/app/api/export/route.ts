import { NextResponse } from 'next/server'
import { getSessionUser } from '@/server/auth'
import { getAccountExport } from '@/server/queries/export'
import { exportFilename } from '@/shared/export'

/**
 * Downloads everything this account owns, as JSON — screen 44.
 *
 * A Route Handler rather than a Server Action, because the result is a file
 * rather than a state change: the browser needs a response it can save, and a
 * plain `<a href>` to this is the whole client side of the feature. It also
 * means the export works from a bookmark, from `curl`, and from a script
 * somebody writes to move their data somewhere else — which is what a right of
 * portability is actually for.
 *
 * On every plan including the free one, per `export_json` in `plans.limits`.
 * There is deliberately no entitlement check: gating the right to your own data
 * behind a payment is not a thing this product does.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to export your data.' }, { status: 401 })
  }

  const document = await getAccountExport()

  // Pretty-printed on purpose. It is a file a person may open in a text editor
  // to check we are telling the truth, and the bytes saved by minifying it are
  // worth less than that.
  const body = JSON.stringify(document, null, 2)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFilename(user.username)}"`,
      // Contains everything about one person. No cache should ever hold it.
      'Cache-Control': 'no-store, private',
      'Content-Length': String(Buffer.byteLength(body)),
    },
  })
}
