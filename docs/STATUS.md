# TravelFreak — Delivery status

Feature-by-feature state of the build. Screen numbers refer to §5 of
[PROJECT_PLAN.md](PROJECT_PLAN.md).

Last updated: 2026-08-12

## Legend

| Mark | Meaning |
|---|---|
| ✅ **Done** | Built, wired to real data, verified in a browser |
| 🟡 **Partial** | Usable, but a stated part of the spec is missing |
| 🔵 **Stub** | Route exists and is navigable; screen is a placeholder |
| ⬜ **Not started** | No route, no code |

---

## Summary

| Area | Done | Partial | Stub | Not started |
|---|---|---|---|---|
| Infrastructure | 11 | 0 | 0 | 3 |
| Public / marketing | 1 | 1 | 0 | 8 |
| Auth | 2 | 0 | 0 | 3 |
| Dashboard & globe | 3 | 1 | 2 | 0 |
| Trips & planner | 2 | 1 | 0 | 4 |
| Memory & content | 4 | 1 | 0 | 0 |
| Analytics & resume | 0 | 0 | 2 | 2 |
| Public sharing | 0 | 0 | 0 | 3 |
| Account | 0 | 0 | 1 | 5 |
| **Total** | **23** | **4** | **5** | **28** |

---

## Infrastructure

| # | Feature | Status | Notes |
|---|---|---|---|
| — | Next.js 16 + TS strict + Tailwind v4 | ✅ Done | App Router, `src/` layered `app / client / server / shared` |
| — | shadcn/ui + Base UI component set | ✅ Done | 21 components installed |
| — | Light/dark theming | ✅ Done | `next-themes`, system default, no flash |
| — | Supabase local stack | ✅ Done | Docker; API 54321, DB 54322, Studio 54323 |
| — | Postgres schema + RLS | ✅ Done | 14 tables, PostGIS, policies on every table |
| — | `visited_regions` aggregate + triggers | ✅ Done | Rebuilt from `trip_places` / `wishlist_items` |
| — | Data API grants | ✅ Done | Migration `20260811000100`; without it PostgREST 42501s every table |
| — | Seed data | ✅ Done | 12 trips, 8 countries, 1 demo account |
| — | Generated DB types | ✅ Done | `npm run db:types` → `shared/types/database.ts` |
| — | `brand.ts` rename safety | ✅ Done | No component hardcodes the product name |
| — | **`entitlements.ts`** | ✅ Done | Reads `plans.limits`; `checkTripQuota()` counts the caller's own live rows rather than trusting the denormalised counter. Gates both `/trips/new` and the create action |
| — | **pgTAP RLS tests** | ✅ Done | `backend/supabase/tests/database/rls.test.sql`, 40 assertions, `npm run db:test`. Two users, cross-user reads and writes, anon visibility, unpublish, soft delete |
| — | HTML sanitisation | ✅ Done | `shared/content/sanitize.ts` — allowlist applied on read, so stored post markup cannot execute on the app's origin |
| — | **Storage + signed uploads** | ✅ Done | Private `media` bucket, keys `<user>/<trip>/<media>.<ext>` matching the storage policies. Reads go out as one-hour signed URLs; `next/image` is allow-listed to the storage host only |
| — | Framer Motion | ⬜ Not started | Not installed |
| — | CI (GitHub Actions) | ⬜ Not started | lint/typecheck/test all pass locally |
| — | Sentry + PostHog | ⬜ Not started | Plan wants the funnel instrumented on day one |

## Public / marketing

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | **Landing** `/` | ✅ Done | Hero with live demo globe, 6 feature cards, 3 pricing tiers, CTA |
| 3 | Pricing | 🟡 Partial | Rendered on the landing page from hardcoded copy, not from `plans.limits`; no `/pricing` route or annual toggle |
| 2 | Features `/features` | ⬜ Not started | |
| 4 | Public blogs `/blogs` | ⬜ Not started | Marketing index, distinct from the authenticated `/blogs` |
| 5 | About | ⬜ Not started | Phase 1.1 |
| 6 | Contact | ⬜ Not started | Phase 1.1 |
| 11 | Legal (privacy/terms/refunds) | ⬜ Not started | MVP requirement |
| 12 | Changelog | ⬜ Not started | Phase 1.1 |
| — | OG image endpoint | ⬜ Not started | Phase 1.1 |
| — | SEO (JSON-LD, sitemap, RSS) | ⬜ Not started | |

## Auth

