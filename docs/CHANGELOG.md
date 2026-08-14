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

## Unreleased — Onboarding, the changelog, and four gaps closed

> A new account used to land on an empty grey globe with no idea what this was
> for. Now the first thing it does is tap the countries it has already been to
> and watch them fill in.

### Added

- **Settings** `/settings` — the last placeholder in the sidebar, and three
  screens on one page. **Profile**: username, display name, bio, where you are
  based and what you travel for. Renaming yourself says, before you save it,
  that your public address moves and the old links stop working. **Privacy**:
  the switch that decides whether `/u/<you>` exists at all, and what a new trip
  starts as — private, unlisted or public — which is applied the next time you
  create one and never to the trips you already have. **Account**: change your
  email, which sends a link to the new address and changes nothing until you
  open it, and change your password, which asks for the current one first.
  Photo metadata is stated rather than offered: publishing always strips GPS,
  and the position that would leave it in is not a preference worth having.
- **Analytics** `/analytics` — the screen behind the last stub in the sidebar.
  `/timeline` says what happened and `/resume` says what it adds up to; this
  says what shape it is. Days away per year as a chart, with travel booked
  stacked separately from travel taken and the empty years drawn as empty —
  a year you did not travel is the story, not a gap to be closed up. Your
  longest and shortest trip, the average over the ones that can be measured,
  and the distance covered with the number of trips it was actually able to
  measure printed beside it. Behind the paid plans: a calendar of every day you
  were away, one square each, with days you have booked drawn hollow; who you
  travel with; the countries you keep going back to; and what you have planned
  to spend, per currency, never added together.
- **Contact** `/contact` — a form that reaches the people who build this, with
  no account required and no ticket queue in front of it. Pick what it is about,
  say what happened, and it lands in the same inbox the developers read; a
  signed-in visitor gets their address filled in already. A rejected message is
  handed back with every word still in it, and the screen you wrote from is sent
  along, so a report about a broken page arrives with the page attached.
- **Legal** `/privacy`, `/terms` and `/refunds` — the three documents the
  product has been operating without. Each states the date it took effect, has a
  contents list beside it, and says plainly where the software does not yet do
  what a policy would like to claim: trash past its 30 days is unreachable but
  not yet purged, export and account deletion are done by hand until the screens
  exist, and nothing can be charged because nothing is on sale. The refund policy
  is published before the first payment rather than after the first dispute.
  Linked from the footer of every public page and listed in `sitemap.xml`.
- **Onboarding** `/welcome` — three steps for a new account: your username and
  where you are based, then the one that matters — tap every country you have
  already been to, on a map that turns green as you go, with a searchable list
  beside it for anyone who would rather type than hunt. Each step saves before
  the next, so a closed tab resumes where it left off, and finishing lands on the
  globe you just filled in.
- **"Been there" without a trip** — marking a country records exactly that and
  nothing more. It costs no trip quota, appears in no list, and the moment you
  log a real trip for that country the trip's dates, cities and photos take over.
  Previously the only ways to paint a country green were to invent a whole trip
  for it or to lie about wanting to go.
- **The Memory Vault has a map** — the third tab of `/trips/[id]/vault` was a
  placeholder waiting for coordinates; now it draws the trip. Pinned places
  appear as numbered stops joined in the order you visited them, and photos
  appear where they were taken. A photo with GPS from the camera is drawn at its
  own coordinates. A photo without GPS is drawn at the stop whose dates contain
  it — dashed, and labelled as placed by date, because that is a good guess and
  not a measurement. Photos that match neither are listed under the map with the
  reason, rather than quietly left out. Several photos at one point share a
  marker; selecting it lists them, which is also how the map's contents are
  reachable from a keyboard.
- **Travel Timeline** `/timeline` — everything you have done, by year, newest
  first. `/trips` answers "what have I got"; this answers "what happened". Each
  year opens with what it added up to — trips, days away, countries, and the
  ones you reached for the first time — and then lists the trips and the posts
  you published, interleaved. Days are counted in the year they were actually
  spent, so a trip from 28 December to 4 January gives four days to each year
  rather than eight to one. Booked travel is counted separately from travel
  taken: a year holding both says "23 days away · 11 more booked", because one
  of those is a life lived and the other is a plan.
