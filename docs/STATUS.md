# TravelFreak — Delivery status

Feature-by-feature state of the build. Screen numbers refer to §5 of
[PROJECT_PLAN.md](PROJECT_PLAN.md).

This file answers "where does the product stand"; it is not a history. What
shipped, when, and why lives in [CHANGELOG.md](CHANGELOG.md) — the notes that
used to accumulate at the bottom of this file are there now, and new ones go
there rather than here. Keep the gaps at the end of this file current.

Last updated: 2026-08-15 · current release: 0.12.0

Every ✅ below was re-checked in a browser against the local stack on 2026-08-13,
including sign-in, the globe and both maps on a free and a paid plan, the trip
and blog screens, delete → trash → restore, and a share link through create,
open, revoke and pull-back.

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
| Infrastructure | 20 | 0 | 0 | 1 |
| Public / marketing | 8 | 0 | 0 | 2 |
| Auth | 6 | 0 | 0 | 1 |
| Dashboard & globe | 5 | 2 | 0 | 0 |
| Trips & planner | 5 | 1 | 0 | 4 |
| Memory & content | 7 | 0 | 0 | 0 |
| Analytics & resume | 2 | 0 | 0 | 2 |
| Public sharing | 5 | 0 | 0 | 0 |
| Account | 3 | 1 | 0 | 3 |
| **Total** | **61** | **4** | **0** | **13** |

---

## Infrastructure

| # | Feature | Status | Notes |
|---|---|---|---|
| — | Next.js 16 + TS strict + Tailwind v4 | ✅ Done | App Router, `src/` layered `app / client / server / shared` |
| — | shadcn/ui + Base UI component set | ✅ Done | 21 components installed |
| — | Light/dark theming | ✅ Done | `next-themes`, system default, no flash |
| — | Supabase local stack | ✅ Done | Docker; API 54321, DB 54322, Studio 54323 |
| — | Postgres schema + RLS | ✅ Done | 14 tables, PostGIS, policies on every table. `trip_places.location` is written as EWKT and read back through generated `latitude`/`longitude` columns, because PostgREST returns geography as hex EWKB — see `shared/geo/point.ts` |
| — | `visited_regions` aggregate + triggers | ✅ Done | Rebuilt from `trip_places` / `visited_countries` / `wishlist_items`, in that precedence — a bare "been there" mark never displaces what a logged trip knows |
| — | Data API grants | ✅ Done | Migration `20260811000100` for `anon`/`authenticated`, `20260813000400` for `service_role` — without the latter every elevated read (share tokens, derivatives) 42501s |
| — | Seed data | ✅ Done | 12 trips, 8 countries, 1 demo account. Places carry pins, so routes, distances and the vault's map are visible in a fresh checkout; Kolkata and Thimphu deliberately have none, covering the unpinned and part-pinned cases. No `media` rows — a row without a storage object breaks more than it demonstrates |
| — | Generated DB types | ✅ Done | `npm run db:types` → `shared/types/database.ts` |
| — | `brand.ts` rename safety | ✅ Done | No component hardcodes the product name |
| — | **`entitlements.ts`** | ✅ Done | Reads `plans.limits`; `checkTripQuota()` counts the caller's own live rows rather than trusting the denormalised counter. Gates both `/trips/new` and the create action |
| — | **pgTAP RLS tests** | ✅ Done | `backend/supabase/tests/database/rls.test.sql`, 86 assertions, `npm run db:test`. Two users, cross-user reads and writes, anon visibility, unpublish, soft delete, trip and post share tokens, and the trash listing |
| — | HTML sanitisation | ✅ Done | `shared/content/sanitize.ts` — allowlist applied on read, so stored post markup cannot execute on the app's origin |
| — | **Storage + signed uploads** | ✅ Done | Private `media` bucket, keys `<user>/<trip>/<media>.<ext>` — or `<user>/posts/<post>/<media>.<ext>` for post images — matching the storage policies, which only read the first segment. Reads go out as one-hour signed URLs; `next/image` is allow-listed to the storage host only |
| — | **Geo assets** | ✅ Done | `npm run build:geo` writes country outlines plus admin-1 split one file per country, simplified 4% with mapshaper. Natural Earth 50m carries ISO 3166-2 for nine large countries, India among them. The map reads `admin1/index.json` before fetching, so an uncovered country costs no request |
| — | **Public image derivatives** | ✅ Done | `media-public` bucket; sharp re-encodes to WebP ≤1600px, dropping every metadata block — on first publication for trip photos, at upload for post images, whose URL has to live in stored HTML. Tested with the same EXIF parser the uploader uses to read GPS |
| — | **Framer Motion** | ✅ Done | `shared/motion.ts` owns three durations and one easing curve; `client/components/motion/reveal.tsx` owns the only entrance animation. `MotionConfig reducedMotion="user"` in `providers.tsx` drops the movement and keeps the fade for anyone who asks, so no component has to check. Reveals ship as `opacity: 0`, so the root layout carries a `<noscript>` rule that pins them visible |
| — | **`contact_messages`** | ✅ Done | RLS on with no policy: nobody reads it through the Data API but the service role. Writes go through `submit_contact_message()`, a security-definer function holding the length checks and a limit of five per address per hour. 12 pgTAP assertions |
| — | **Scheduled purge** | ✅ Done | `/api/cron/purge-trash` empties trash past its 30 days — trips and posts alike, including the images inside a post now that `media.post_id` exists — files first, while the rows naming them still exist, then the rows. Guarded by `CRON_SECRET` compared in constant time; unset closes the endpoint rather than opening it. `vercel.json` runs it daily. Idempotent — everything is chosen by a cutoff — so a missed day costs a day and a double run costs nothing |
| — | **CI (GitHub Actions)** | ✅ Done | `.github/workflows/ci.yml`, on every push and pull request. Frontend: format, lint, types, tests, production build — with dummy Supabase env, because a build that needs production credentials is one nobody can reproduce. Database: the full stack, `supabase test db`, and a check that the generated types match the migrations. The CLI is pinned rather than `latest`, so a CLI release cannot turn an unrelated pull request red |
| — | Sentry + PostHog | ⬜ Not started | Plan wants the funnel instrumented on day one |

