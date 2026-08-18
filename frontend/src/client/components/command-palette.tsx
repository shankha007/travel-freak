'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { commandItems, commandSections, filterCommands, type CommandItem } from '@/shared/command'
import { NAV_ICONS } from '@/client/components/app-nav'
import { Dialog, DialogContent, DialogTitle } from '@/client/components/ui/dialog'
import { cn } from '@/shared/utils'

/**
 * Everywhere you can go, one keystroke away — Cmd+K, or Ctrl+K.
 *
 * Hand-rolled over the dialog this app already has rather than pulling in
 * `cmdk`. The list is a dozen destinations from `shared/navigation.ts` and the
 * matching is fifteen lines in `shared/command.ts`; a dependency would have been
 * more code in the bundle than the feature is, and this repo has form on that —
 * `recharts` sat unused for weeks, and the sidebar once shipped 1,500 icons.
 *
 * **Accessibility is the reason for most of what follows.** The input keeps
 * focus the whole time and the list is never focused, so a screen reader stays
 * in the textbox and is told what is highlighted through `aria-activedescendant`
 * — the combobox pattern. Arrow keys move the highlight without moving focus,
 * Enter follows it, Escape closes.
 */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => commandItems(), [])
  const results = useMemo(() => filterCommands(items, query), [items, query])
  const sections = useMemo(() => commandSections(results), [results])

  // Cmd+K on a Mac, Ctrl+K elsewhere. Captured on the window so it works
  // wherever the caret happens to be — except inside a text field, where
  // somebody writing a post owns their own keystrokes and Ctrl+K is a real
  // editor shortcut. Once the palette is open its own input is exempt, so the
  // same chord closes it again.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return

      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true

      if (typing && !open) return

      event.preventDefault()
      setOpen((wasOpen) => !wasOpen)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  /**
   * A fresh palette every time. Reopening onto the last search — and onto a
   * highlight halfway down it — is the kind of memory nobody asked for.
   *
   * Done here rather than in an effect watching `open`, which is what
   * `react-hooks/set-state-in-effect` objects to and is right to: closing is an
   * event, and clearing state is part of handling it rather than a consequence
   * to be observed afterwards.
   */
  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery('')
      setHighlighted(0)
    }
  }, [])

  // Typing moves the ground under the highlight, so it returns to the top in
  // the same handler rather than pointing at whatever now occupies that index.
  const onQueryChange = useCallback((value: string) => {
    setQuery(value)
    setHighlighted(0)
  }, [])

  // Closes through `onOpenChange` rather than `setOpen` so following a result
  // clears the search too. Setting the flag directly left the query behind, and
  // the next Cmd+K reopened onto the last thing somebody searched for — which
  // the reset above exists precisely to prevent.
  const go = useCallback(
    (item: CommandItem) => {
      onOpenChange(false)
      router.push(item.href)
    },
    [onOpenChange, router]
  )

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      // Wraps, because pressing up from the top to reach the last item is what
      // every palette does and the list is short enough to have no far end.
      setHighlighted((current) => (current + step + results.length) % results.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const item = results[highlighted]
      if (item) go(item)
    }
  }

  // Keeps the highlight in view when the arrow keys walk past the fold.
  // `block: 'nearest'` scrolls the list rather than the page under it.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, results])

  const activeId = results[highlighted] ? `command-${results[highlighted].id}` : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* The dialog needs a name and the palette has no visible heading. The
            placeholder is not one: it disappears on the first keystroke. */}
        <DialogTitle className="sr-only">Search and go</DialogTitle>

        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Go to…"
            aria-label="Search screens and actions"
            role="combobox"
            aria-expanded
            aria-controls="command-results"
            aria-activedescendant={activeId}
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          ref={listRef}
          id="command-results"
          role="listbox"
          aria-label="Screens and actions"
          className="max-h-80 overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing matches that. This searches screens, not your trips — trip search is not built
              yet.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section} className="py-1">
                <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {section}
                </p>
                {results
                  .filter((item) => item.section === section)
                  .map((item) => {
                    // Indexed against the flat result list, because that is what
                    // the arrow keys walk — the grouping is presentation only.
                    const index = results.indexOf(item)
                    const active = index === highlighted
                    const Icon = NAV_ICONS[item.icon] ?? Search

                    return (
                      <button
                        key={item.id}
                        id={`command-${item.id}`}
                        role="option"
                        aria-selected={active}
                        data-highlighted={active}
                        type="button"
                        // Follows the pointer, so the mouse and the keyboard
                        // never disagree about what Enter would do.
                        onMouseMove={() => setHighlighted(index)}
                        onClick={() => go(item)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm',
                          active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
