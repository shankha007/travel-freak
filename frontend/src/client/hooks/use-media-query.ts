'use client'

import { useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query from React.
 *
 * `useSyncExternalStore` rather than an effect for the same reason
 * `useReducedMotion` uses it: the first client render already has the right
 * answer, instead of rendering the wrong layout for a frame and correcting it.
 * The server snapshot is `false`, since a viewport is unknowable there.
 *
 * Prefer a CSS breakpoint where one will do. This is for the cases where the
 * viewport decides a *default* that the user can then override — CSS cannot
 * express "open on a wide screen unless they closed it".
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
