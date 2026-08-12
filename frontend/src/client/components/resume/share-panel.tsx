'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Copy, ExternalLink, Globe, Loader2, Lock } from 'lucide-react'
import { setProfileVisibility, updateProfileDetails } from '@/server/actions/profile'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Switch } from '@/client/components/ui/switch'
import { Textarea } from '@/client/components/ui/textarea'

/**
 * The share half of the resume: the public URL, the switch that creates it, and
 * the two fields that make the page worth reading.
 *
 * The switch is the only place in the app that publishes anything about a
 * person rather than a trip, so it says plainly what turning it on exposes.
 */
export function SharePanel({
  username,
  isPublic,
  displayName,
  bio,
  siteUrl,
}: {
  username: string
  isPublic: boolean
  displayName: string
  bio: string
  siteUrl: string
}) {
  const router = useRouter()
  const [publicProfile, setPublicProfile] = useState(isPublic)
  const [name, setName] = useState(displayName)
  const [bioText, setBioText] = useState(bio)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publicUrl = `${siteUrl}/u/${username}`

  async function toggle(next: boolean) {
    setBusy(true)
    setError(null)
    // Optimistic, then reconciled: the switch should feel like a switch.
    setPublicProfile(next)

    const result = await setProfileVisibility(next)
    setBusy(false)

    if (!result.ok) {
      setPublicProfile(!next)
      setError(result.error ?? 'Could not update your profile.')
      return
    }
    router.refresh()
  }

  async function saveDetails() {
    setBusy(true)
    setError(null)
    setSaved(false)

    const result = await updateProfileDetails({ displayName: name, bio: bioText })
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not save.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              {publicProfile ? (
                <Globe className="size-4" aria-hidden />
              ) : (
                <Lock className="size-4" aria-hidden />
              )}
              {publicProfile ? 'Your resume is public' : 'Your resume is private'}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {publicProfile
                ? 'Anyone with the link can see your countries, your counters and anything you have published. Private trips and drafts stay hidden.'
                : 'Only you can see this. Turn it on to get a shareable link — you choose separately which trips and posts are published.'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Make my profile public</span>
            <Switch checked={publicProfile} onCheckedChange={toggle} disabled={busy} />
          </label>
        </div>

        {publicProfile && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{publicUrl}</code>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/u/${username}`} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              rows={2}
              placeholder="One line about how you travel."
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => void saveDetails()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save
          </Button>
          {saved && <span className="text-xs text-muted-foreground">Saved</span>}
        </div>
      </CardContent>
    </Card>
  )
}