| # | Feature | Status | Notes |
|---|---|---|---|
| 8 | **Login** `/login` | ✅ Done | Email + password, Zod-validated, generic error copy, `?next=` preserved and open-redirect guarded |
| — | Session refresh + route protection | ✅ Done | `src/proxy.ts`; `getUser()` not `getSession()` |
| — | Sign out | ✅ Done | Server Action, clears httpOnly cookies |
| 7 | **Register** `/register` | ✅ Done | Email + password + optional name, shared Zod schema, 8-character minimum matching `config.toml`. Handles both projects that require email confirmation and local, where sign-up returns a session immediately. Profile, `explorer` subscription and usage row come from the `on_auth_user_created` trigger |
| 9 | Forgot / reset / verify | ⬜ Not started | |
| 10 | Onboarding wizard `/welcome` | ⬜ Not started | "Tap countries you've visited" is the instant-payoff moment |
| — | Google OAuth | ⬜ Not started | |

## Dashboard & signature views

| # | Feature | Status | Notes |
|---|---|---|---|
| 13 | **Dashboard** `/dashboard` | ✅ Done | 8 live stat cards, world-progress bar, upcoming-trip widget, recent activity |
| 14 | **Travel Globe** `/globe` | ✅ Done | Real `visited_regions`; 4-state colouring; region list; empty state |
| 15 | **Country/region modal** | ✅ Done | Trips, memories, dates, cities; deep-linkable `?region=IND` |
| — | Globe region-detail paywall | ✅ Done | `showRegionDetail` from `planCode`, decided server-side |
| — | Dashboard globe preview | 🟡 Partial | Query exists (`getGlobePreviewRegions`); card links to `/globe` instead of embedding |
| 16 | World map `/maps/world` | 🔵 Stub | Needs a MapTiler key |
| 17 | India map `/maps/india` | 🔵 Stub | |

## Trips & planner

| # | Feature | Status | Notes |
|---|---|---|---|
| 18 | **My Trips** `/trips` | ✅ Done | Tabs All/Past/Ongoing/Upcoming/Drafts with counts, flags, places, visibility |
| 19 | **Create trip** `/trips/new` | 🟡 Partial | 4-step wizard (basics → dates → places → visibility), quota-gated, writes trip + places. **No map picker or cover image** — both need screens that do not exist yet |
| 20 | **Trip details** `/trips/[id]` | ✅ Done | Hero, stats, route timeline, memories, linked blogs, gallery counts, details panel, and now **Edit**. Route map still waits on coordinates |
| — | **Edit trip** `/trips/[id]/edit` | ✅ Done | Same wizard as create (`TripForm`), saveable from any step. Slug and `published_at` are deliberately stable; places are matched by id so memories stay pinned |
| — | **Delete trip** | ✅ Done | Confirm dialog → `soft_delete_trip()`; sets `deleted_at`, repaints the globe, frees quota, destroys nothing. `restore_trip()` exists for the 30-day window but has no UI yet |
| 21 | Itinerary builder | ⬜ Not started | Tables not yet migrated |
| 22 | Budget planner | ⬜ Not started | `expenses` table not yet migrated |
| 23 | Packing / checklists | ⬜ Not started | Phase 1.1 |
| 24 | Collaborators | ⬜ Not started | Phase 1.2; `trip_collaborators` table and policies exist |

## Memory & content

| # | Feature | Status | Notes |
|---|---|---|---|
| 25 | **Memory Vault** `/trips/[id]/vault` | 🟡 Partial | Timeline and Gallery are live: photos and notes interleaved by date, photo detail with caption, alt text, cover photo and delete, plus a note composer. **Map view is an explained placeholder** — it needs place coordinates, which arrive with the world map screen |
| 26 | **Media upload + quota meter** | ✅ Done | `POST /api/uploads/sign` issues a quota-checked signed URL, the browser PUTs straight to Storage, and `confirmUpload` re-reads the object's real size and sniffs its magic bytes before writing the row. Drag-drop, per-file progress, per-trip and pool meters, EXIF date and GPS captured on the client |
| 27 | **Blog Studio** `/blogs/new`, `/blogs/[id]/edit` | ✅ Done | Tiptap v3 with a formatting toolbar, autosave (1.5s debounce, ⌘S, unload guard), excerpt and SEO fields, trip link, visibility, publish/unpublish, soft delete. A new post writes no row until the first save, then swaps the URL in place so the cursor survives. Slugs follow the title until publication and freeze after |
| 28 | **My Blogs** `/blogs` | ✅ Done | All / Published / Drafts with counts, reading time, linked trip, and a link to the public reader |
| 29 | **Blog reader** `/b/[slug]` | ✅ Done | Public route. Sanitised HTML, byline, reading time, linked trip, JSON-LD `Article`, `noindex` on anything unpublished, free-plan badge. The author sees their own drafts behind a notice; everyone else gets the same 404 as a slug that does not exist |
| 30 | Wishlist `/wishlist` | 🔵 Stub | 3 items seeded; already painting `planned` on the globe |
| 31 | Travel timeline `/timeline` | 🔵 Stub | |

