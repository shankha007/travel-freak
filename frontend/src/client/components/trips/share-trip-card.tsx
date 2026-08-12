'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Copy, ExternalLink, Globe, Link2, Loader2, Lock } from 'lucide-react'
import { createShareLink, revokeShareLinks } from '@/server/actions/share'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * The share controls on a trip.
 *
 * What a visitor gets depends on the trip's visibility, so the card explains
 * the current state rather than offering a link that would not work:
 *
 *  - **public** — already has a URL; the link is a convenience.
 *  - **unlisted** — the link is the only way in.
 *  - **private** — nothing to share until the visibility changes, and a link
 *    created now would not resolve.
 */
export function ShareTripCard({
  tripId,
  slug,
  visibility,
  existingToken,
  siteUrl,
}: {
  tripId: string
  slug: string
  visibility: string
  existingToken: string | null
  siteUrl: string
}) {
  const router = useRouter()
  const [token, setToken] = useState(existingToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const publicUrl = `${siteUrl}/t/${slug}`
  const shareUrl = token ? `${publicUrl}?k=${token}` : null
  const isPublic = visibility === 'public'
  const isPrivate = visibility === 'private'

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
    const result = await createShareLink(tripId)
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
    const result = await revokeShareLinks(tripId)
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
      <CardContent className="space-y-4 p-5">
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
            {isPublic &&
              'This trip has a public page. Photos are published as copies with their location data removed.'}
            {visibility === 'unlisted' &&
              'Unlisted: only people with the link can open it, and it is never indexed.'}
            {isPrivate && 'Private. Set the trip to unlisted or public from Edit to share it.'}
          </p>
        </div>

        {isPublic && (
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
              render={<Link href={`/t/${slug}`} target="_blank" rel="noreferrer" />}
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
