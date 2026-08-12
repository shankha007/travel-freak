# Changelog

Everything shipped in TravelFreak, newest first. This file is the source of
truth: the public page at [`/changelog`](../frontend/src/app/changelog/page.tsx)
is rendered from it at build time, so an entry added here is an entry published
to users. Product scope lives in [PROJECT_PLAN.md](PROJECT_PLAN.md) and
feature-by-feature state in [STATUS.md](STATUS.md); this is the history.

## How to add an entry

Every change that reaches `master` gets a line here, in the same commit. Add it
under `## Unreleased`; when a version is cut, rename that heading to the version
and start a fresh `Unreleased` block.

The file is parsed, not just read, so the shape matters:

```md
## <version> — <YYYY-MM-DD> — <release title>

> One or two sentences on why the release exists. Optional.

### Added

- **Short label** — what it does, in a sentence or two. Use `code` for routes,
  files and table names.
```

Rules the parser enforces (`frontend/src/shared/content/changelog.test.ts`
fails the suite if one is broken):

- Release headings are `## ` and use ` — ` (em dash) as the separator. The date
  is `YYYY-MM-DD` and may be omitted for `Unreleased`.
- Section headings are `### ` and must be one of **Added**, **Changed**,
  **Fixed**, **Removed**, **Security** or **Infrastructure**.
- Entries are `- ` bullets. A leading `**Label** — ` is pulled out and rendered
  as the entry's title; the rest is its body. Wrapped lines are indented.
- Inline `**bold**`, `` `code` `` and `[links](https://example.com)` render;
  anything else is shown literally.
- **Order in this file is the order on the page.** Newest release first — no
  sorting happens at render time, so a misplaced release is a misplaced release.
- Everything above the `<!-- releases -->` marker below is prose for whoever is
  writing an entry and never reaches the page. Everything under it is history.

Write for a user, not for a reviewer: what changed and what it means, not which
files moved. Bugs found and fixed inside the same unreleased block do not need
their own line — nobody outside the repo ever saw them.

<!-- releases -->

## Unreleased — The changelog, and four gaps closed

> Four of the things the product was quietly not doing: places had no
> coordinates, deleting made a promise nothing kept, unlisted posts were
> unshareable, and posts could not hold a photograph.

### Added

- **Public changelog page** `/changelog` — a timeline of every release, rendered
  from `docs/CHANGELOG.md` at build time. No login, no database read: the page is
  static, so it costs nothing to serve and cannot drift from this file.
- **Map picker on trips** — every place in the create and edit wizard can now
  carry a pin, set by clicking the map or by searching for the place by name.
  Coordinates are what distance travelled is computed from, so a trip pinned
  properly finally measures. Pins stay optional: an unpinned place still fills in
  its country.
- **Trash** `/trash` — trips and posts deleted in the last 30 days, with a
  restore button, a countdown, and a count of what comes back with each trip.
  `restore_trip()` has existed since the trip screens shipped with nothing calling
  it; this is the screen that keeps the promise the delete dialogs make.
- **Share links for posts** — an unlisted post can be handed to someone as
  `/b/[slug]?k=<token>`, created and revoked from the Blog Studio. The reader
  tells the visitor the post is unlisted rather than letting them assume it is a
  public page worth linking to.
- **Images inside posts** — an image button in the studio toolbar uploads through
  the existing signed-upload route and inserts the photo at the cursor. What lands
  in the post is an EXIF-stripped WebP copy, generated at upload time: the
  original keeps its metadata and is never what a reader sees.
- **Changelog parser** `shared/content/changelog.ts` — turns the markdown into
  typed releases, sections and inline segments, and throws on a malformed entry
  rather than rendering it wrong. Covered by unit tests plus a test that parses
  this file.
- Links to the changelog from the landing page header and footer, and an entry
  in `sitemap.xml`.

### Changed

