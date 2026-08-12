import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseChangelog, type Release } from '@/shared/content/changelog'

/**
 * Reads `docs/CHANGELOG.md` off disk and parses it.
 *
 * The file lives outside this app because it documents the whole repository —
 * migrations and schema changes included — and a contributor should not have to
 * know that a marketing page renders it. `/changelog` is statically rendered, so
 * this runs at build time only; nothing reads the filesystem in production.
 *
 * If a host is configured with `frontend/` as its root directory, the build needs
 * access to files above it (on Vercel: "Include source files outside of the Root
 * Directory in the Build Step"). Without that the read fails and the build stops,
 * which is the intended outcome — a changelog page that silently renders empty is
 * worse than one that refuses to build.
 */
const CHANGELOG_PATH = path.join(process.cwd(), '..', 'docs', 'CHANGELOG.md')

export async function getReleases(): Promise<Release[]> {
  let markdown: string
  try {
    markdown = await readFile(CHANGELOG_PATH, 'utf8')
  } catch (cause) {
    throw new Error(
      `Could not read the changelog at ${CHANGELOG_PATH}. If this is a hosted build with ` +
        'frontend/ as the root directory, allow the build to read files outside it.',
      { cause }
    )
  }

  return parseChangelog(markdown)
}
