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