- **The delete dialogs now say where things go.** Trips and posts link to the
  trash; the photo dialog asks for confirmation and says plainly that a photo
  cannot be brought back. Deleting a photo releases its bytes from storage
  immediately, which is what stops it counting against the plan — so there is no
  copy left to restore, and pretending otherwise was the actual bug.
- **Restoring a trip is refused when it would breach the plan's trip limit**,
  rather than quietly putting the account over. The trip stays in the trash and
  the screen offers the upgrade.
- A post's branding badge is decided by `post_shows_branding_badge()` instead of
  the profile-shaped question, which returned the free-plan default — and so
  badged a paying customer — whenever the author's profile was private.
- `docs/STATUS.md` marks screen 12 (Changelog) as done, and no longer accumulates
  release notes: history lives here now.

### Fixed

- **Unlisted trip links and public trip photos never worked.** Both read through
  the service role, because RLS cannot see a share token — and the schema never
  granted that role access to any table, so every one of those reads failed with
  a permission error. Shipped broken in 0.11.0 and invisible until the local
  database was brought up to date, because the code paths had never run against a
  schema that had them. Granted in migration `20260813000400`, with default
  privileges so a new table cannot reintroduce it.
- **A pinned place read back as unpinned.** PostgREST serialises
  `geography(Point,4326)` as hex EWKB, not GeoJSON, so the reader returned "no
  coordinates" for every row that had them — which meant distance travelled, the
  thing pins exist for, could never be computed. `trip_places` now carries
  `latitude` and `longitude` generated from `location` (migration
  `20260813000500`) and the app reads numbers instead of guessing at a binary
  format. Verified against PostGIS: Tokyo → Kyoto → Osaka is 403 km both ways.
- **`public_resume_stats()` answered for private profiles.** Its visibility check
  sat inside an ungrouped aggregate, and `count(*)` over no rows is 0, not null —
  so a private profile got a row of zeros where its sibling function returns
  nothing at all. Zeros revealed nothing, which is why it went unnoticed; what it
  broke was the difference between "private" and "public with no trips"
  (migration `20260813000300`).

### Security

- **A post token is not a trip token.** The two resolvers read the same table and
  neither will resolve the other's rows; a `share_links` row now points at exactly
  one of the two, enforced by a check constraint. Both are asserted in the pgTAP
  suite.
- **A post share link does not open the private trip behind it.** On the token
  path RLS is not filtering, so the linked trip is named only when it is itself
  published — even its title is more than the link was handed out to share.
- **Nor does it name a private author.** The same elevated read returned the
  author's profile whatever its visibility, which would have put a byline on a
  page the public route keeps anonymous. The rule RLS would have applied is now
  applied by hand on that path, matching what the public trip page does.
- An unlisted post is never indexed, and neither is any page reached with a
  token.

### Infrastructure

- `share_links` gains `post_id`, `resolve_post_share_link()` and
  `post_shows_branding_badge()` (migration `20260813000200`);
  `list_deleted_trips()` lets an owner read their own deleted trips, which
  `trips_select_own` otherwise hides from them (migration `20260813000100`).
- The pgTAP suite is at 76 assertions and green against a database with every
  migration applied — which is how the three bugs above were found. Four
  migrations had never been run locally, so the assertions written alongside them
  had never executed.
- `@tiptap/extension-image` is pinned to 3.29.2 rather than ranged: its 3.30
  release peer-depends on a `@tiptap/core` newer than the one the starter kit
  installs, and npm refuses the tree.

## 0.11.0 — 2026-08-12 — Public trip pages and share links

> The trip you took, on a URL you can hand to someone who has never heard of
> this app.

### Added

- **Public trip page** `/t/[slug]` — read-only trip with hero, dates, route,
  gallery, notes and linked posts, plus JSON-LD `Article` and OG images.
