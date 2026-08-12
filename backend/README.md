# Backend — Supabase

Postgres schema, Row Level Security policies, storage buckets and local dev data.

```
backend/
├─ package.json          db:* scripts + the Supabase CLI
└─ supabase/
   ├─ config.toml        local stack config (ports, auth, seed)
   ├─ seed.sql           dummy data for local development
   ├─ migrations/        ordered schema changes
   └─ tests/database/    pgTAP suites run against a migrated database
```

## Prerequisites

The local stack runs Postgres, Auth, Storage and Studio in containers, so it
needs **Docker Desktop** (or Podman) on your PATH. Verify with:

```bash
docker --version
```

Without it, `db:start` fails with `failed to inspect container health`.

## Commands

Run from this folder:

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `npm run db:start` | Start the stack, apply migrations, load `seed.sql`        |
| `npm run db:stop`  | Stop the stack (data survives)                            |
| `npm run db:reset` | Drop, replay every migration, reload the seed             |
| `npm run db:diff`  | Diff the live schema against migrations                   |
| `npm run db:types` | Regenerate TS types into `frontend/`                      |
| `npm run db:test`  | Run the pgTAP suites in `supabase/tests/database/`        |

`db:start` prints the API URL and the anon / service-role keys. Copy them into
`frontend/.env.local` (start from `frontend/.env.local.example`).

Local ports: API `54321`, Postgres `54322`, Studio `54323`, Mailpit `54324`.

## Migrations

| File                                | Contents                                                        |
| ----------------------------------- | ---------------------------------------------------------------- |
| `20260807000100_init.sql`           | Enums, all core tables, RLS policies, new-user bootstrap trigger |
| `20260807000200_visited_regions.sql`| The globe aggregate + refresh triggers + denormalized counters   |
| `20260807000300_plans_and_storage.sql`| Plan catalogue and the `media` / `avatars` buckets             |
| `20260811000100_data_api_grants.sql`| Table grants for the `anon` / `authenticated` Data API roles     |
| `20260812000100_visited_regions_visit_trips.sql`| `visit_trip_ids` on the aggregate, so counts combine correctly |
| `20260812000200_soft_delete_trip.sql`| `soft_delete_trip()` / `restore_trip()` — RLS makes a direct `deleted_at` write impossible |
| `20260812000300_soft_delete_media.sql`| `soft_delete_media()` — same trap on `media`, plus releasing the bytes |
| `20260812000400_public_profile_helpers.sql`| Aggregate answers a public profile needs about someone whose rows a visitor cannot read |
| `20260812000500_public_trip_sharing.sql`| `media-public` bucket and `media.public_path` for EXIF-stripped derivatives, plus `resolve_share_link()` for unlisted trips |

Add a migration with `npx supabase migration new <name>`. Never edit an applied
migration — write a new one.

## Tests

```bash
npm run db:test
```

Runs every `supabase/tests/database/*.test.sql` with pgTAP against the running
stack. `rls.test.sql` invents two users and asserts that neither can read or
write the other's trips, places, memories, media, blogs, wishlist, subscription
or usage rows — plus what a signed-out visitor may see, that unpublishing hides
a trip immediately, and that soft-deleting a trip or a photo goes through the
SECURITY DEFINER functions rather than a direct write, which RLS refuses.

Each file runs inside one transaction that is rolled back, so the suite leaves
no rows behind and the pgTAP extension itself is never committed.

## Seed data

`seed.sql` loads automatically on `db:start` and `db:reset` (see `[db.seed]` in
`config.toml`). It creates one demo account:

**demo@travelfreak.app / password123**

with 12 trips across 8 countries, chosen to exercise every globe state:

| Region                    | Trip status | Globe state |
| ------------------------- | ----------- | ----------- |
| India, Japan, Nepal, Thailand, UAE | `completed` | `visited`   |
| Singapore                 | `ongoing`   | `current`   |
| Bhutan                    | `planning`  | `planned`   |
| Iceland, Georgia, Vietnam | wishlist    | `planned`   |

Plus memories, four blog posts and three wishlist entries.

Two deliberate choices:

- **`visited_regions` is never seeded directly.** It is derived from
  `trip_places` and `wishlist_items` by `refresh_visited_regions()`, which the
  insert triggers fire automatically. Writing it by hand would create a second
  source of truth that drifts.
- **No `media` rows.** A media row without a matching object in storage resolves
  to a broken image URL. Upload real files instead; until then the region modal
  correctly shows "No photo yet".

The seed is idempotent — it deletes the demo user first, and every child row
cascades.

## Resetting

```bash
npm run db:reset
```

Drops everything, replays all migrations, reloads the seed. This is the fastest
way back to a known state.
