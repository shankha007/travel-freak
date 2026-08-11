# Source layout

Four top-level folders under `src/`, split by **where the code is allowed to run**.

```
src/
├─ app/        routing shell — Next.js requires this path
├─ frontend/   runs in the browser
├─ backend/    runs on the server only
└─ shared/     safe on both sides
```

## The rule

> **Nothing in `backend/` may be imported by a Client Component.**

That is the whole boundary. `backend/env.ts` and `backend/supabase/server.ts` carry the
`server-only` marker, so breaking the rule is a build error rather than a leaked
service-role key.

## What goes where

| Folder      | Contents                                                                   |
| ----------- | -------------------------------------------------------------------------- |
| `app/`      | `layout.tsx`, `page.tsx`, route groups, `globals.css`, `favicon.ico`       |
| `frontend/` | `components/` (incl. shadcn `ui/`), `hooks/`, `features/`, `providers.tsx`, `supabase/client.ts` |
| `backend/`  | `env.ts` (secrets), `supabase/server.ts`, `supabase/proxy.ts`              |
| `shared/`   | `types/` (generated DB types, domain types), `geo/`, `brand.ts`, `format.ts`, `utils.ts` |

`app/` holds routing only — pages should import their UI from `frontend/`. When a route
handler or Server Action is added, it goes in `app/` but pulls its data access from
`backend/`.

## Why these are split

- **`env.ts` is in two places.** `shared/env.ts` exports `publicEnv()`, which Next.js
  inlines into browser bundles. `backend/env.ts` exports `serviceRoleKey()`, which
  bypasses Row Level Security and must never ship to a client.
- **The Supabase clients are in two places.** `frontend/supabase/client.ts` uses the anon
  key and is subject to RLS, so it is the only one allowed in a browser bundle.
  `backend/supabase/` holds the cookie-bound server client and the service-role client.
- **`types/database.ts` is shared** because both Supabase clients are generically typed
  against it.

## What cannot move

`app/`, `public/`, `next.config.ts`, `package.json` and `tsconfig.json` are pinned to
their locations by Next.js — `app/` is only ever resolved at the project root or `src/app`,
and the `appDir` config option is a legacy no-op, not a path setting. `supabase/` stays at
the repo root because the Supabase CLI resolves it relative to the working directory.

Imports use the single `@/*` → `./src/*` alias, so the folder is visible in every import
path: `@/frontend/components/ui/button`, `@/backend/supabase/server`, `@/shared/utils`.