- **Wishlist** `/wishlist` — the tab that said "soon" is a screen. Add anywhere
  you mean to get to, with a note to your future self, a rough budget, the season
  worth going in, and how badly you want it; the list groups by that last one, so
  "Next up" sits apart from the fifteen places you would go one day. A wish costs
  nothing against your plan and paints the country planned on the globe and both
  maps the moment you add it — and disappears from them the moment you remove it.
  A country you have already been to is marked as such, because the globe will be
  painting it green whatever the wishlist says.
- **Password reset** `/forgot-password`, `/reset-password` — a forgotten password
  is no longer the end of an account. Ask for a link from the sign-in screen, set
  a new password, and you are straight back in. The link lasts an hour and works
  once. The form says the same thing whether or not that address has an account,
  because an answer that differed would turn it into a way of asking who has one.
- **Email confirmation lands somewhere** `/verify` — confirming a new address
  used to drop you on the marketing page with nothing saying it had worked. It
  now lands on a page that says so, and an expired link gets a page that explains
  it and offers another — the right kind, so a stale reset link is not answered
  with a confirmation email.
- **Public blog index** `/b` — every published public post in one place, newest
  first, with the byline, the trip it was written about and how long it takes to
  read. No login: it is the front door for anything anyone chooses to publish
  here, and it carries `Blog` structured data and a sitemap entry so search
  engines can find the posts underneath it. It lives at `/b` rather than
  `/blogs`, which belongs to your own drafts.
- **About** `/about` — what this is for, and the four promises it is built to:
  private by default, no ads on any plan, your data leaves with you, and free
  where it counts. Each one is a rule enforced in the product rather than a
  sentiment.
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
- **Pricing has its own page** `/pricing` — the plans, a monthly/annual switch
  that shows what paying for the year actually saves, and a full comparison
  table. Every number on it is read from the `plans` row the server enforces
  against, so the page and the quota that stops you uploading cannot disagree —
  the old copy was hand-written on the landing page and free to drift. Linked
  from the marketing nav and from every upgrade prompt inside the app, which
  used to point at a settings screen that says nothing about plans.
- **Six themes** — Light and Dark as before, plus **Ocean** (deep blue on cool
  paper), **Sunset** (terracotta on sand), **Midnight** (indigo) and **Forest**
  (deep green). Pick one from the palette menu in the header. Each retunes the
  globe and the maps as well as the interface, and keeps the four region states
  tellable apart: on Sunset "planned" moves off amber, because amber on sand is
  not a distinction.
- **Changelog parser** `shared/content/changelog.ts` — turns the markdown into
  typed releases, sections and inline segments, and throws on a malformed entry
  rather than rendering it wrong. Covered by unit tests plus a test that parses
  this file.
- Links to the changelog from the landing page header and footer, and an entry
  in `sitemap.xml`.

### Changed

- **Public pages now move a little.** Cards and sections rise into place as you
  scroll to them, once — scrolling back up replays nothing. Anyone whose system
  asks for reduced motion gets the fade without the movement, and a visitor with
  JavaScript off gets the whole page with neither.
- **The delete dialogs now say where things go.** Trips and posts link to the
  trash; the photo dialog asks for confirmation and says plainly that a photo
  cannot be brought back. Deleting a photo releases its bytes from storage
  immediately, which is what stops it counting against the plan — so there is no
  copy left to restore, and pretending otherwise was the actual bug.
- **A photo's own coordinates are now shown to its owner**, in the photo detail
  dialog, instead of a line saying only that it has some. They are still yours
  alone — nothing published carries them.
- **Restoring a trip is refused when it would breach the plan's trip limit**,
  rather than quietly putting the account over. The trip stays in the trash and
  the screen offers the upgrade.
- A post's branding badge is decided by `post_shows_branding_badge()` instead of
  the profile-shaped question, which returned the free-plan default — and so
  badged a paying customer — whenever the author's profile was private.