## Analytics, resume, recap

| # | Feature | Status | Notes |
|---|---|---|---|
| 32 | Analytics `/analytics` | 🔵 Stub | Phase 1.1 |
| 33 | Travel resume `/resume` | 🔵 Stub | MVP; the shareable artifact |
| 34 | Travel Wrapped | ⬜ Not started | Phase 1.2 |
| 35 | Achievements & XP | ⬜ Not started | Phase 1.2; tables not migrated |

## Public sharing

| # | Feature | Status | Notes |
|---|---|---|---|
| 36 | Public profile `/u/[username]` | ⬜ Not started | RLS policy for public profiles already exists |
| 37 | Public trip `/t/[slug]` | ⬜ Not started | 6 public trips already readable by anon — verified |
| — | Share links (unlisted tokens) | ⬜ Not started | `share_links` table exists |

## Account

| # | Feature | Status | Notes |
|---|---|---|---|
| 39 | Profile settings | 🔵 Stub | One `/settings` route covers 39–41 for now |
| 40 | Account & security | ⬜ Not started | |
| 41 | Privacy + EXIF toggle | ⬜ Not started | `strip_exif_on_publish` column exists, defaults on |
| 42 | Notifications | ⬜ Not started | Phase 1.1 |
| 43 | Subscription & billing | ⬜ Not started | Phase 1.2 |
| 44 | Data export & deletion | ⬜ Not started | Legal requirement (GDPR / DPDP) |
| 46 | Admin panel | ⬜ Not started | Phase 1.2 |

## Global UI

| Feature | Status | Notes |
|---|---|---|
| Sidebar + mobile bottom nav | ✅ Done | Driven by `shared/navigation.ts`; stubs marked "soon" |
| Light/dark toggle | ✅ Done | |
| Skeleton loaders | 🟡 Partial | Globe and login only |
| Empty states | 🟡 Partial | Globe, trips, dashboard activity |
| Command palette (⌘K) | ⬜ Not started | |
| Sidebar quota meter | ⬜ Not started | Needs `entitlements.ts` |
| `error.tsx` / `not-found.tsx` per group | 🟡 Partial | `not-found.tsx` for `/trips/[id]` and `/b/[slug]`; no `error.tsx` anywhere |
| Toasts | ⬜ Not started | `sonner` installed and mounted |

---

## Fixed on 2026-08-12

The five gaps previously listed here, four of which are now closed, plus three
bugs the work uncovered.

1. **Trip edit and delete** — shipped, see screens 19–20 above.
2. **The two 404s** — `/register` and `/b/[slug]` both exist.
3. **Map picker** — still open, see below. It genuinely depends on the world-map screen.
4. **pgTAP RLS tests** — 40 assertions, `npm run db:test`.
5. **`rollUpToCountries` trip counting** — the aggregate now carries
   `visit_trip_ids` (migration `20260812000100`) and the roll-up unions them, so a
   country visited on four trips reads as 4 and one trip across three states still
   reads as 1. Against the seed: India went 1 → 4, Nepal and Thailand 1 → 2, Japan
   correctly stayed 1.

Found while building the above:

- **Soft delete was impossible for anyone.** On UPDATE, Postgres requires the new
  row to satisfy the table's SELECT policies, and `trips_select_own` ends in
  `deleted_at is null` — so setting `deleted_at` failed with 42501 for the owner
  too. Fixed with the `soft_delete_trip()` / `restore_trip()` SECURITY DEFINER
  pair rather than by loosening the policy (migration `20260812000200`). The test
  suite now asserts both the refusal and the working path.
- **Owner screens leaked other users' public data.** The dashboard, trips list,
  globe and — worst — `checkTripQuota()` filtered by nothing, relying on RLS to
  scope rows. RLS is a ceiling, not a scope: `trips` also exposes every published
  public trip. A brand-new account opened on a dashboard reading "7 countries,
  6 trips" and started life partway through its plan limit. Every owner-scoped
  query now filters `user_id` explicitly.
