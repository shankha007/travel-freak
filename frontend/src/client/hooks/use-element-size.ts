'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

interface Size {
  width: number
  height: number
}

/**
 * Observes an element's rendered size.
 *
 * react-globe.gl needs explicit pixel width and height — it cannot size itself
 * from CSS — so the canvas has to be told what its container measured.
 *
 * Measures synchronously on layout so the first paint already has real
 * dimensions, then keeps in sync via ResizeObserver where available and window
 * resize everywhere else. The belt-and-braces approach matters because a
 * container that reports 0 leaves the globe permanently invisible, and
 * ResizeObserver is not delivered in every embedded browser.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return

    const { width, height } = element.getBoundingClientRect()
    setSize((prev) =>
      // Sub-pixel changes would otherwise rebuild the WebGL viewport on every
      // scrollbar twitch.
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    )
  }, [])

  useLayoutEffect(() => {
    measure()

    const element = ref.current
    if (!element) return

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(element)
    }

    window.addEventListener('resize', measure)
    // Fonts and late-loading styles can reflow the container after first paint.
    const settle = window.setTimeout(measure, 250)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.clearTimeout(settle)
    }
  }, [measure])

  return { ref, ...size }
}
