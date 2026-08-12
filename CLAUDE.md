@frontend/AGENTS.md

# Every change is logged

`docs/CHANGELOG.md` is published at `/changelog`, so it is part of the product
rather than a courtesy. Anything a user could notice — a screen, a behaviour, a
fixed bug, a limit — gets an entry **in the same change that ships it**, under
the `## Unreleased` heading at the top of the release history. Cutting a version
means renaming that heading to `## <version> — <YYYY-MM-DD> — <title>` and
starting a fresh `Unreleased` block.

The file documents its own format, and
`frontend/src/shared/content/changelog.test.ts` enforces it — an unknown section
heading or an undated release fails `npm test`, not the page. Read the top of
`docs/CHANGELOG.md` before adding an entry.

Groundwork with no user-visible surface (a refactor, a migration nobody can see
yet, a test) belongs under `### Infrastructure`, or nowhere. Do not log which
files moved.

`docs/STATUS.md` is the other half: it says where each screen stands *now*. Keep
its tables and its "Known gaps worth fixing next" current, but put the narrative
of what happened in the changelog.