- **Share links** — create and revoke an unlisted link from the trip page.
  `/t/[slug]?k=<token>` opens a trip that is not listed anywhere and is never
  indexed. `resolve_share_link()` returns nothing for a token that is unknown,
  revoked, expired, or points at a trip since made private, so pulling a trip
  back cannot be undone by a link handed out last month.
- **Public image derivatives** — the first time a photo needs to be public,
  sharp re-encodes it to WebP at 1600px into a separate `media-public` bucket,
  which drops every metadata block. Rotation is applied before the EXIF goes, so
  portrait phone photos do not publish on their side.

### Security

- **A public page never serves an original photo.** Originals keep the camera's
  GPS, and a holiday photo taken at home pins the photographer's front door.
  `media.public_path` remembers the stripped derivative so nothing pays for the
  re-encode twice.

## 0.10.0 — 2026-08-12 — Travel Resume and public profile

> The first screens in the product that exist to be shown to a stranger.

### Added

- **Travel resume** `/resume` — countries, regions, trips, travel days, years
  travelling, distance, and distinct places by kind: cities, mountains, beaches
  and UNESCO sites.
- **Share panel** — the public URL with a copy button, the switch that publishes
  the profile, and the display name and bio a public profile is nothing without.
- **Public profile** `/u/[username]` — avatar, bio, home city, interests, the
  resume counters, a read-only globe with its region list, trip cards and
  published posts. JSON-LD `Person`, canonical URL, `noindex` while private, and
  the free-plan badge.
- **Sitemap** `/sitemap.xml` — public profiles and published posts, listed
  through the same client a visitor gets, so it can never advertise a page that
  would 404 for the crawler. Unlisted trips are deliberately absent.

### Changed

- **A shared resume no longer shrinks.** Countries come from `visited_regions`,
  which is public for a public profile, but trips, travel days and places live in
  tables where a visitor sees published rows only — so counting from rows made
  the numbers smaller for everyone but the owner. Three aggregate functions
  answer those questions instead, refuse unless the profile is public, and never
  return a row that identifies a private trip.
- The free-plan badge is decided by `shows_branding_badge()` rather than by
  reading `subscriptions`, so nobody can enumerate who pays.

## 0.9.0 — 2026-08-12 — The world and India maps

> A flat map for the places a globe is too coarse to show.

### Added

- **World map** `/maps/world` — MapLibre 2D with country fills joined to
  `visited_regions` through `feature-state`, hover tooltips, click-through to the
  region modal, and layer toggles for visited, current and planned.
- **India map** `/maps/india` — all 36 states and union territories, free on
  every plan, fitted to the country on load.
- **Admin-1 geometry** — `npm run build:geo` now writes one subdivision file per
  country, simplified to 4% with mapshaper. Coverage is the nine countries
  Natural Earth's 50m set carries ISO 3166-2 for, India among them.

### Changed

- Selection lives in the URL, so a country on a map is as shareable as one on the
  globe, and every map is paired with the keyboard-navigable region list — the
  map is a presentation surface, not the only path to the data.
- Subdivisions are the paywall on the world map and free on the India map. The
  world map fetches admin-1 only for countries the user has actually visited.
- **A missing MapTiler key is not an error.** Without one the polygons render on
  a plain background instead of failing.

### Fixed

- **maplibre-gl pinned to 5.24.0.** Version 6's ESM worker imports
  `./maplibre-gl-shared.mjs` by an unhashed relative path, the bundler emits that
  file hashed, and the request 404s — the worker never starts, so the map stays
  blank with only a MIME-type error to show for it.

## 0.8.0 — 2026-08-12 — Media upload and the Memory Vault

> Photos go from the browser straight to storage; the server's only jobs are
> saying yes and recording what landed.

### Added

- **Memory Vault** `/trips/[id]/vault` — Timeline and Gallery views with photos
  and notes interleaved by date, a photo detail dialog for caption, alt text,
  cover photo and delete, and a note composer.