## Public / marketing

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | **Landing** `/` | ✅ Done | Hero with live demo globe, 6 feature cards, 3 pricing tiers, CTA |
| 3 | **Pricing** `/pricing` | ✅ Done | Own route, read from `plans` — cards, monthly/annual toggle with the real saving, and a comparison table whose every cell is a function of `limits`, so it cannot drift from what `entitlements.ts` enforces. Landing keeps one line and a link; every in-app upgrade prompt points here |
| 4 | **Public blogs** `/b` | ✅ Done | Every published public post, newest first — byline, linked trip and reading time, with the newest in a wide card. **Not at `/blogs`**: the authenticated My Blogs screen owns that path, and `/b` is the index of the `/b/[slug]` posts it lists. Read through the visitor's client, so RLS decides the contents; a post whose trip is not published links to no trip. `Blog` JSON-LD and a sitemap entry |
| 5 | **About** `/about` | ✅ Done | Why the product exists and the four promises it is built to — private by default, no ads on any plan, exportable data, free at country level. Statically rendered, `AboutPage` JSON-LD. Deliberately about the product, not an invented team |
| 2 | Features `/features` | ⬜ Not started | |
| 6 | **Contact** `/contact` | ✅ Done | Seven topics, Zod-validated, no account needed. A rejected message comes back with every field still filled, including the topic. A honeypot is answered with the same acknowledgement a person gets, so a bot learns nothing. The path you wrote from is sent; nothing else about the visit is |
| 11 | **Legal** `/privacy`, `/terms`, `/refunds` | ✅ Done | One renderer over `shared/content/legal.ts`, so three documents cannot drift into three typographic treatments. Each states its effective date and carries a contents list — capped and scrollable on a phone, sticky on desktop. `legal.test.ts` enforces unique anchors, non-empty blocks, a date that has already arrived and a contact address in every document. Written by the people who built the product, not by counsel |
| 12 | **Changelog** `/changelog` | ✅ Done | Public, no login, statically rendered from `docs/CHANGELOG.md` at build time. Timeline of releases with per-kind sections; the parser refuses a malformed entry rather than dropping it |
| — | **Share cards** | ✅ Done | `opengraph-image.tsx` at four segments rather than the plan's `/api/og/*` — the file convention generates the URL, the size metadata and the cache headers, which hand-rolled routes would have meant hand-rolling too. A profile and a trip card draw a real world map with the relevant countries filled, from `shared/geo/project.ts` (pure, unit-tested, two SVG paths for 177 countries). Every card reads through the visitor's client, so a private trip, an unpublished post and a private profile all fall back to the site card — the same one an unknown URL gets, which is what stops the endpoint confirming that a username exists |
| — | SEO (JSON-LD, sitemap, RSS) | ⬜ Not started | |

