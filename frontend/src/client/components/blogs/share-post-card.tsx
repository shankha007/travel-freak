'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Copy, ExternalLink, Globe, Link2, Loader2, Lock } from 'lucide-react'
import { createPostShareLink, revokePostShareLinks } from '@/server/actions/share'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * The share controls on a post — the trip card's twin.
 *
 * What a reader gets depends on the post's visibility *and* whether it is
 * published, which is one more condition than a trip has. The card explains the
 * current state rather than offering a link that would not resolve:
 *
 *  - **public + published** — has a real URL; the link is a convenience.
 *  - **unlisted + published** — the link is the only way in.
 *  - **private, or unpublished** — nothing to share yet, and a link made now
 *    would resolve to nothing until both change.
 */
export function SharePostCard({
  postId,
  slug,
  visibility,
  published,
  existingToken,
  siteUrl,
}: {
  postId: string
  slug: string
  visibility: string
  published: boolean
  existingToken: string | null
  siteUrl: string
}) {
  const router = useRouter()
  const [token, setToken] = useState(existingToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const publicUrl = `${siteUrl}/b/${slug}`
  const shareUrl = token ? `${publicUrl}?k=${token}` : null
  const isPublic = visibility === 'public'
  const isPrivate = visibility === 'private'
  // A token only resolves once the post is published, so the card must not imply
  // otherwise while it is still a draft.
  const linkWorks = published && !isPrivate

  async function copy(url: string, which: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  async function create() {
    setBusy(true)
    setError(null)
    const result = await createPostShareLink(postId)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not create a link.')
      return
    }
    setToken(result.token ?? null)
    router.refresh()
  }

  async function revoke() {
    setBusy(true)
    setError(null)
    const result = await revokePostShareLinks(postId)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not revoke the link.')
      return
    }
    setToken(null)
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {isPublic ? (
              <Globe className="size-4" aria-hidden />
            ) : isPrivate ? (
              <Lock className="size-4" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            Share
          </h2>
          <p className="text-sm text-muted-foreground">
            {isPrivate && 'Private. Set this post to unlisted or public to share it.'}
            {!isPrivate &&
              !published &&
              'Publish this post and the link starts working. Until then it resolves to nothing, even for someone holding it.'}
            {!isPrivate &&
              published &&
              (isPublic
                ? 'Published publicly, so it has a real URL. The private link is for sending it to someone directly.'
                : 'Unlisted: only people with the link can read it, and it is never indexed.')}
          </p>
        </div>

        {isPublic && published && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{publicUrl}</code>
            <Button size="sm" variant="outline" onClick={() => void copy(publicUrl, 'public')}>
              {copied === 'public' ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied === 'public' ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/b/${slug}`} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open
            </Button>
          </div>
        )}

        {!isPrivate && (
          <div className="space-y-2">
            {shareUrl ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{shareUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => void copy(shareUrl, 'share')}>
                    {copied === 'share' ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : (
                      <Copy className="size-3.5" aria-hidden />
                    )}
                    {copied === 'share' ? 'Copied' : 'Copy link'}
                  </Button>
                </div>
                {!linkWorks && (
                  <p className="text-xs text-muted-foreground">
                    Not live yet — the post has to be published for this to open.
                  </p>
                )}
                <Button size="sm" variant="ghost" onClick={() => void revoke()} disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                  Revoke link
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void create()} disabled={busy}>
                {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                <Link2 className="size-3.5" aria-hidden />
                Create a private link
              </Button>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
