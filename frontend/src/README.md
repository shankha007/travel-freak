# Source layout

Inside the Next.js app, code is split by **where it is allowed to run**.

```
frontend/src/
├─ app/       routing shell — Next.js requires this path
├─ client/    runs in the browser
├─ server/    runs on the server only
└─ shared/    safe on both sides
```

These are named `client`/`server` rather than `frontend`/`backend` because this whole
folder already lives under `frontend/`. `frontend/src/backend/` would have been a
contradiction. The repo-root split is app-vs-database; this split is client-vs-server
*within* the app. See the [root README](../../README.md).

## The rule

> **Nothing in `server/` may be imported by a Client Component.**

`server/env.ts` and `server/supabase/server.ts` carry the `server-only` marker, so
breaking the rule is a build error rather than a leaked service-role key.

## What goes where

| Folder    | Contents                                                                       |
| --------- | ------------------------------------------------------------------------------ |
| `app/`    | `layout.tsx`, `page.tsx`, route groups, `globals.css`, `favicon.ico`           |
| `client/` | `components/` (incl. shadcn `ui/`), `hooks/`, `features/`, `providers.tsx`, `supabase/client.ts` |
| `server/` | `env.ts` (secrets), `supabase/server.ts`, `supabase/proxy.ts`                  |
| `shared/` | `types/` (generated DB types, domain types), `geo/`, `brand.ts`, `format.ts`, `utils.ts` |

`app/` holds routing only — pages import their UI from `client/`. When a Route Handler or
Server Action is added, it goes in `app/` but pulls its data access from `server/`.

## Why these are split

- **`env.ts` is in two places.** `shared/env.ts` exports `publicEnv()`, which Next.js
  inlines into browser bundles. `server/env.ts` exports `serviceRoleKey()`, which bypasses
  Row Level Security and must never ship to a client.
- **The Supabase clients are in two places.** `client/supabase/client.ts` uses the anon key
  and is subject to RLS, so it is the only one allowed in a browser bundle.
  `server/supabase/` holds the cookie-bound server client and the service-role client.
- **`types/database.ts` is shared** because both Supabase clients are generically typed
  against it. It is generated — run `npm run db:types` from `backend/`.

## What cannot move

`app/`, `public/`, `next.config.ts`, `package.json` and `tsconfig.json` are pinned by
Next.js — `app/` is only ever resolved at the project root or `src/app`, and the `appDir`
config option is a legacy no-op, not a path setting.

Imports use the single `@/*` → `./src/*` alias, so the layer is visible in every import
path: `@/client/components/ui/button`, `@/server/supabase/server`, `@/shared/utils`.