## Auth

| # | Feature | Status | Notes |
|---|---|---|---|
| 8 | **Login** `/login` | ✅ Done | Email + password, Zod-validated, generic error copy, `?next=` preserved and open-redirect guarded |
| — | Session refresh + route protection | ✅ Done | `src/proxy.ts`; `getUser()` not `getSession()` |
| — | Sign out | ✅ Done | Server Action, clears httpOnly cookies |
| 7 | **Register** `/register` | ✅ Done | Email + password + optional name, shared Zod schema, 8-character minimum matching `config.toml`. Handles both projects that require email confirmation and local, where sign-up returns a session immediately. Profile, `explorer` subscription and usage row come from the `on_auth_user_created` trigger |
| 9 | **Forgot / reset / verify** | ✅ Done | `/forgot-password` answers the same way whichever address is typed, so it cannot be used to ask who has an account. `/auth/confirm` trades an emailed token for a session and forwards — it takes a `token_hash`, which is verified server-side and so works on a different device, and still accepts a PKCE `code` for a project on the stock templates. `/reset-password` requires that session; `/verify` covers confirmed, expired and opened-directly, and offers the remedy matching the link that failed. Email templates live in `backend/supabase/templates/` |
| 10 | **Onboarding wizard** `/welcome` | ✅ Done | Username, home country, then tap the countries you have been to on a map that fills in as you go, with a searchable list beside it. Each step saves before advancing, so it resumes; only the last sets `onboarded_at`, which is what the app shell gates on |
| — | Google OAuth | ⬜ Not started | |

## Dashboard & signature views

| # | Feature | Status | Notes |
|---|---|---|---|
| 13 | **Dashboard** `/dashboard` | ✅ Done | 8 live stat cards, world-progress bar, upcoming-trip widget, recent activity |
| 14 | **Travel Globe** `/globe` | ✅ Done | Real `visited_regions`; 4-state colouring; region list; empty state |
| 15 | **Country/region modal** | ✅ Done | Trips, memories, dates, cities; deep-linkable `?region=IND` |
| — | Globe region-detail paywall | ✅ Done | `showRegionDetail` from `planCode`, decided server-side |
| — | Dashboard globe preview | 🟡 Partial | Query exists (`getGlobePreviewRegions`); card links to `/globe` instead of embedding |
| 16 | **World map** `/maps/world` | 🟡 Partial | MapLibre 2D filling the page, with a basemap it draws itself — land, coastline and sea from the palette, no tile key needed. Country fills joined by `feature-state`, a halo on regions with data, hover lift, click-through to the region modal, layer toggles, and a floating places panel that is the keyboard-navigable equivalent. Subdivisions are gated on `globe_region_detail` and lazy-loaded only for the nine countries that have data. **Filters for year, continent and trip type are not built** |
| 17 | **India map** `/maps/india` | ✅ Done | All 36 states and union territories, free on every plan, fitted to the country on load |

## Trips & planner

