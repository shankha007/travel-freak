# TravelFreak

Plan trips, document the ones you have taken, and watch your world map fill in.

## Repository layout

```
travel-freak-app/
├─ frontend/    Next.js 16 application (App Router, React 19, Tailwind v4)
└─ backend/     Supabase database — schema migrations and local stack config
```

Each folder is independently installable and has its own `package.json`.

| Folder      | What it is                             | Install                       |
| ----------- | -------------------------------------- | ----------------------------- |
| `frontend/` | The app users load in a browser         | `npm install` in `frontend/`  |
| `backend/`  | Postgres schema, RLS policies, storage  | `npm install` in `backend/`   |

## Docs

| File                                       | What it is                                            |
| ------------------------------------------ | ----------------------------------------------------- |
| [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Product and architecture plan                        |
| [docs/STATUS.md](docs/STATUS.md)           | Where each screen stands right now, plus known gaps    |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)     | What shipped, newest first — published at `/changelog` |

The changelog is rendered into the app at build time, so an entry added there is
an entry published to users. Its own header explains the format; every change
that reaches `master` adds one.

## Getting started

Install and run the app:

```bash
cd frontend && npm install && npm run dev
```

Start the local database (requires Docker):

```bash
cd backend && npm install && npm run db:start
```

Then copy `frontend/.env.local.example` to `frontend/.env.local` and fill in the Supabase
URL and keys that `db:start` prints.

## Common commands

Run these from `frontend/`:

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Dev server on http://localhost:3000   |
| `npm run build`     | Production build                      |
| `npm test`          | Vitest suite                          |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | `next typegen` + `tsc --noEmit`       |
| `npm run build:geo` | Regenerate the country polygon asset  |

Run these from `backend/`:

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run db:start`  | Start the local Supabase stack                    |
| `npm run db:reset`  | Drop and replay all migrations                    |
| `npm run db:types`  | Regenerate TypeScript types into `frontend/`      |

`db:types` writes to `frontend/src/shared/types/database.ts` — the one file that crosses
the boundary, because both Supabase clients are typed against it.

## Making a change

`master` is protected. Pushing to it directly is rejected by the remote, whatever
your permissions:

```
remote: error: GH013: Repository rule violations found for refs/heads/master.
remote: - 2 of 2 required status checks are expected.
```

That is not a misconfiguration to work around — a brand-new commit cannot already
have passing checks, so every change goes through a pull request:

```bash
git switch -c what-you-are-doing
# work, commit
git push -u origin what-you-are-doing
```

Open a pull request. CI runs two jobs — **Frontend** and **Database** — and both
must pass before the merge button unlocks. The branch also has to be up to date
with `master` first, so if someone lands something while yours is open, merge
`master` into your branch and let CI run again.

### Before you push

CI runs exactly this. Running it yourself takes about a minute and saves waiting
three to be told the same thing:

```bash
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
cd ../backend && npm run db:test
```

The second line needs the local stack up (`npm run db:start`, and therefore
Docker). If you have not touched `backend/`, the first line is what CI's Frontend
job runs and is usually enough.

### Two things that are easy to forget

**The changelog entry.** `docs/CHANGELOG.md` is published at `/changelog`, so it
is part of the product rather than a courtesy. Anything a user could notice gets
an entry under `## Unreleased`, in the same commit that ships it.

Note what is and is not enforced. The suite *parses* the file, so a malformed
entry — an unknown section heading, a repeated one, an undated release — fails
`npm test` rather than the page. Nothing checks that you added one. Forgetting is
green in CI and invisible until someone reads the changelog looking for a change
that is in the product and not in the list.

**The database types.** If you touch anything in `backend/supabase/migrations`,
run `npm run db:types` in `backend/` and commit the result. This one CI does
catch, and it is the only thing that would: a migration that changes a table
without regenerating the types compiles, passes every test, and is wrong only at
runtime.

### Commits

Titles here read as sentences about what changed for the person using the app —
"Make leaving as easy as arriving, and take the photographs with you" — rather
than as a summary of the diff. The body is for the *why*, especially the
decisions that a reader would otherwise have to reconstruct: what was rejected,
what is deliberately not covered, and what is known to be still wrong.

## Why the app is not split further

`frontend/` is a full-stack Next.js app, so some of it genuinely runs on a server: Route
Handlers, Server Components and the cookie-bound Supabase client. That code cannot be
lifted into `backend/`, because Next.js has to bundle it. Instead the client/server line is
drawn *inside* the app — see [frontend/src/README.md](frontend/src/README.md).

So the split reads: **`frontend/` is the application, `backend/` is the database.**

## Deploying

Set the project root to `frontend/` in your host (on Vercel: Settings → General → Root
Directory). Migrations in `backend/supabase/migrations` are applied with the Supabase CLI,
not by the app build.

The `/changelog` page reads `docs/CHANGELOG.md` at build time, which is above that root —
so the build also needs "Include source files outside of the Root Directory in the Build
Step" enabled. Without it the build fails with a message naming this setting, rather than
deploying a changelog page with nothing on it.
