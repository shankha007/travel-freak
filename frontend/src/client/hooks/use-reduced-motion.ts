'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Tracks the user's OS motion preference.
 *
 * Uses useSyncExternalStore rather than an effect so the first client render
 * already has the correct value — an effect-based read would render motion-on
 * for a frame, which is exactly the flash the preference exists to prevent.
 * The server snapshot is `false`, since the preference is unknowable there.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