- `docs/STATUS.md` marks screen 12 (Changelog) as done, and no longer accumulates
  release notes: history lives here now.
- **The first view of a public trip page is faster.** Photos are still converted
  to public copies the first time someone opens the page, but a few at a time
  instead of one after another, so a gallery no longer costs the sum of every
  re-encode. The cap is deliberate: each conversion is real work, and doing all
  of them at once would trade a slow page for a stalled server.

- **The maps are the screen now.** `/maps/world` and `/maps/india` used to put a
  420px-tall map next to a 320px list, which on a laptop made the sidebar bigger
  than the world. The map now fills the page and everything else floats over it
  as glass: the layer legend, the zoom control, and a places panel that opens
  beside the map on a wide screen, over it on a phone, and closes either way.
  The world is fitted to the space it can actually use, so it is no longer
  centred underneath the panel.
- **The map draws itself.** Land, coastlines and sea come from the theme rather
  than from a tile server, so a build with no MapTiler key gets a designed map
  instead of polygons floating in nothing — and the whole thing re-colours with
  the palette. Countries you have been to carry a soft halo in their own state
  colour, and the one under the cursor lifts its border.
- **Pricing left the landing page**, which now says the one thing that belongs
  there — the globe is free — and links to `/pricing` for the rest.

### Fixed

- **A stripe ran across the world map.** Russia and Fiji arrive from Natural
  Earth as rings holding both -180° and +180°, and a renderer joins those two
  points the only way it can: straight across the map. It was always there,
  hiding under a 25%-opacity wash; drawing land properly made it a band through
  the Pacific. The build now splits such rings at the antimeridian into pieces
  that each stay in one hemisphere. Antarctica is deliberately left whole — its
  ring encircles a pole, and the line along the bottom of the map is how
  Mercator is supposed to draw that.
- **The map asked for tiles it could never get.** `NEXT_PUBLIC_MAPTILER_KEY=""`
  reaches the app as two literal quote characters, which is truthy — so every
  map load requested a basemap with a key the tile server answers 403 to, and
  the built-in fallback that exists for exactly this case never ran.
- **The zoom control was a white brick on dark themes**, because MapLibre's own
  stylesheet is unlayered and beat ours whatever we set. It is glass now, in
  whichever palette you are using, and it no longer sits under the places panel
  on a phone.
- **A trip's cover photo could vanish from its own page.** The hero was matched
  against the six photos the gallery card shows, so a cover chosen early and
  followed by six newer photos left the page with no image — while the vault
  still showed it set. The cover is now fetched on its own when the gallery does
  not already contain it.
- **The world map asked for subdivision data that does not exist.** It requested
  a states-and-provinces file for every country you have visited, but only nine
  countries have one, so most loads fired a handful of failed requests before
  drawing. It now reads the coverage index the build already writes and asks only
  for what is there.

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

### Fixed

- **A rejected profile save no longer eats what you wrote.** Choosing a username
  someone already has used to hand back the error and quietly restore the old
  bio, so the ten minutes spent rewriting it went with it. Everything typed
  comes back with the message now.
- **A wide screen no longer drags the whole app sideways.** `main` in the app
  shell could not shrink below its widest child, so anything genuinely wide gave
  every page a horizontal scrollbar instead of scrolling inside the one element
  that needed it. Found while building the analytics heatmap, which is a year of
  squares and the first thing wide enough to expose it.

### Infrastructure

- **`default_trip_visibility` is a setting rather than a column.** It has been in
  `profiles` since the first migration with nothing reading it; `/trips/new` now
  does. Editing a trip deliberately does not — an existing trip's visibility is
  a stored fact, and re-deriving it from a preference changed afterwards would
  republish something on the next save.
- **`shared/analytics.ts`, and the line it draws.** The per-year arithmetic,
  trip lengths, budget grouping and destination ranking are pure and unit-tested
  — 28 assertions, several of which are about refusing to answer. `HAPPENED` is
  now exported from `timeline.ts` and used by both, because two copies of "which
  trips count as travel taken" is two numbers that can disagree about the same
  year. Two bugs the tests caught before anyone saw them: a trip ending in
  January was dropping its days off the end of the chart, and a country you are
  in right now was listed under "where you keep going back" with zero visits.
