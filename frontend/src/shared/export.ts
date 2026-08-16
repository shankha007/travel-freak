/**
 * The shape of a data export — screen 44.
 *
 * A right rather than a feature: the GDPR calls it portability, India's DPDP Act
 * calls it access, and the pricing table puts `export_json` on every plan
 * including the free one. What follows is the promise made concrete.
 *
 * Two decisions the format turns on.
 *
 * **It is documented inside itself.** The file lands on someone's disk and is
 * opened years later, possibly by a person who has never heard of this product.
 * So the envelope carries a version, the date, the account it belongs to and a
 * `readme` — a export that needs the exporter's documentation to make sense is
 * not portable, it is just a backup.
 *
 * **It says what it does not contain.** Photographs are files, not rows; a JSON
 * export carries their metadata and the paths they live at, and cannot carry
 * the bytes. Saying so in the file is the difference between an export someone
 * trusts and one they discover the limits of after deleting the account.
 */

/** Bumped when the shape changes in a way a reader would have to handle. */
export const EXPORT_VERSION = 1

export interface ExportAccount {
  id: string
  email: string
  username: string
  memberSince: string
  plan: string
}

/** The tables an export carries, each as the rows belonging to one person. */
export interface ExportContents {
  profile: unknown
  trips: unknown[]
  places: unknown[]
  media: unknown[]
  memories: unknown[]
  albums: unknown[]
  posts: unknown[]
  wishlist: unknown[]
  /** The planner: screens 21, 22 and 23. */
  itineraryDays: unknown[]
  itineraryItems: unknown[]
  expenses: unknown[]
  checklists: unknown[]
  checklistItems: unknown[]
  /** Trips shared with this account, and invitations sent to its address. */
  collaborations: unknown[]
  visitedCountries: unknown[]
  visitedRegions: unknown[]
}

export interface ExportDocument {
  format: string
  version: number
  generatedAt: string
  account: ExportAccount
  readme: string[]
  counts: Record<string, number>
  data: ExportContents
}

/** The order the counts and the readme talk about things. */
export const EXPORT_SECTIONS: (keyof ExportContents)[] = [
  'trips',
  'places',
  'media',
  'memories',
  'albums',
  'posts',
  'wishlist',
  'itineraryDays',
  'itineraryItems',
  'expenses',
  'checklists',
  'checklistItems',
  'collaborations',
  'visitedCountries',
  'visitedRegions',
]

/**
 * Counts every list in the export.
 *
 * Present so a reader can tell an empty export from a broken one without
 * counting by hand — "trips: 0" is an answer, and a missing `trips` key is a
 * bug. The profile is excluded because it is one object, not a list.
 */
export function countSections(data: ExportContents): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const section of EXPORT_SECTIONS) {
    const value = data[section]
    counts[section] = Array.isArray(value) ? value.length : 0
  }
  return counts
}

/**
 * The filename the browser saves it as.
 *
 * Dated, so two exports do not overwrite each other in a downloads folder, and
 * prefixed with the username so a file found later says whose it is. The
 * username is already constrained to `[a-z0-9_]` by the database, and is
 * scrubbed again here anyway — a filename is a place where trusting an
 * upstream constraint costs nothing to avoid.
 */
export function exportFilename(username: string, at: Date = new Date()): string {
  const safe = username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'account'
  return `travelfreak-${safe}-${at.toISOString().slice(0, 10)}.json`
}

/**
 * Assembles the document.
 *
 * Pure, so the envelope can be tested without a database — including the part
 * that matters most, which is that it never claims to hold more than it does.
 */
export function buildExport({
  account,
  data,
  generatedAt = new Date(),
}: {
  account: ExportAccount
  data: ExportContents
  generatedAt?: Date
}): ExportDocument {
  return {
    format: 'travelfreak.export',
    version: EXPORT_VERSION,
    generatedAt: generatedAt.toISOString(),
    account,
    readme: [
      'This is a complete copy of the rows this account owns, as JSON.',
      'Dates are ISO 8601. Coordinates are decimal degrees, latitude then longitude in any pair.',
      'Photographs and other uploads are files rather than rows: `media` lists what you uploaded — the caption, the dimensions, the capture date and the coordinates the camera recorded — and `storagePath` says where each file lives, but the bytes themselves are not in this document.',
      'Anything you deleted in the last 30 days is included and carries a `deletedAt`. Past that window it is gone and is not here.',
      'Nothing here is redacted. If you asked for this to move somewhere else, this is everything there is to move.',
    ],
    counts: countSections(data),
    data,
  }
}
