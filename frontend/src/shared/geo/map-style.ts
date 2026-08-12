import type { StyleSpecification } from 'maplibre-gl'

/**
 * The basemap under the country and subdivision fills.
 *
 * MapTiler serves the vector tiles when a key is configured. Without one the map
 * still works: it falls back to a plain background, and the polygons — which are
 * the actual content — render exactly the same. That matters because the key is
 * optional in local development, and a missing key should not turn the maps into
 * an error screen.
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
 * A valid style with nothing in it but a background.
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
        paint: { 'background-color': 'rgba(0,0,0,0)' },
      },
    ],
  }
}

export function hasBasemap(key: string | undefined): boolean {
  return Boolean(key)
}
