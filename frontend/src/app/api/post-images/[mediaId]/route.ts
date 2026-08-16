import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/server/supabase/server'
import { displayPath, mayServePostImage } from '@/shared/media'

/**
 * Serves an image placed inside a blog post, if the post may be read.
 *
 * The problem this exists to solve: a post's HTML has to contain a URL that
 * keeps working forever, and a signed URL expires within the hour. The first
 * answer was to put a stripped copy in the world-readable bucket and reference
 * that — which meant the picture was fetchable from the moment it was uploaded,
 * before anybody had decided to publish anything. Unguessable, but unguarded.
 *
 * So the URL in the document names the media row and comes here, and the check
 * happens per request against the post's visibility at that moment. Unpublishing
 * a post now takes its pictures with it, which is what a reader would assume it
 * already did.
 *
 * **The bytes are still a stripped derivative**, generated at upload — the EXIF,
 * and the GPS in it, never existed on the copy this serves. That has not
 * changed; only where it lives has, from the public bucket to the owner's own
 * prefix in the private one.
 *
 * Answers 404 for every refusal, never 403. A distinguishable "you may not see
 * this" would confirm that a given media id belongs to a real post on a real
 * account, which is the same reason `/b/[slug]` 404s a draft rather than
 * challenging for a login.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** How long the redirect target stays good. Matches the rest of the app. */
const SIGNED_URL_TTL_SECONDS = 60 * 60

export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params

  if (!UUID_RE.test(mediaId)) return notFound()

  // The service role reads the row because the point is to answer for callers
  // who have no rights to it — a stranger reading a published post. Nothing is
  // returned to them until the visibility check below has passed.
  const admin = createAdminClient()

  const { data: media } = await admin
    .from('media')
    .select('id, user_id, post_id, storage_path, deleted_at')
    .eq('id', mediaId)
    .maybeSingle()

  // `post_id` null means this is a trip photo, not a post image. Those are
  // served by the vault and the public trip page and have their own rules; this
  // route deliberately answers for one kind of media only.
  if (!media || media.deleted_at || !media.post_id) return notFound()

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, user_id, visibility, published_at, deleted_at')
    .eq('id', media.post_id)
    .maybeSingle()

  if (!post) return notFound()

  // Read through the ordinary client: this is the one question that depends on
  // who is asking, and the elevated client has no session to ask about.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const allowed = mayServePostImage({
    isOwner: user?.id === post.user_id,
    visibility: post.visibility,
    publishedAt: post.published_at,
    deletedAt: post.deleted_at,
  })

  if (!allowed) return notFound()

  // Always the stripped copy, never the original — the original still carries
  // the EXIF the reader must not get. `confirmPostImage` writes this before it
  // returns a URL and removes the row if it could not, so a row that exists has
  // one. The key is derived rather than stored, which is why nothing had to be
  // migrated to add it.
  const key = displayPath(media.storage_path)

  const { data: signed } = await admin.storage
    .from('media')
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS)

  if (!signed?.signedUrl) return notFound()

  // A redirect rather than a proxy: the bytes go browser-to-storage and never
  // through this server, which is the same trade the uploader makes in reverse.
  //
  // `private` keeps the redirect out of every shared cache — a CDN holding one
  // would serve a post's image to strangers after it was unpublished. `no-store`
  // on top of that because the check is the product: it has to run per request
  // or it is not a check. The signed URL it hands out is good for an hour
  // regardless, which is the window an unpublish cannot claw back and is stated
  // in the privacy policy.
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function notFound() {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