| # | Feature | Status | Notes |
|---|---|---|---|
| 18 | **My Trips** `/trips` | ✅ Done | Tabs All/Past/Ongoing/Upcoming/Drafts with counts, flags, places, visibility |
| 19 | **Create trip** `/trips/new` | 🟡 Partial | 4-step wizard (basics → dates → places → visibility), quota-gated, writes trip + places, and each place can carry a pin set by map click or place search. **No cover image** — that still needs a screen that does not exist |
| 20 | **Trip details** `/trips/[id]` | ✅ Done | Hero, stats, route timeline, memories, linked blogs, gallery counts, details panel, Edit and Share. Route map is buildable now that places carry coordinates |
| — | **Edit trip** `/trips/[id]/edit` | ✅ Done | Same wizard as create (`TripForm`), saveable from any step. Slug and `published_at` are deliberately stable; places are matched by id so memories stay pinned |
| — | **Delete trip** | ✅ Done | Confirm dialog → `soft_delete_trip()`; sets `deleted_at`, repaints the globe, frees quota, destroys nothing. Restorable from `/trash` for 30 days |
| — | **Trash** `/trash` | ✅ Done | Trips and posts deleted in the last 30 days, with restore, a countdown and a count of what comes back. Reads deleted trips through `list_deleted_trips()`, because `trips_select_own` hides them from their own owner. Restoring is refused when it would breach the plan's trip limit |
| 21 | Itinerary builder | ⬜ Not started | Tables not yet migrated |
| 22 | Budget planner | ⬜ Not started | `expenses` table not yet migrated |
| 23 | Packing / checklists | ⬜ Not started | Phase 1.1 |
| 24 | Collaborators | ⬜ Not started | Phase 1.2; `trip_collaborators` table and policies exist |

## Memory & content

| # | Feature | Status | Notes |
|---|---|---|---|
| 25 | **Memory Vault** `/trips/[id]/vault` | ✅ Done | Timeline, Gallery and Map. Timeline interleaves photos and notes by date; photo detail carries caption, alt text, coordinates, cover photo and a confirmed delete. The map draws pinned places as numbered stops joined in visit order, and photos at their EXIF coordinates or — dashed, and labelled — at the stop whose dates contain them. Photos matching neither are listed with the reason. `shared/geo/photo-placement.ts` owns that policy and is unit-tested |
| 26 | **Media upload + quota meter** | ✅ Done | `POST /api/uploads/sign` issues a quota-checked signed URL, the browser PUTs straight to Storage, and `confirmUpload` re-reads the object's real size and sniffs its magic bytes before writing the row. Drag-drop, per-file progress, per-trip and pool meters, EXIF date and GPS captured on the client |
| 27 | **Blog Studio** `/blogs/new`, `/blogs/[id]/edit` | ✅ Done | Tiptap v3 with a formatting toolbar, **inline images**, autosave (1.5s debounce, ⌘S, unload guard), excerpt and SEO fields, trip link, visibility, publish/unpublish, soft delete and a **share panel** for unlisted links. A new post writes no row until the first save, then swaps the URL in place so the cursor survives. Images upload through the signed-upload route and are inserted as EXIF-stripped copies |
| 28 | **My Blogs** `/blogs` | ✅ Done | All / Published / Drafts with counts, reading time, linked trip, and a link to the public reader |
| 29 | **Blog reader** `/b/[slug]` | ✅ Done | Public route. Sanitised HTML, byline linking to the author's profile, reading time, linked trip, JSON-LD `Article`, `noindex` on anything unpublished or opened with a token, and the badge only on free plans. `?k=<token>` opens an unlisted post through `resolve_post_share_link()`; the author sees their own drafts behind a notice, and everyone else gets the same 404 as a slug that does not exist |
| 30 | **Wishlist** `/wishlist` | ✅ Done | Add, edit and remove, grouped by priority with its label always spelled out. Country is the only required field — the globe needs nothing else. Writes revalidate the globe, both maps and the dashboard, because `wishlist_items` is a source for `visited_regions` and a stale page would keep painting a deleted wish. The one-row-per-country index surfaces as a sentence, not an error, and a rejected save is echoed back into the form rather than cleared by React's reset. A country already visited is flagged on its card |
| 31 | **Travel timeline** `/timeline` | ✅ Done | Year sections newest first with a jump row, trips and published posts interleaved. Per-year stats come from `shared/timeline.ts`, which is pure and unit-tested because they are claims about someone's life: days are counted in the year actually spent (a New Year crossing splits), travel booked is counted apart from travel taken, and "first time in" reads `visited_regions` filtered to `visited`/`current` — a planned trip has reached nowhere. Undated trips get a trailing section rather than being dropped. Free on every plan |

## Analytics, resume, recap