- **Signed uploads** — `POST /api/uploads/sign` re-checks trip ownership, the
  declared type and size, the per-trip photo cap and the storage pool, then
  issues a signed URL the browser PUTs to directly. A plan limit returns 402, not
  403, and the uploader turns that into an upgrade card rather than an error.
- **Quota meters** — per-trip and per-pool, with drag-and-drop and per-file
  progress. EXIF date and GPS are read on the client.

### Security

- **`confirmUpload` does not trust the client.** It re-reads the object's real
  size from storage, re-runs the quota against that, and identifies the file from
  its leading bytes. A file that is not really an image is deleted rather than
  recorded, so nothing orphaned is left counting against the pool.
- Photos are served only as one-hour signed URLs from a private bucket. EXIF GPS
  is stored for the owner and never sent to the client — the vault only learns
  whether a photo *has* coordinates.
- Uploads run one at a time, because the quota is counted per request and five
  parallel uploads against a limit of five would all be told yes.

## 0.7.0 — 2026-08-12 — Blog Studio

> A trip can now be written up, published and read at a public URL without
> touching the database.

### Added

- **Blog Studio** `/blogs/new` and `/blogs/[id]/edit` — Tiptap v3 with a
  formatting toolbar, autosave on a 1.5s debounce, ⌘S, an unload guard, excerpt
  and SEO fields, trip link, visibility, publish/unpublish and soft delete.
- **My Blogs** `/blogs` — All, Published and Drafts with counts, reading time,
  linked trip and a link to the public reader.

### Changed

- **A new post writes no row until the first autosave**, so an abandoned
  `/blogs/new` leaves nothing behind. That save returns an id and the URL is
  swapped in place, because a router navigation would remount the editor and take
  the writer's cursor with it.
- **Publishing never changes visibility.** A private post cannot be published —
  the button is disabled and the server refuses — because quietly flipping
  someone's privacy setting to make a button work is how people publish things
  they did not mean to.
- Slugs follow the title until publication, then freeze.

## 0.6.0 — 2026-08-12 — Sign-up, trip editing and the blog reader

### Added

- **Register** `/register` — email, password and optional name against a shared
  Zod schema. Works both where email confirmation is required and locally, where
  sign-up returns a session immediately.
- **Edit trip** `/trips/[id]/edit` — the same wizard as create, saveable from any
  step. Slug and `published_at` stay stable and places are matched by id, so
  memories stay pinned.
- **Delete trip** — a confirm dialog calling `soft_delete_trip()`: sets
  `deleted_at`, repaints the globe, frees quota and destroys nothing.
- **Blog reader** `/b/[slug]` — public route with sanitised HTML, byline, reading
  time, linked trip, JSON-LD `Article`, `noindex` on anything unpublished, and
  the badge only on free plans. The author sees their own drafts behind a notice;
  everyone else gets the same 404 as a slug that does not exist.

### Fixed

- **Owner screens leaked other users' public data.** The dashboard, trips list,
  globe and — worst — the trip quota check filtered by nothing, relying on RLS to
  scope rows. RLS is a ceiling, not a scope: `trips` also exposes every published
  public trip, so a brand-new account opened on a dashboard reading "7 countries,
  6 trips" and started life partway through its plan limit. Every owner-scoped
  query now filters `user_id` explicitly.
- **Soft delete was impossible for anyone.** On UPDATE, Postgres requires the new
  row to satisfy the table's SELECT policies, and the owner policy ends in
  `deleted_at is null` — so setting `deleted_at` failed with 42501 for the owner
  too. Fixed with a `soft_delete_trip()` / `restore_trip()` pair rather than by
  loosening the policy.
- **A country visited on four trips counted as one.** The `visited_regions`
  aggregate now carries `visit_trip_ids` and the roll-up unions them, so four
  trips to India read as 4 and one trip across three states still reads as 1.
- **The account menu crashed on open**, taking sign-out with it.

