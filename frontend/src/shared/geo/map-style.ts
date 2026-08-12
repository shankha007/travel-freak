import type { StyleSpecification } from 'maplibre-gl'

/**
 * The basemap under the country and subdivision fills.
 *
 * There are two of them, and the fallback is not a degraded mode:
 *
 *  - **MapTiler**, when a key is configured: real tiles, with place names and
 *    roads under the fills.
 *  - **The built-in style**, otherwise: the country polygons the app already
 *    ships, drawn as land over a sea. No third-party request, no key, and it
 *    follows the theme — which the tile basemap cannot do.
 *
 * The map used to read as "a few coloured shapes floating in nothing" because
 * the fallback was a *transparent* background and nothing else: no sea, no
 * landmass, no coastline. The land, coast and glow are layers on the country
 * source (see map-view.tsx) and the sea is a CSS gradient behind the canvas —
 * deliberately CSS, because it is the one surface that must change with the
 * theme without MapLibre reloading its style and rebuilding every source.
 */

/** Muted basemap so the region fills stay the loudest thing on the page. */
const MAPTILER_STYLE = 'dataviz'

export function mapStyleUrl(key: string | undefined): string | StyleSpecification {
  if (key) {
    return `https://api.maptiler.com/maps/${MAPTILER_STYLE}/style.json?key=${key}`
  }
  return blankStyle()
}

/**
 * A valid style with nothing in it, so the sea behind the canvas shows through.
 *
 * Built fresh on every call rather than shared: MapLibre takes ownership of the
 * style object it is given and mutates it in place, so handing the same object
 * to a second map — which React does on a remount — would hand over something
 * already rewritten.
 *
 * No `glyphs` or `sprite` is declared because nothing here draws text or icons;
 * declaring them would make MapLibre fetch assets that do not exist.
 */
export function blankStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        // Transparent on purpose: the water is painted by the container, which
        // can hold a gradient and re-colour itself when the theme changes.
        paint: { 'background-color': 'rgba(0,0,0,0)' },
      },
    ],
  }
}

export function hasBasemap(key: string | undefined): boolean {
  return Boolean(key)
}