| # | Feature | Status | Notes |
|---|---|---|---|
| 32 | **Analytics** `/analytics` | ✅ Done | Days away per year, with travel booked stacked apart from travel taken and the empty years drawn rather than skipped; longest, shortest and average trip; distance with the count of trips it could actually measure. Behind `analytics_advanced`: the day-by-day calendar, who you travel with, the countries you return to, and planned budgets grouped per currency — never summed across them, because there is no exchange rate here. `shared/analytics.ts` is pure and holds all of it, with 28 assertions |
| 33 | **Travel resume** `/resume` | ✅ Done | Countries, regions, trips, travel days — counted by `totalDaysAway` in `shared/timeline.ts`, the same definition the timeline and analytics use, so the three cannot disagree — years travelling, distance, and distinct places by kind — cities, mountains, beaches, UNESCO sites. Plus the share panel: public URL, copy button, the switch that publishes the profile, and display name and bio |
| 34 | Travel Wrapped | ⬜ Not started | Phase 1.2 |
| 35 | Achievements & XP | ⬜ Not started | Phase 1.2; tables not migrated |

## Public sharing

| # | Feature | Status | Notes |
|---|---|---|---|
| 36 | **Public profile** `/u/[username]` | ✅ Done | Avatar, bio, home city, interests, the resume counters, a read-only globe with its region list, trip cards and published posts. JSON-LD `Person`, canonical URL, `noindex` while private, and the free-plan badge. A private profile 404s for everyone but its owner, who sees a preview notice |
| — | **Sitemap** `/sitemap.xml` | ✅ Done | Public profiles and published posts, listed through the same client a visitor gets so it can never advertise a private page |
| 37 | **Public trip** `/t/[slug]` | ✅ Done | Read-only trip: hero, dates, route, gallery, notes and linked posts, with JSON-LD `Article` and OG images. Photos are published as EXIF-stripped derivatives, never originals |
| — | **Post share links** | ✅ Done | `share_links.post_id` (migration `20260813000200`) with a check constraint keeping one row to one target. Created and revoked from the studio; a token resolves only while the post is unlisted-or-public **and** published |
| — | **Share links (unlisted tokens)** | ✅ Done | Create and revoke from the trip page; `/t/[slug]?k=<token>` opens an unlisted trip and is never indexed. A link to a *private* trip resolves to nothing, so pulling a trip back cannot be undone by an old link |

## Account

| # | Feature | Status | Notes |
|---|---|---|---|
| 39 | **Profile settings** `/settings` | ✅ Done | Username, display name, bio, home country and city, and interests. A rename warns — before it is saved — that the public address moves and old links break, and a taken username comes back as a sentence with everything else you typed still in the form. Interests are parsed by `parseInterests`, which is unit-tested because it is the one lossy step: duplicates, blanks and runs of whitespace have to disappear rather than land on a public profile |
| 40 | **Account & security** | 🟡 Partial | Change of email — the link goes to the new address and nothing changes until it is opened, with the pending address shown so the wait is visible — and change of password, which verifies the current one by hand rather than relying on `secure_password_change` being set. **2FA and session management are not built** |
| 41 | **Privacy** | ✅ Done | The public-profile switch, and the visibility a new trip starts on — read by `/trips/new`, so it is a setting rather than a stored preference nothing consults. Editing a trip ignores it deliberately. **Not a toggle: EXIF.** `strip_exif_on_publish` still has nothing reading it and publication always strips; the screen says so plainly rather than offering a control whose off position would publish the GPS in someone's photographs |
| 42 | Notifications | ⬜ Not started | Phase 1.1 |
| 43 | Subscription & billing | ⬜ Not started | Phase 1.2 |
| 44 | **Data export & deletion** | ✅ Done | `GET /api/export` streams every row the account owns as JSON, read through the *user's* client so RLS decides what is in it — a bug in that file cannot become a breach. Free on every plan; the file carries a version, a date and a readme saying photographs are files rather than rows. Deletion asks for username and password, purges both storage buckets by prefix (`server/account/purge.ts`, unit-tested and checked against the real storage API), then deletes the `auth.users` row and lets the cascade take the rest — 16 pgTAP assertions prove it does |
| 46 | Admin panel | ⬜ Not started | Phase 1.2 |

## Global UI

