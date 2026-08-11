'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { AlertCircle, Check, ExternalLink, Loader2, Save } from 'lucide-react'
import { saveBlogPost, setBlogPublished } from '@/server/actions/blogs'
import type { BlogDraft, TripOption } from '@/server/queries/blogs'
import { UNTITLED } from '@/shared/validation/blog'
import { VISIBILITIES } from '@/shared/validation/trip'
import { countWords, htmlToText, readingMinutes } from '@/shared/content/reading'
import { PROSE_CLASS } from '@/shared/content/prose'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'
import { Card, CardContent } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { DeleteBlogDialog } from '@/client/components/blogs/delete-blog-dialog'
import { EditorToolbar } from '@/client/components/blogs/editor-toolbar'
import { cn } from '@/shared/utils'

type Visibility = (typeof VISIBILITIES)[number]

/** How long the writer has to stop typing before a save fires. */
const AUTOSAVE_DELAY_MS = 1500

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

/**
 * Blog Studio — screen 27.
 *
 * One component for both `/blogs/new` and `/blogs/[id]/edit`. A new post has no
 * row until the first autosave; that save returns an id, and the URL is swapped
 * with `history.replaceState` rather than a router navigation, because a
 * navigation would remount the editor and take the writer's cursor with it.
 *
 * The editor holds the document; React holds everything around it. Content is
 * mirrored into state as HTML on each update so autosave has something stable
 * to diff, and Tiptap's JSON goes along with it so the post reopens exactly as
 * it was left.
 */
