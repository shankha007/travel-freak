'use client'

import { useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Separator } from '@/client/components/ui/separator'
import { cn } from '@/shared/utils'

/**
 * Formatting controls for the studio.
 *
 * Every control maps to a mark or node the sanitiser's allowlist keeps, so the
 * toolbar cannot produce formatting that is silently stripped on save.
 */
export function EditorToolbar({
  editor,
  onInsertImage,
  imageBusy = false,
  imageDisabled = false,
}: {
  editor: Editor
  /** Omitted before the post exists — there is nowhere to upload to yet. */
  onInsertImage?: () => void
  imageBusy?: boolean
  imageDisabled?: boolean
}) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')

    // Cancel leaves the document alone; clearing the field removes the link.
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const items: (
    | { type: 'separator' }
    | {
        type: 'button'
        label: string
        icon: typeof Bold
        run: () => void
        active?: boolean
        disabled?: boolean
        /** Spins the icon — used while an upload is in flight. */
        spin?: boolean
      }
  )[] = [
    {
      type: 'button',
      label: 'Bold',
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
    },
    {
      type: 'button',
      label: 'Italic',
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
    },
    {
      type: 'button',
      label: 'Strikethrough',
      icon: Strikethrough,
      run: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive('strike'),
    },
    {
      type: 'button',
      label: 'Inline code',
      icon: Code,
      run: () => editor.chain().focus().toggleCode().run(),
      active: editor.isActive('code'),
    },
    { type: 'separator' },
    {
      type: 'button',
      label: 'Heading',
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive('heading', { level: 2 }),
    },
    {
      type: 'button',
      label: 'Subheading',
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive('heading', { level: 3 }),
    },
    {
      type: 'button',
      label: 'Bulleted list',
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
    },
    {
      type: 'button',
      label: 'Numbered list',
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
    },
    {
      type: 'button',
      label: 'Quote',
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
    },
    {
      type: 'button',
      label: 'Divider',
      icon: Minus,
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
    // Only offered once there is a post to attach an upload to. The studio
    // passes no handler until the first autosave has produced an id.
    ...(onInsertImage
      ? [
          {
            type: 'button' as const,
            label: imageBusy ? 'Uploading image…' : 'Insert image',
            icon: imageBusy ? Loader2 : ImagePlus,
            run: onInsertImage,
            disabled: imageBusy || imageDisabled,
            spin: imageBusy,
          },
        ]
      : []),
    { type: 'separator' },
    {
      type: 'button',
      label: editor.isActive('link') ? 'Edit link' : 'Add link',
      icon: Link2,
      run: setLink,
      active: editor.isActive('link'),
    },
    {
      type: 'button',
      label: 'Remove link',
      icon: Link2Off,
      run: () => editor.chain().focus().unsetLink().run(),
      disabled: !editor.isActive('link'),
    },
    { type: 'separator' },
    {
      type: 'button',
      label: 'Undo',
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
      disabled: !editor.can().undo(),
    },
    {
      type: 'button',
      label: 'Redo',
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
      disabled: !editor.can().redo(),
    },
  ]

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b bg-card/95 p-1.5 backdrop-blur"
    >
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <Separator key={`sep-${i}`} orientation="vertical" className="mx-1 h-5" />
        ) : (
          <Button
            key={item.label}
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={item.label}
            aria-pressed={item.active ?? undefined}
            title={item.label}
            disabled={item.disabled}
            // Without this the button takes focus on press, the editor's
            // selection collapses, and the command lands wherever the caret was
            // last known to be — usually the top of the document.
            onMouseDown={(e) => e.preventDefault()}
            onClick={item.run}
            className={cn(item.active && 'bg-muted text-foreground')}
          >
            <item.icon className={cn('size-4', item.spin && 'animate-spin')} aria-hidden />
          </Button>
        )
      )}
    </div>
  )
}