| Feature | Status | Notes |
|---|---|---|
| Sidebar + mobile bottom nav | ✅ Done | Driven by `shared/navigation.ts`; stubs marked "soon". Of the four in the phone's bottom bar, none is a stub now that the wishlist is built |
| Theme picker | ✅ Done | Six palettes plus System, from `shared/themes.ts`. Dark palettes join the `dark` variant in `globals.css`, which `themes.test.ts` enforces; each retunes the region-state and map colours, not just the chrome |
| Skeleton loaders | 🟡 Partial | Globe and login only |
| Charts | ✅ Done | `recharts` was a dependency nothing used. `client/components/analytics` is the first, reading `--chart-1`…`--chart-5`, so a chart retunes with the theme picker like everything else |
| Empty states | 🟡 Partial | Globe, trips, dashboard activity |
| Command palette (⌘K) | ⬜ Not started | |
| Sidebar quota meter | ⬜ Not started | Needs `entitlements.ts` |
| `error.tsx` / `not-found.tsx` per group | 🟡 Partial | `not-found.tsx` for `/trips/[id]` and `/b/[slug]`; no `error.tsx` anywhere |
| Toasts | ⬜ Not started | `sonner` installed and mounted |

---

## Known gaps worth fixing next

1. **Derivatives are generated lazily, on the first request.** That request pays for the
   re-encode of every photo on the trip — four at a time now rather than one after another,
   which shortens it but does not move it off the request. The plan wants this in a background
   job at publish time; the output is identical, so this is a latency problem rather than a
   correctness one. Post images are the exception —
   they are converted at upload, because their URL has to live in stored HTML.
   `profiles.strip_exif_on_publish` still has nothing reading it — publication always strips,
   which is the stricter behaviour.
2. **Sign-up confirmation is built but not exercised.** `/verify` and the confirmation
   template exist, and the reset flow proves the route they share. But local
   `enable_confirmations` is off, so the signup path itself has never run end to end —
   turning it on locally is the check. Production additionally needs both email templates
   set in the Supabase dashboard and its own origin in the redirect allow-list; nothing in
   the repo can enforce either, so a deploy that skips them sends links that go nowhere.
3. **HEIC still has no fallback in the vault.** The public page converts it, but the owner's
   own gallery points at the original, so a browser that cannot decode HEIC shows nothing
   there. The same transform would fix it for private views.
4. **The maps have no filters.** The plan asks for year, continent and trip type on screens 14
   and 16; only the visited/current/planned layer toggles are built. Year needs no new data —
   `visited_regions` carries first and last visit — but continent and trip type do.
5. **A post image is public from the moment it is uploaded.** The derivative goes into the
   public bucket under a random uuid so the post's stored HTML can hold a URL that keeps
   working — a signed URL would expire within the hour. That makes it as exposed as an unlisted
   link before the post is published, which the studio states next to the button. Serving post
   images through a resolver that checks the post's visibility would close it properly.
6. **The trip page still has no route map.** `MapView` now takes markers, a route line and a
   set of points to frame itself to — that is what the vault's map tab is built on — so the
   same three props would draw the route timeline on `/trips/[id]` and on the public `/t/[slug]`.
   Nothing blocks it but the work.
7. **The marketing nav has no mobile equivalent.** `MarketingHeader` hides its links below
   `sm`, which was survivable at two and is not at five — a phone visitor reaches Blogs, About,
   Pricing, Changelog and Contact only through the footer, which now also carries the three legal
   documents. It needs a menu, or the links need to wrap.
8. **Nothing tells anyone a contact message arrived.** `submit_contact_message()` writes the row
   and the sender is told it reached us, which is true; but the inbox is a table that somebody has
   to remember to open in Studio. The page promises an answer within about three working days, and
   nothing in the repo makes that happen. A database webhook or a scheduled digest to
   `BRAND.support.email` would close it, and `handled_at` is already there to mark what has been
   answered.
9. **Analytics can only show budgets that were *planned*.** `trips.budget_planned` is the
   only money in the schema; the `expenses` table screen 22 needs is not migrated, so there is
   nothing to compare a plan against. The screen says so rather than labelling a plan as spend,
   and the arithmetic groups by currency rather than converting — adding ₹40,000 to $400 needs an
   exchange rate this codebase does not have and should not invent.
10. **A partially pinned trip reads as unmeasured.** `totalDistanceKm` skips places without
   coordinates, so one pin among three measures nothing. That is the honest answer — the legs it
   cannot see are real distance — but the resume shows no explanation for why a trip with places
   has no number.
