'use client'

import { useSyncExternalStore } from 'react'

// The value never changes after hydration, so the store never notifies.
const noopSubscribe = () => () => {}

/**
 * True once the client has hydrated, false during SSR and the first render.
 *
 * Use this to gate UI that depends on browser-only state (theme, locale,
 * timezone) instead of rendering a guess and correcting it, which causes a
 * hydration mismatch.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}