- **The account menu crashed on open**, taking sign-out with it: `DropdownMenuLabel`
  maps to Base UI's `Menu.GroupLabel`, which throws outside a `Menu.Group`.

## Also on 2026-08-12 — Blog Studio

Screens 27 and 28, which closes the MVP's content loop: a trip can now be
written up, published, and read at a public URL without touching the database.

Two things worth knowing about how it behaves:

- **A new post writes no row until the first autosave**, so an abandoned
  `/blogs/new` leaves nothing behind. That save returns an id and the URL is
  swapped with `history.replaceState`; a router navigation would remount the
  editor and take the writer's cursor with it.
- **Publishing never changes visibility.** A private post cannot be published —
  the button is disabled and the server refuses — because quietly flipping
  someone's privacy setting to make a button work is how people publish things
  they did not mean to.

Two more bugs found while verifying it:

- **Toolbar buttons applied formatting at the top of the document** rather than
  at the cursor: pressing a button moved focus, the selection collapsed, and
  `chain().focus()` restored the last known caret. Fixed by preventing the
  default on mousedown.
- **The editor placeholder never rendered.** Tiptap's Placeholder extension only
  sets `data-placeholder`; showing it is the stylesheet's job, and the rule was
  missing from `globals.css`.

## Also on 2026-08-12 — media upload and the Memory Vault

Screens 25 and 26. The plan's critical path: photos go from the browser
straight to Storage, and the server's only jobs are saying yes and recording
what landed.

- **`POST /api/uploads/sign`** is the quota gate. It re-checks trip ownership,
  the declared type and size, the per-trip photo cap and the storage pool, then
  issues a signed URL. A 402 (not a 403) comes back on a plan limit, and the
  uploader turns that into an upgrade card rather than an error.
- **`confirmUpload` does not trust the client.** It re-reads the object's real
  size from Storage, re-runs the quota against that, and identifies the file
  from its leading bytes. A file that is not really an image is deleted rather
  than recorded, so nothing orphaned is left counting against the pool.
- **Uploads run one at a time**, because the quota is counted per request and
  five parallel uploads against a limit of five would all be told yes.
- Photos are served only as one-hour signed URLs. EXIF GPS is stored for the
  owner and never sent to the client — the vault only learns whether a photo
  *has* coordinates.

Two bugs found while verifying:

- **An HTML page uploaded as `.png` was accepted**, because the type recorded by
  Storage is just the header the browser sent. That is what the magic-byte
  sniffing now catches; there are unit tests for the signatures, including the
  404-page case that exposed it.
- **Photos could not be deleted**: `media` has the same policy shape as `trips`,
  so setting `deleted_at` failed with 42501 for the photo's own owner. Fixed
  with `soft_delete_media()` (migration `20260812000300`), which also releases
  the bytes and clears the trip cover. The pgTAP suite now asserts both.

## Known gaps worth fixing next

1. **No map picker on create.** Places are country + free-text city, so `trip_places.location`
   (the PostGIS point) is left null. Distance-travelled and nearest-city snapping cannot be
   computed until the world map screen lands and supplies coordinates. Unchanged, and still
   blocked on screen 16.
2. **Deleted trips and photos are unreachable.** `restore_trip()` keeps the 30-day promise the
   delete dialogs make, but nothing calls it, and `soft_delete_media()` has no restore at all —
   its object is removed from Storage immediately, so a restored photo would be a broken link.
   Either build a trash view with real restore, or change the copy.
3. **No image derivatives, so no photos on public pages yet.** Originals are stored with their
   EXIF intact, which is right for the owner and wrong for anyone else: publishing one would
   leak the GPS the plan calls a safety issue. Public trip pages (screen 37) and images inside
   blog posts both wait on a resize-and-strip step. `profiles.strip_exif_on_publish` already
   defaults on and has nothing to enforce it.
4. **`/register` has no email verification path in production.** Locally `enable_confirmations`
   is off and sign-up returns a session; with confirmations on the form shows "check your
   inbox", but there is no `/verify` route to land on afterwards.
5. **Unlisted blogs have no share link.** `visibility = 'unlisted'` is readable only by the
   author, because the `share_links` token flow is not built yet.
6. **HEIC has no fallback.** iPhone photos upload and store fine, but browsers that cannot
   decode HEIC show nothing and record no dimensions — the same derivative pipeline fixes it.
