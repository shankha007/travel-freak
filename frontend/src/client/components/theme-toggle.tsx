'use client'

import { useTheme } from 'next-themes'
import { useIsHydrated } from '@/client/hooks/use-is-hydrated'
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { THEMES, themeById, type ThemeDefinition } from '@/shared/themes'
import { cn } from '@/shared/utils'
import { Button } from '@/client/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu'

/**
 * Theme picker.
 *
 * More than light and dark, so the menu is grouped by what the palette does to
 * the room rather than listed flat: System first, because it is the default and
 * the only one that changes by itself, then the light palettes, then the dark.
 *
 * Every entry carries a three-colour swatch **and** its name — the swatch shows
 * a palette you are not currently looking at, so it cannot be built from the
 * live custom properties, and a name means the choice does not depend on
 * telling two dark blues apart at 16px.
 */

const LIGHT = THEMES.filter((theme) => theme.mode === 'light')
const DARK = THEMES.filter((theme) => theme.mode === 'dark')

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  // The server cannot know the user's theme, so show a stable icon until after
  // hydration rather than guessing and flipping it.
  const mounted = useIsHydrated()

  const active = mounted ? themeById(theme) : undefined
  const isDark = mounted && DARK.some((t) => t.className === resolvedTheme)

  // A palette gets the palette icon; plain light/dark keep sun and moon, which
  // are what a returning user is looking for in the header.
  const Icon =
    active && active.id !== 'light' && active.id !== 'dark' ? Palette : isDark ? Moon : Sun

  return (
    <DropdownMenu>
      {/* Base UI composes via `render`, not Radix's `asChild`. */}
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label={active ? `Theme: ${active.label}. Change theme` : 'Change theme'}
      >
        <Icon className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          aria-current={mounted && theme === 'system' ? 'true' : undefined}
          className="gap-2"
        >
          <Monitor className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">System</span>
          {mounted && theme === 'system' && <Check className="size-3.5 shrink-0" aria-hidden />}
        </DropdownMenuItem>

        <Group label="Light" themes={LIGHT} current={theme} onPick={setTheme} mounted={mounted} />
        <Group label="Dark" themes={DARK} current={theme} onPick={setTheme} mounted={mounted} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Group({
  label,
  themes,
  current,
  onPick,
  mounted,
}: {
  label: string
  themes: ThemeDefinition[]
  current: string | undefined
  onPick: (id: string) => void
  mounted: boolean
}) {
  return (
    <>
      <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {themes.map((theme) => {
        const selected = mounted && current === theme.id
        return (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => onPick(theme.id)}
            aria-current={selected ? 'true' : undefined}
            className="gap-2"
          >
            <Swatch theme={theme} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span>{theme.label}</span>
              <span className="truncate text-xs text-muted-foreground">{theme.description}</span>
            </span>
            {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

function Swatch({ theme }: { theme: ThemeDefinition }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border',
        'shadow-inner'
      )}
      style={{ background: theme.swatch[0] }}
    >
      <span className="h-full w-1/2" style={{ background: theme.swatch[1] }} />
      <span className="h-full w-1/2" style={{ background: theme.swatch[2] }} />
    </span>
  )
}