### Security

- **HTML sanitisation on read** — `shared/content/sanitize.ts` applies a tag
  allowlist, so stored post markup cannot execute on the app's origin.
- **pgTAP RLS suite** — 40 assertions over two users covering cross-user reads
  and writes, anonymous visibility, unpublishing and soft delete. `npm run
  db:test`.

## 0.5.0 — 2026-08-11 — Trip details

### Added

- **Trip detail** `/trips/[id]` — hero, stats, route timeline, memories, linked
  blogs, gallery counts and a details panel, with a proper `not-found` for a trip
  that is not yours.

## 0.4.0 — 2026-08-11 — Create a trip

### Added

- **Create trip** `/trips/new` — a four-step wizard (basics, dates, places,
  visibility) writing the trip and its places, with the Zod schema shared between
  client and server.
- **`entitlements.ts`** — one place that reads `plans.limits` and answers what a
  plan allows. `checkTripQuota()` counts the caller's own live rows rather than
  trusting the denormalised counter, and gates both the screen and the action.

## 0.3.0 — 2026-08-11 — The app comes alive

> Everything up to here was schema. This is the first version with screens
> reading real rows.

### Added

- **Landing page** `/` — hero with a live demo globe rather than a screenshot
  that can drift, six feature cards and three pricing tiers.
- **Login** `/login` — email and password, Zod-validated, generic error copy,
  with `?next=` preserved and open-redirect guarded.
- **Session refresh and route protection** — `src/proxy.ts` refreshes auth
  cookies on every request and keeps unauthenticated visitors out of the app
  shell. A convenience redirect, never the security boundary; RLS is that.
- **Dashboard** `/dashboard` — eight live stat cards, a world-progress bar, the
  upcoming-trip widget and recent activity.
- **Travel Globe** `/globe` — real `visited_regions` with four-state colouring, a
  keyboard-navigable region list and an empty state.
- **Region modal** — trips, memories, dates and cities for a country, deep-linked
  as `?region=IND`, with state-level detail gated on the plan server-side.
- **My Trips** `/trips` — tabs for All, Past, Ongoing, Upcoming and Drafts with
  counts, flags, places and visibility.
- **App shell** — sidebar and mobile bottom nav driven by
  `shared/navigation.ts`, with unbuilt screens marked "soon" instead of hidden.

## 0.2.0 — 2026-08-11 — A database the app can actually read

### Added

- **Seed data** — 12 trips across 8 countries on one demo account, so every
  screen has something to render from the first run.
- **Generated types** — `npm run db:types` writes
  `shared/types/database.ts` from the live schema; both Supabase clients are
  typed against it.

### Fixed

- **Data API grants** — without them PostgREST answered 42501 on every table,
  which reads like broken RLS rather than a missing grant.

## 0.1.0 — 2026-08-11 — Foundations

### Added

- **Next.js 16 + TypeScript strict + Tailwind v4** on the App Router, with
  shadcn/ui and Base UI components and light/dark theming that does not flash.
- **Postgres schema** — 14 tables with PostGIS and an RLS policy on every one.
  Public and unlisted visibility is expressed as a policy, not as application
  logic.
- **`visited_regions` aggregate** — maintained by triggers from `trip_places` and
  `wishlist_items`, so the globe reads one row per region instead of recomputing
  history on every load.
- **3D globe** — `react-globe.gl`, dynamically imported so Three.js never lands
  in the initial bundle, with the region-state colours defined once and always
  paired with a text label.
- **Supabase local stack** — Docker, with the API, database and Studio ports
  documented in `backend/README.md`.

### Changed

- **Repository split into `frontend/` and `backend/`**, and `src/` layered as
  `app / client / server / shared` so the client–server line is visible in the
  import path. The one file that crosses the boundary is the generated database
  type.
- **All product naming moved to `brand.ts`.** The name is a working title, so a
  rename has to be a one-file edit.