- **`.gitattributes` fixes the line endings for good.** The repository is LF
  everywhere, in the tree and in the working copy, so it no longer depends on
  each machine's `core.autocrlf` — which on Windows asks for CRLF, argues with
  Prettier, and leaves files permanently listed as modified with empty diffs.
- **Framer Motion, with one vocabulary.** Three durations and one easing curve
  live in `shared/motion.ts`; `Reveal`, `RevealGroup` and `RevealItem` are the
  only entrance animation any page uses. `MotionConfig reducedMotion="user"` is
  set once in `providers.tsx`, so no component has to remember the preference
  and none of them can forget it. A `<noscript>` rule in the root layout pins
  every revealed element visible, because these ship as `opacity: 0`.
- **`contact_messages` is write-only.** RLS is on with no policy at all, so
  neither `anon` nor a signed-in user can read the inbox back — only the service
  role. Writes go through `submit_contact_message()`, a security-definer
  function that owns the length checks and a limit of five messages per address
  per hour, so a caller cannot skip either. Twelve new pgTAP assertions cover
  the direct insert, the read-back, the sixth message and a signed-in sender's
  user id.
- **The auth emails point at the app.** `backend/supabase/templates/` holds the
  recovery and confirmation templates, and both link to `/auth/confirm` carrying
  a token hash rather than a PKCE code. A code has to be exchanged in the browser
  that asked for it, so the stock templates broke the ordinary case of requesting
  a reset on a laptop and opening the mail on a phone. The route still accepts a
  code, so a project left on the defaults keeps working. Production needs the two
  templates set in the Supabase dashboard.
- **`additional_redirect_urls` covers the dev origin.** `site_url` allows only
  itself, so `redirectTo` pointing at `/auth/confirm` was rejected and quietly
  replaced with the landing page — found by sending a real reset email and
  reading where the link went.
- **The seed's places carry pins.** Every stop in the demo data now has
  coordinates, so the route lines, the distance totals and the vault's map are
  visible in a fresh checkout without hand-made fixtures. Two deliberately have
  none — Kolkata, a trip pinned nowhere, and Thimphu, a trip pinned in part —
  because both are states the product allows and the screens have to be reachable.
- `MapView` takes `markers`, `route` and `fitTo`, so a caller can draw points and
  a path and frame the map to them instead of to the world. The vault's map is
  the first user; the trip route map is the next.
- `visited_countries` is a third source for the `visited_regions` aggregate,
  after `trip_places` and `wishlist_items` (migration `20260813000600`).
  Precedence runs richest-first and is the whole design: a mark never displaces
  what a trip knows — including when the trip was recorded at state level and the
  mark at country level, which a conflict clause alone would have missed.
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
- **Fewer round trips per page.** The request-scoped Supabase client is built
  once per request rather than once per query module; the session's profile and
  plan are read together; `getEntitlements()` embeds the plan in the subscription
  query it already makes; and `getVisitedRegions()` is deduped per render. A
  public profile also no longer reads the visitor's `trip_places`, none of which
  it is allowed to count.
- `mapWithConcurrency()` in `shared/concurrency.ts` — bounded parallel mapping
  that preserves input order, with unit tests. Used for image derivatives.
- `useLazyComponent()` replaces four near-identical copies of the effect-driven
  dynamic import behind the globe and the maps.
- `shared/themes.ts` is the one list of palettes; `themes.test.ts` reads
  `globals.css` and fails when a dark palette is missing from the `dark` variant
  or from the shared dark base, which would otherwise ship as a palette with
  every `dark:` utility stuck on its light value.
- `scripts/lib/antimeridian.mjs` — unwrap, clip and split, with 20 unit tests.
  The vitest config now covers `scripts/` for it: a wrong clip is a stripe
  across the map, and nothing else would have caught it.
- The four marketing pages share one `MarketingHeader` and `MarketingFooter`
  instead of a copy each, which is what let the pricing link appear on all of
  them at once.

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
