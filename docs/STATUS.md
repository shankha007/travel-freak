# TravelFreak — Delivery status

Feature-by-feature state of the build. Screen numbers refer to §5 of
[PROJECT_PLAN.md](PROJECT_PLAN.md).

This file answers "where does the product stand"; it is not a history. What
shipped, when, and why lives in [CHANGELOG.md](CHANGELOG.md) — the notes that
used to accumulate at the bottom of this file are there now, and new ones go
there rather than here. Keep the gaps at the end of this file current.

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
| Infrastructure | 12 | 0 | 0 | 3 |
| Public / marketing | 2 | 1 | 0 | 7 |
| Auth | 2 | 0 | 0 | 3 |
| Dashboard & globe | 4 | 2 | 0 | 0 |
| Trips & planner | 2 | 1 | 0 | 4 |
| Memory & content | 4 | 1 | 0 | 0 |
| Analytics & resume | 1 | 0 | 1 | 2 |
| Public sharing | 4 | 0 | 0 | 0 |
| Account | 0 | 0 | 1 | 5 |
| **Total** | **31** | **5** | **2** | **24** |

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
| — | **Geo assets** | ✅ Done | `npm run build:geo` writes country outlines plus admin-1 split one file per country, simplified 4% with mapshaper. Natural Earth 50m carries ISO 3166-2 for nine large countries, India among them |
| — | **Public image derivatives** | ✅ Done | `media-public` bucket; sharp re-encodes to WebP ≤1600px on first publication, which drops every metadata block. Tested with the same EXIF parser the uploader uses to read GPS |
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
| 12 | **Changelog** `/changelog` | ✅ Done | Public, no login, statically rendered from `docs/CHANGELOG.md` at build time. Timeline of releases with per-kind sections; the parser refuses a malformed entry rather than dropping it |
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
| 16 | **World map** `/maps/world` | 🟡 Partial | MapLibre 2D, country fills joined by `feature-state`, hover tooltip, click-through to the region modal, layer toggles for visited/current/planned, and the same keyboard-navigable region list as the globe. Subdivisions are gated on `globe_region_detail` and lazy-loaded per visited country. **Filters for year, continent and trip type are not built** |
| 17 | **India map** `/maps/india` | ✅ Done | All 36 states and union territories, free on every plan, fitted to the country on load |

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
| 29 | **Blog reader** `/b/[slug]` | ✅ Done | Public route. Sanitised HTML, byline linking to the author's profile, reading time, linked trip, JSON-LD `Article`, `noindex` on anything unpublished, and the badge only on free plans. The author sees their own drafts behind a notice; everyone else gets the same 404 as a slug that does not exist |
| 30 | Wishlist `/wishlist` | 🔵 Stub | 3 items seeded; already painting `planned` on the globe |
| 31 | Travel timeline `/timeline` | 🔵 Stub | |

## Analytics, resume, recap

| # | Feature | Status | Notes |
|---|---|---|---|
| 32 | Analytics `/analytics` | 🔵 Stub | Phase 1.1 |
| 33 | **Travel resume** `/resume` | ✅ Done | Countries, regions, trips, travel days, years travelling, distance, and distinct places by kind — cities, mountains, beaches, UNESCO sites. Plus the share panel: public URL, copy button, the switch that publishes the profile, and display name and bio |
| 34 | Travel Wrapped | ⬜ Not started | Phase 1.2 |
| 35 | Achievements & XP | ⬜ Not started | Phase 1.2; tables not migrated |

## Public sharing

| # | Feature | Status | Notes |
|---|---|---|---|
| 36 | **Public profile** `/u/[username]` | ✅ Done | Avatar, bio, home city, interests, the resume counters, a read-only globe with its region list, trip cards and published posts. JSON-LD `Person`, canonical URL, `noindex` while private, and the free-plan badge. A private profile 404s for everyone but its owner, who sees a preview notice |
| — | **Sitemap** `/sitemap.xml` | ✅ Done | Public profiles and published posts, listed through the same client a visitor gets so it can never advertise a private page |
| 37 | **Public trip** `/t/[slug]` | ✅ Done | Read-only trip: hero, dates, route, gallery, notes and linked posts, with JSON-LD `Article` and OG images. Photos are published as EXIF-stripped derivatives, never originals |
| — | **Share links (unlisted tokens)** | ✅ Done | Create and revoke from the trip page; `/t/[slug]?k=<token>` opens an unlisted trip and is never indexed. A link to a *private* trip resolves to nothing, so pulling a trip back cannot be undone by an old link |

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

## Known gaps worth fixing next

1. **No map picker on create — but no longer blocked.** Places are still country + free-text
   city, so `trip_places.location` stays null and distance-travelled cannot be computed. The
   world map now exists, so the picker is buildable: it needs a click-to-place mode on the same
   `MapView` plus a geocoder for search. This also unblocks the vault's map tab and lets EXIF
   coordinates be matched to places.
2. **Deleted trips and photos are unreachable.** `restore_trip()` keeps the 30-day promise the
   delete dialogs make, but nothing calls it, and `soft_delete_media()` has no restore at all —
   its object is removed from Storage immediately, so a restored photo would be a broken link.
   Either build a trash view with real restore, or change the copy.
3. **Derivatives are generated lazily, on the first request.** That request pays for the
   re-encode of every photo on the trip, so the first view of a photo-heavy public page is
   slow. The plan wants this in a background job at publish time; the output is identical, so
   this is a latency problem rather than a correctness one. `profiles.strip_exif_on_publish`
   still has nothing reading it — publication always strips, which is the stricter behaviour.
4. **`/register` has no email verification path in production.** Locally `enable_confirmations`
   is off and sign-up returns a session; with confirmations on the form shows "check your
   inbox", but there is no `/verify` route to land on afterwards.
5. **Unlisted blogs still have no share link.** `share_links` is trip-shaped — one `trip_id`
   column — so a post that is `unlisted` remains readable only by its author. Either widen the
   table or give posts their own tokens.
6. **Blog posts cannot contain images.** The sanitiser allows `<img>` and derivatives now
   exist, so what is missing is the studio side: an image button that uploads through the
   existing signed-upload route and inserts the public URL.
7. **HEIC still has no fallback in the vault.** The public page converts it, but the owner's
   own gallery points at the original, so a browser that cannot decode HEIC shows nothing
   there. The same transform would fix it for private views.
8. **The maps have no filters.** The plan asks for year, continent and trip type on screens 14
   and 16; only the visited/current/planned layer toggles are built. Year needs no new data —
   `visited_regions` carries first and last visit — but continent and trip type do.