export function BlogStudio({ post, trips }: { post?: BlogDraft; trips: TripOption[] }) {
  const [id, setId] = useState(post?.id)
  const [slug, setSlug] = useState(post?.slug ?? '')
  // An untitled draft is stored under a placeholder title; show the writer an
  // empty field rather than the word they never typed.
  const [title, setTitle] = useState(post && post.title !== UNTITLED ? post.title : '')
  const [contentHtml, setContentHtml] = useState(post?.contentHtml ?? '')
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [visibility, setVisibility] = useState<Visibility>(post?.visibility ?? 'private')
  const [tripId, setTripId] = useState(post?.tripId ?? '')
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? '')
  const [publishedAt, setPublishedAt] = useState<string | null>(post?.publishedAt ?? null)

  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({
        placeholder: 'Start where the story starts. The road, the meal, the moment.',
      }),
    ],
    content: initialContent(post),
    // Required for SSR: rendering immediately would produce markup on the
    // server that does not match the client's first paint.
    immediatelyRender: false,
    // The toolbar reads isActive() on every keystroke, so it needs the redraw.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: cn('min-h-[24rem] px-4 py-4 outline-none', PROSE_CLASS),
        'aria-label': 'Post content',
      },
    },
    onUpdate: ({ editor }) => setContentHtml(editor.getHTML()),
  })

  /** Everything the server stores, in one comparable shape. */
  const payload = useMemo(
    () => ({
      title,
      contentHtml,
      excerpt,
      visibility,
      tripId,
      seoTitle,
      seoDescription,
    }),
    [title, contentHtml, excerpt, visibility, tripId, seoTitle, seoDescription]
  )
  const serialized = JSON.stringify(payload)

  const lastSaved = useRef<string | null>(null)
  const saving = useRef(false)

  const save = useCallback(async () => {
    if (saving.current) return
    const snapshot = JSON.stringify(payload)

    saving.current = true
    setStatus('saving')
    setError(null)

    try {
      const result = await saveBlogPost({
        ...payload,
        id,
        contentJson: editor?.getJSON(),
      })

      if (!result.ok) {
        setStatus('error')
        setError(result.error ?? 'Could not save.')
        setFieldErrors(result.fieldErrors ?? {})
        return
      }

      setFieldErrors({})
      lastSaved.current = snapshot
      setStatus('saved')
      if (result.slug) setSlug(result.slug)

      if (!id && result.id) {
        setId(result.id)
        // The post exists now, so the URL should say so — without a navigation,
        // which would remount the editor mid-sentence.
        window.history.replaceState(null, '', `/blogs/${result.id}/edit`)
      }
    } finally {
      saving.current = false
    }
  }, [payload, id, editor])

  // Autosave. The first pass only records the loaded state, so opening a post
  // never writes one.
  useEffect(() => {
    if (lastSaved.current === null) {
      lastSaved.current = serialized
      return
    }
    if (serialized === lastSaved.current) return

    setStatus('unsaved')
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // `save` is intentionally not a dependency: it changes on every keystroke
    // (it closes over the payload), which would restart the timer forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])

  // ⌘S / Ctrl+S saves now rather than asking the browser to save the page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save])

  // Losing a paragraph to a closed tab is the one unrecoverable failure here.
  useEffect(() => {
    const dirty = lastSaved.current !== null && serialized !== lastSaved.current
    if (!dirty) return

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [serialized])

  const [publishing, setPublishing] = useState(false)

  const togglePublished = useCallback(async () => {
    setPublishing(true)
    setError(null)
    try {
      // Publish what is on screen, not what was last autosaved.
      await save()
      const postId = id
      if (!postId) return

      const result = await setBlogPublished(postId, publishedAt === null)
      if (!result.ok) {
        setError(result.error ?? 'Could not update the post.')
        return
      }
      setPublishedAt(result.publishedAt ?? null)
    } finally {
      setPublishing(false)
    }
  }, [id, publishedAt, save])

  const words = countWords(htmlToText(contentHtml))
  const canPublish = visibility !== 'private'
  const published = publishedAt !== null

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header: identity on the left, state and actions on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={published ? 'default' : 'secondary'}>
            {published ? 'Published' : 'Draft'}
          </Badge>
          <SaveIndicator status={status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {slug && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={`/b/${slug}`} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="size-4" aria-hidden />
              Preview
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void save()}
            disabled={status === 'saving'}
          >
            <Save className="size-4" aria-hidden />
            Save
          </Button>

          <Button
            size="sm"
            variant={published ? 'outline' : 'default'}
            onClick={() => void togglePublished()}
            disabled={publishing || (!published && !canPublish)}
          >
            {publishing && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {published ? 'Unpublish' : 'Publish'}
          </Button>

          {id && <DeleteBlogDialog postId={id} title={title || UNTITLED} />}
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

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* ------------------------------------------------------- the page */}
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Post title"
            aria-invalid={Boolean(fieldErrors.title)}
            className="h-auto border-0 bg-transparent px-0 !text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {fieldErrors.title && <p className="text-sm text-destructive">{fieldErrors.title}</p>}

          <Card className="overflow-hidden p-0">
            {editor && <EditorToolbar editor={editor} />}
            <EditorContent editor={editor} />
          </Card>

          <p className="text-xs text-muted-foreground tabular-nums">
            {words} {words === 1 ? 'word' : 'words'} · {readingMinutes(contentHtml)} min read
          </p>
        </div>

        {/* ---------------------------------------------------- the settings */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="visibility">Who can see this?</Label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {visibility === 'private' && 'Only you. Publishing needs unlisted or public.'}
                  {visibility === 'unlisted' &&
                    'Anyone with the link, once share links exist. For now, only you.'}
                  {visibility === 'public' && 'Anyone, and search engines, once published.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tripId">About a trip</Label>
                <select
                  id="tripId"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Standalone post</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Linked posts appear on the trip page and in the globe&apos;s region modal.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={3}
                  placeholder="Left empty, this is taken from your opening lines."
                />
                <p className="text-xs text-muted-foreground tabular-nums">{excerpt.length}/300</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoTitle">SEO title</Label>
                <Input
                  id="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Defaults to the post title"
                  aria-invalid={Boolean(fieldErrors.seoTitle)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">SEO description</Label>
                <Textarea
                  id="seoDescription"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  placeholder="Defaults to the excerpt"
                  aria-invalid={Boolean(fieldErrors.seoDescription)}
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {seoDescription.length}/160
                </p>
              </div>
            </CardContent>
          </Card>

          {!canPublish && !published && (
            <p className="text-xs text-muted-foreground">
              Set this post to unlisted or public to publish it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Tiptap's own JSON when there is one, falling back to stored HTML. */
function initialContent(post?: BlogDraft) {
  const json = post?.contentJson
  if (json && typeof json === 'object' && 'type' in json) return json
  return post?.contentHtml ?? ''
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3" aria-hidden />
        Saved
      </span>
    )
  }

  if (status === 'unsaved') {
    return <span className="text-xs text-muted-foreground">Unsaved changes</span>
  }

  if (status === 'error') {
    return <span className="text-xs text-destructive">Not saved</span>
  }

  return null
}
