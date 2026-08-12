'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Loads a heavy Client Component on the client only, after mount.
 *
 * three.js and maplibre-gl are ~500 KB and ~800 KB respectively and both touch
 * `window` at module scope, so they must never be evaluated during SSR and must
 * not sit in the initial bundle. An explicit effect-driven import keeps that
 * guarantee while still code-splitting the chunk, and unlike a lazy/Suspense
 * boundary it surfaces load failures instead of leaving the page silently stuck
 * on a placeholder — which is why every caller gets a `failed` flag to render an
 * explanation with.
 *
 * The loader is captured on first render and the import runs once: callers pass
 * an inline arrow, and depending on its identity would re-import forever. A
 * caller that needs to swap modules should remount instead — this hook loads one
 * thing, once.
 */
export function useLazyComponent<T>(load: () => Promise<T>): {
  Component: T | null
  failed: boolean
} {
  // Wrapped in an object: a bare setState(fn) would be treated as an updater
  // function rather than the value, and every component here is a function.
  const [component, setComponent] = useState<{ value: T } | null>(null)
  const [failed, setFailed] = useState(false)
  const loadRef = useRef(load)

  useEffect(() => {
    let cancelled = false
    loadRef
      .current()
      .then((value) => {
        if (!cancelled) setComponent({ value })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { Component: component?.value ?? null, failed }
}
