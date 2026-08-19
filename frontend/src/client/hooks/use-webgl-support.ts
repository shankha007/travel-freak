'use client'

import { useSyncExternalStore } from 'react'

/**
 * Whether this browser can actually run the 3D globe.
 *
 * §6 of the plan asks for a fallback — "no WebGL or low-power device → static SVG
 * choropleth" — and without one the globe's skeleton is what such a visitor sees
 * forever: `react-globe.gl` imports successfully, three.js constructs a renderer,
 * the context request fails, and nothing on the page says why.
 *
 * ## What is detected, and what is not
 *
 * A real context request, because nothing cheaper is honest. `'WebGLRenderingContext'
 * in window` is true on every browser that has the constructor, including the ones
 * whose driver is blocklisted and whose `getContext` returns null — which is the
 * commonest way WebGL is missing in practice, and covers most of the "low-power
 * device" half of the requirement. The remaining part of that half — a device with
 * working but painfully slow WebGL — is deliberately not guessed at from a core
 * count or a memory hint: those are wrong often enough that the cure would be
 * showing a flat map to people whose globe works.
 *
 * ## Why three states
 *
 * `null` means "not asked yet" and is not the same as "no". The check needs a
 * document, so the server render and the hydration pass have no answer; treating
 * that as unsupported would flash the flat map before the globe on every load.
 *
 * ## Why `useSyncExternalStore` and not an effect
 *
 * Because WebGL support is not React state. It is a fact about the browser that
 * is decided before the page loads and never changes, and this hook reads it
 * rather than owns it. The effect-plus-`setState` version says the same thing and
 * says it as a state transition, which schedules a second render pass React has
 * to be told to expect — the difference between describing an external value and
 * pretending to produce one.
 *
 * `subscribe` is a no-op that returns a no-op unsubscribe, and that is honest:
 * there is no event to listen for. A device does not acquire WebGL mid-session.
 */
export type WebglSupport = boolean | null

/** Nothing to subscribe to — the answer is fixed for the life of the document. */
function subscribe(): () => void {
  return () => {}
}

/**
 * Memoised, and it has to be: `useSyncExternalStore` calls the snapshot on every
 * render and re-renders whenever the value is not identical to last time.
 * Detecting afresh each call would return a new answer that happened to be equal,
 * which is fine for a boolean — and would still burn a canvas and a context per
 * render for a question with one answer.
 */
let cached: boolean | undefined

function getSnapshot(): WebglSupport {
  cached ??= detectWebgl()
  return cached
}

/** No document on the server, so no answer — see "why three states" above. */
function getServerSnapshot(): WebglSupport {
  return null
}

export function useWebglSupport(): WebglSupport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    // webgl2 first, then webgl: three.js prefers 2 and falls back to 1, so
    // accepting either matches what the globe will actually attempt.
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      // Named in the standard as an alias and still the only one some older
      // builds answer to.
      canvas.getContext('experimental-webgl')

    if (!context) return false

    // Released immediately. A detection that leaves a live context behind costs
    // one of the handful a browser allows per page, and this page is about to ask
    // for another one for real.
    const lose = (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()

    return true
  } catch {
    // A throw here is a browser refusing to create the canvas at all, which is
    // the same answer as refusing the context.
    return false
  }
}
