# TravelFreak — Delivery status

Feature-by-feature state of the build. Screen numbers refer to §5 of
[PROJECT_PLAN.md](PROJECT_PLAN.md).

This file answers "where does the product stand"; it is not a history. What
shipped, when, and why lives in [CHANGELOG.md](CHANGELOG.md) — the notes that
used to accumulate at the bottom of this file are there now, and new ones go
there rather than here. Keep the gaps at the end of this file current.

Last updated: 2026-08-19 · current release: 0.12.0

Every ✅ below was re-checked in a browser against the local stack on 2026-08-13,
including sign-in, the globe and both maps on a free and a paid plan, the trip
and blog screens, delete → trash → restore, and a share link through create,
open, revoke and pull-back. The three planner screens were checked the same way
on 2026-08-15, including a list ticked off and a fortnight of itinerary days
laid out in one click, both confirmed in the database afterwards. **The
itinerary's drag-and-drop is the one thing here not verified by hand**: the
harness browser does not composite, so every element measures zero and neither
dnd-kit's sensors nor MapLibre can initialise. The markup, the handles and
their labels were checked in the DOM, the reorder function has pgTAP coverage
including the cross-user no-op, and `parseOrderedIds` is unit-tested — but the
drag gesture itself wants a human. Collaborators
was checked the same day from both sides — an invitation accepted by email match
and confirmed in the database, and the owner's trip opened as a collaborator to
verify the Budget screen is absent and 404s.

The 2026-08-16 changes were checked against a production build on the local
stack: the phone menu opened and listed all ten links with a clean console, the
resume read "Approximate · 1 of 2 trips", analytics compared INR 82,900 spent
against INR 85,000 planned over the one trip carrying both and gave the seed's
stray USD expense its own uncompared row, the settings email survived the
session handoff, and the route map rendered on `/trips/[id]` and on
`/t/cherry-blossom-chase` ("All 3 stops pinned"). Adding a second undated day to
the Bhutan trip made both undated days grow a handle while the three dated ones
stayed without one.

The second round of 2026-08-16 changes was checked the same way. **Plan against
actual was exercised end to end by hand**: the Bhutan itinerary showed the
seeded flight as "INR 42,000 planned · INR 43,150 spent (+INR 1,150)" and
offered no record button on it, offered one on each of the three priced entries
that had none, and offered none on the two unpriced ones; pressing the
guesthouse's button wrote an expense of INR 18,000 under `hotels` — the category
its `hotel` kind maps to — dated 2 Nov 2026 from the day rather than from today,
and the budget screen then read "From the itinerary · planned at INR 18,000" on
it and "· over by INR 1,150" on the flight. The trip-type filter was confirmed
rendering all five types over the seed's real data on `/maps/world`.

Derivative generation was moved off the request path on 2026-08-17 and
**verified against the live stack**, which is the only way it could have been:
two real photographs were written into storage, one on the published Ladakh trip
and one on the private Bhutan trip. The scheduled endpoint reported
`{built:1, scanned:1}` — it converted the public trip's photo and never even
scanned the private one — the derivative came back from the public bucket as a
3 KB WebP re-encoded from a 22 KB JPEG, a second run reported `scanned:0`, and the
endpoint answered 401 both with no secret and with a wrong one. Publishing Bhutan
then built its derivative with **no request to the public page at all**: the save
returned 303 in 651 ms and the server log carries no `/t/` entry, because
`after()` did the work. The test rows and objects were removed afterwards and the
trip put back to private.

That check earned its keep: it caught a bug a green typecheck had hidden. The
sweep's embedded read needed a constraint-name hint, since `media` and `trips`
are related twice — `media.trip_id` one way and `trips.cover_media_id` the other —
and PostgREST refuses to guess, at runtime only. The first call to the endpoint
returned 207 with that message.

The three Global UI gaps were built on 2026-08-18 and checked against the local
stack. The quota meter was read on both plans: on Voyager it showed
"Trips 12 used · unlimited" with **no bar** and "Storage 0 B of 30 GB" with one,
and on Explorer the trips line became "12 of 15" — an amber bar at exactly 80%,
with the upgrade link appearing only then. The palette opened on Ctrl+K with
focus in its input and `aria-activedescendant` on the first result; typing "tr"
ranked Trips, Travel resume and Trash above Globe and World map, which match only
through "coun-tr-ies"; three real ArrowDowns landed on the fourth *visible* row
and Enter navigated to the chosen screen.

Those arrow keys found a genuine bug before the fix landed. Results were ranked
without regard to section while the list renders grouped by one, so "New trip"
sat fourth in the array and last on the screen — Down three times highlighted a
row nowhere near where the eye was. `filterCommands` now returns rendered order,
with a regression test naming the case.

**Toasts are the one thing here not confirmed by eye**, and the harness is why: a
toast is an animated element that removes itself after four seconds, animations
never complete where nothing composites, and every `javascript_exec` gets a fresh
JS world, so an observer cannot outlive the click that would trigger one. The
hook has 8 assertions with `sonner` mocked instead — including the two failure
modes that would otherwise be invisible, a repeat on an unrelated re-render and a
second identical failure going unannounced — and the actions behind it were
confirmed doing their work.

The partial features were finished on 2026-08-18. **The error boundary was
proved by making a screen throw**: a temporary route under `(app)` that raised on
render produced "Something went wrong" with the Try again and Back buttons, the
header and sidebar still standing beside it — which is the whole argument for
putting the boundary on the group rather than the screen — React's digest shown
as a reference, and the thrown message nowhere on the page. The route was deleted
afterwards. The wizard now reads basics → dates → places → **cover** → visibility,
and the dashboard's globe card renders its lazy container in place of the old
link.

**Two of the new surfaces could not be exercised here**, both for the documented
reason. The trip wizard does not hydrate in the harness — its `PlacePicker` lazy
loads MapLibre, which cannot initialise where nothing composites — so the step
buttons are inert markup and the cover picker was never clicked; the step list
and its position were read from the DOM. And the dashboard globe shows its
skeleton rather than a canvas, because three.js needs the same compositing. Both
want a human, and are listed below.

The Phase 1 release blockers were built on 2026-08-19 and checked against the
local stack. The headers were read off a real response: the landing page carries
`script-src 'self' 'unsafe-inline'` and `/dashboard` carries
`script-src 'nonce-…' 'strict-dynamic'` with no inline escape hatch, which is the
two-policy split working as designed, and both pages loaded with an empty console
— no violation from MapLibre's blob worker, from three.js, or from any inline
style. HSTS, `nosniff`, `X-Frame-Options`, the referrer policy and the
permissions policy were all present on the same response. `robots.txt` renders,
`/b/feed.xml` returns real seeded posts as RSS, and `/u/demo/feed.xml` returns the
demo account's writing while `/u/riya/feed.xml` — a private profile — and
`/u/nope/feed.xml` both return the same 404, which is the whole point. The Google
button renders above the credentials form on both auth screens; **the OAuth round
trip itself has not been performed**, because it needs a Google Cloud client this
repo deliberately does not carry, and it is listed below.

**That check found a bug that had been shipped.** The per-profile feed 404'd for
`demo`, which is public — and so did the profile page, and so did the sitemap's
profile list. `profiles_select_trip_mates`, added with collaborators, called a
function `anon` had no EXECUTE on; Postgres evaluates every permissive policy for
the asking role, so an anonymous read of `profiles` *errored* rather than
returning fewer rows, and took `profiles_select_public` down with it. Every
signed-out surface built on a profile — the public profile page, `sitemap.xml`,
the byline on `/b`, the profile OG card — is written to treat a missing profile as
a private one, so the failure looked exactly like a privacy setting everywhere at
once. Migration `20260819000100` scopes the policy to `authenticated`, which is
the role it was always about, and four pgTAP assertions now read the table
directly as `anon` rather than only through the security-definer helpers that hid
this.

The app was walked at 375px, 768px and 1280px on 2026-08-19, every screen behind
the login plus the public pages, measuring rather than looking — the harness does
not composite, but it does lay out, so element geometry is real. Two layout bugs
were found and fixed, both mobile-only. The `/trips` tab strip needed ~415px for
five tabs and their counts and had 375, so **Drafts was painted outside the
viewport with nothing to scroll to reach it**; the strip scrolls now, and the last
tab was confirmed reachable. And every itinerary day card was drawn 24px wider
than the screen — a grid item defaults to `min-width: auto` and so refused to
shrink below its content, which the `lg` column had already been told to ignore
and the one-column case had not. Tablet and desktop were clean, and both fixes
were re-checked at 1280px for regressions: the tab strip needs no scrolling there,
and the itinerary's two-column layout still measures `617px 352px`.

Tap targets were the follow-up, and were done properly rather than for the
handful first spotted: every icon-only control in the app is now 44px on a coarse
pointer, from `ui/button.tsx`'s four icon sizes and the itinerary's two drag
handles, which at 24px had been the smallest control in the product and are the
only ones that are *dragged*. They grow rather than wearing an invisible hit
area, because they come in pairs 4px apart and two 44px hit areas around two 28px
buttons overlap by 12px — a tap landing on whichever element wins the hit test is
worse than a tap that misses. Gated on `pointer-coarse` rather than a width, since
it is the input device that matters: verified at 44px with zero overlapping
targets on a touch viewport, and byte-identical at 28px and 32px under a fine
pointer. The radio and checkbox inputs that measured 13px and 16px were left
alone — each is wrapped in a `<label>` that makes the whole row the target, which
is the pattern that already answers this.

**A third bug came out of the console rather than the layout**, and it was one
this file had claimed as done: the shell's nonce CSP was blocking next-themes'
no-flash script, so the theme flashed on every authenticated navigation. That is
written up in the infrastructure table above, along with why the fix was to drop
the two-policy split rather than to exempt the script.

The "known gaps" list was worked through on 2026-08-20, and two of its ten entries
closed. **Sign-up confirmation is no longer untested** — run end to end with
confirmations turned on, including the case the route was written for: the emailed
link carries a `pkce_`-prefixed `token_hash` and was opened on a different host from
the one that signed up, and it still worked, which is the "different device" claim
made good. Nothing was broken; the gap was that nobody had looked. **The map and
globe filters are no longer unexercised** either — all three were driven over real
data on both screens, singly and in combination, narrowing the places panel, the
region list and the globe's three counters exactly as documented, with each caveat
sentence rendering. What remains there is only the painted fills, which need WebGL.

Two things were checked and found *not* to be bugs, which is worth recording so they
are not re-investigated: the itinerary's drag handles are genuinely live (they carry
dnd-kit's `aria-roledescription` and `aria-describedby`) and cannot be driven here
because they measure 0×0 in the harness and a zero-size element cannot take focus;
and a previous route's DOM appearing to linger after a client-side navigation is a
pending React transition holding the old UI, not a failure to unmount — a clean load
of the same route carries none of it.

**What still wants a human** is narrower than before but the same limitation:
nothing composites in the harness browser, so every element measures zero,
MapLibre never initialises, and the `MapExplorer` and `GlobeExplorer` subtrees do
not hydrate at all — checked this time rather than assumed, by looking for React
fibers on their DOM and finding none. So no drag gesture has been performed by
hand, and **choosing a map filter and watching the fills change still has not
been done**: year, continent and trip type are verified as rendered options over
real data plus 24 unit tests. The itinerary board, by contrast, does hydrate
there, which is what made the plan-against-actual check above possible.

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
| Infrastructure | 24 | 0 | 0 | 0 |
| Public / marketing | 9 | 0 | 0 | 1 |
| Auth | 7 | 0 | 0 | 0 |
| Dashboard & globe | 8 | 0 | 0 | 0 |
| Trips & planner | 10 | 0 | 0 | 0 |
| Memory & content | 7 | 0 | 0 | 0 |
| Analytics & resume | 2 | 0 | 0 | 2 |
| Public sharing | 5 | 0 | 0 | 0 |
| Account | 3 | 1 | 0 | 3 |
| **Total** | **75** | **1** | **0** | **6** |

---

## Infrastructure

| # | Feature | Status | Notes |
|---|---|---|---|
| — | Next.js 16 + TS strict + Tailwind v4 | ✅ Done | App Router, `src/` layered `app / client / server / shared` |
| — | shadcn/ui + Base UI component set | ✅ Done | 21 components installed |
| — | Light/dark theming | ✅ Done | `next-themes`, system default, no flash |
| — | Supabase local stack | ✅ Done | Docker; API 54321, DB 54322, Studio 54323 |
| — | Postgres schema + RLS | ✅ Done | 19 tables, PostGIS, policies on every table. Ownership of a trip lives on `trips.user_id` and nowhere else — a check constraint forbids a `trip_collaborators` row claiming `owner`, because a second source of truth for the fact every policy consults is not worth the convenience. `trip_places.location` is written as EWKT and read back through generated `latitude`/`longitude` columns, because PostgREST returns geography as hex EWKB — see `shared/geo/point.ts` |
| — | `visited_regions` aggregate + triggers | ✅ Done | Rebuilt from `trip_places` / `visited_countries` / `wishlist_items`, in that precedence — a bare "been there" mark never displaces what a logged trip knows |
| — | Data API grants | ✅ Done | Migration `20260811000100` for `anon`/`authenticated`, `20260813000400` for `service_role` — without the latter every elevated read (share tokens, derivatives) 42501s |
| — | Seed data | ✅ Done | 12 trips, 8 countries, 1 demo account. Places carry pins, so routes, distances and the vault's map are visible in a fresh checkout; Kolkata and Thimphu deliberately have none, covering the unpinned and part-pinned cases. The Bhutan trip carries an itinerary and two checklists and Ladakh carries six expenses — one of them in USD, so the multi-currency case the arithmetic refuses to collapse is on screen rather than only in a unit test. All three are deliberately incomplete, because a screen that is full on first sight never shows its empty states. **A second account**, `friend@travelfreak.app`, edits the Ladakh trip and has invited the demo account to one of its own, so all three collaborator states — accepted, pending and declined — and both sides of an invitation are reachable without inventing a user by hand. No `media` rows — a row without a storage object breaks more than it demonstrates |
| — | Generated DB types | ✅ Done | `npm run db:types` → `shared/types/database.ts` |
| — | `brand.ts` rename safety | ✅ Done | No component hardcodes the product name |
| — | **`entitlements.ts`** | ✅ Done | Reads `plans.limits`; `checkTripQuota()` counts the caller's own live rows rather than trusting the denormalised counter. Gates both `/trips/new` and the create action. Also `itinerary_full`, `budget_full`, `checklists` and `collaborators_per_trip` — the middle one read **per trip**, which is the only reading under which "3 lists" makes sense on a screen that belongs to one. `collaborators_per_trip` is 0 on Explorer, which the null/0 convention reads as unavailable rather than as a limit of none, and the pricing table already sold it that way |
| — | **pgTAP RLS tests** | ✅ Done | 219 assertions over three files, `npm run db:test`. `rls.test.sql`: two users, cross-user reads and writes, anon visibility, unpublish, soft delete, trip and post share tokens, the trash listing and account deletion. `planner.test.sql`: the three visibility rules the planner tables do *not* share — above all that publishing a trip publishes none of them, the failure that would otherwise go unnoticed because everything would still work. Also both reorder functions, days as well as entries, each with the cross-account no-op; and the plan-to-expense link, where the three things that must hold are one expense per entry, both rows agreeing about their trip, and deleting the plan leaving the money. `collaborators.test.sql`: opens with a regression test proving a viewer cannot promote itself, then the invite → accept → leave round trip, and the line between the planned budget a collaborator sees and the expenses they never do |
| — | HTML sanitisation | ✅ Done | `shared/content/sanitize.ts` — allowlist applied on read, so stored post markup cannot execute on the app's origin |
| — | **Storage + signed uploads** | ✅ Done | Private `media` bucket, keys `<user>/<trip>/<media>.<ext>` — or `<user>/posts/<post>/<media>.<ext>` for post images — matching the storage policies, which only read the first segment. Reads go out as one-hour signed URLs; `next/image` is allow-listed to the storage host only |
| — | **Geo assets** | ✅ Done | `npm run build:geo` writes country outlines plus admin-1 split one file per country, simplified 4% with mapshaper. Natural Earth 50m carries ISO 3166-2 for nine large countries, India among them. The map reads `admin1/index.json` before fetching, so an uncovered country costs no request |
| — | **Public image derivatives** | ✅ Done | `media-public` bucket; sharp re-encodes to WebP ≤1600px, dropping every metadata block. **Built off the request path**: `after()` on the trip's update action starts the work once the owner's save has returned, and `/api/cron/build-derivatives` sweeps hourly for anything that did not finish — both in `server/media/derivative-jobs.ts`, whose sweep query is joined by constraint name because `media` and `trips` are related twice. The lazy call in `public-trip.ts` stays behind both as correctness, not as the plan. **Trip photos only.** A post's images take the same transform into the *private* bucket at upload — their URL has to live in stored HTML and a signed one expires — and are served through `/api/post-images/[mediaId]`, which checks the post's visibility per request. Tested with the same EXIF parser the uploader uses to read GPS, and `derivative-batch.ts` carries 9 assertions over the loop's promises |
| — | **Framer Motion** | ✅ Done | `shared/motion.ts` owns three durations and one easing curve; `client/components/motion/reveal.tsx` owns the only entrance animation. `MotionConfig reducedMotion="user"` in `providers.tsx` drops the movement and keeps the fade for anyone who asks, so no component has to check. Reveals ship as `opacity: 0`, so the root layout carries a `<noscript>` rule that pins them visible |
| — | **`contact_messages`** | ✅ Done | RLS on with no policy: nobody reads it through the Data API but the service role. Writes go through `submit_contact_message()`, a security-definer function holding the length checks and a limit of five per address per hour. 12 pgTAP assertions |
| — | **Scheduled purge** | ✅ Done | `/api/cron/purge-trash` empties trash past its 30 days — trips and posts alike, including the images inside a post now that `media.post_id` exists — files first, while the rows naming them still exist, then the rows. Guarded by `CRON_SECRET` compared in constant time; unset closes the endpoint rather than opening it. `vercel.json` runs it daily. Idempotent — everything is chosen by a cutoff — so a missed day costs a day and a double run costs nothing |
| — | **CI (GitHub Actions)** | ✅ Done | `.github/workflows/ci.yml`, on every push and pull request. Frontend: format, lint, types, tests, production build — with dummy Supabase env, because a build that needs production credentials is one nobody can reproduce. Database: the full stack, `supabase test db`, and a check that the generated types match the migrations. The CLI is pinned rather than `latest`, so a CLI release cannot turn an unrelated pull request red |
| — | **Sentry + PostHog** | ✅ Done | `instrumentation.ts` and `instrumentation-client.ts`; `onRequestError` catches renders, route handlers, actions and the proxy alike. The funnel is `shared/funnel.ts` — six names, ordered, because the array *is* the PostHog insight — captured server-side over `fetch` inside `after()`, with **no client SDK at all**: every step is a server event, so the browser ships no tracking script, the CSP stays tight and an ad blocker cannot skew the numbers. `upgrade_viewed` is the one step with no server moment of its own, so the thirteen in-app upgrade prompts point at `/upgrade`, which records and redirects; the marketing nav still links straight to `/pricing`, because a stranger reading the plans is not in this funnel. Both SDKs are no-ops when unset, so a checkout without keys behaves exactly as before. Only an account id is sent — `$ip: null` explicitly, since PostHog would otherwise geolocate *our server* — and `beforeBreadcrumb` drops `ui.input`, because a breadcrumb trail through this product is a transcript of somebody's private writing |
| — | **CSP + security headers** | ✅ Done | **One policy, everywhere.** It shipped as two — a nonce with `'strict-dynamic'` for the shell, `'unsafe-inline'` for the prerendered public pages — and that was reverted on 2026-08-19 because the strict half blocked next-themes' no-flash script, flashing the theme on every screen behind the login. Both exits cost more than the nonce: passing the nonce to `<ThemeProvider>` needs `headers()` in the root layout, which turned `/`, `/about`, `/login` and the legal pages from `○` to `ƒ` in the build output; and a `sha256-` exemption cannot hold, because the same script hashes three different ways — `next dev`, a test renderer, and the production bundle, where the minifier renames its parameters. `'unsafe-inline'` is a stated concession on inline injection; `'self'` still refuses a script from another origin, which is what a remote injection needs, and sanitisation on read remains the primary control. `worker-src blob:` is load-bearing — MapLibre instantiates its worker from a blob and the console blames the worker, not the policy. `style-src 'unsafe-inline'` in both and unavoidable: no nonce covers a `style` attribute. Hosts come from env, so an analytics origin is allowed only while it is configured. HSTS, `nosniff`, `X-Frame-Options`, referrer and permissions policies live in `next.config.ts` instead, because the proxy's matcher skips `_next/static` and `nosniff` on an asset is worth as much as on a document |
| — | **Rate limiting** | ✅ Done | `shared/rate-limit.ts` holds the policies and a sliding-window counter — sliding, because a fixed window lets twice the limit through across a seam; `server/rate-limit.ts` holds the backend. Upstash over its REST API when configured, this process's memory otherwise, and the same interface either way, so a local checkout needs no Redis. **Fails open** when Redis is unreachable and deliberately does not fall back to the memory counter: a blip should not become an outage of sign-in, and a per-instance count taking over mid-incident would refuse legitimate callers unpredictably. Applied to sign-in (per IP *and* per address, since either alone is walkable), sign-up, the two forms that send mail — per IP **only**, because a per-address bucket would answer "too many attempts" to a stranger and disclose that somebody just asked for a reset — upload signing (per account, since it is authenticated), contact, and share tokens. The token limiter is forgiven on a hit, so it counts only misses and a link opened by forty people behind one NAT costs nothing |
| — | **Entitlement rules + boundary tests** | ✅ Done | `shared/entitlement-rules.ts` — the decisions with the database taken out, which is what made §10's "every plan × every resource, at the boundary" writable at all; the counting stays in `server/entitlements.ts`, which is still the only file a feature imports. 43 assertions: the fifteenth trip and the sixteenth, the fifth photo and the sixth on all three plans, a file that exactly fills the pool and the byte after it, and the downgrade case — over quota refuses the next one, reports the *real* count rather than clamping it, and promises nothing is deleted. Also that `null` and `0` never collapse into each other, which is the bug the whole convention exists to prevent |

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
| — | **SEO (JSON-LD, sitemap, robots, RSS)** | ✅ Done | JSON-LD and `sitemap.xml` were already here; `robots.ts` and the feeds close the list. Robots points at the sitemap and away from the shell, the API and `/auth/` — a crawler that fetches a confirmation link spends the token before its recipient can. **Unlisted content is deliberately absent from it**: naming the pattern would publish a map to the URLs a token exists to keep out of an index, and `noindex` on the page is the mechanism that actually works. RSS is hand-built in `shared/content/feed.ts` — a feed is four tags and a date, and the two things worth getting right are the escaping and RFC 822, both of which are tested rather than delegated to a dependency. `/u/<name>/feed.xml` reads through the visitor's own client, so a private profile 404s exactly as its page does; posts only, because a trip's `published_at` is when it was shared and a feed ordered by that would deliver a 2019 holiday as today's news |

## Auth

| # | Feature | Status | Notes |
|---|---|---|---|
| 8 | **Login** `/login` | ✅ Done | Email + password, Zod-validated, generic error copy, `?next=` preserved and open-redirect guarded |
| — | Session refresh + route protection | ✅ Done | `src/proxy.ts`; `getUser()` not `getSession()`. The proxy hands its verified user to the render in a signed header (`shared/auth-handoff.ts`), so an authenticated page makes one auth round trip rather than two. The token is HMAC'd on `SUPABASE_SERVICE_ROLE_KEY` and the proxy deletes any inbound copy before setting its own; anything that does not verify — a prerender, a forgery, a missing secret — falls back to `getUser()`, which is what the code did before |
| — | Sign out | ✅ Done | Server Action, clears httpOnly cookies |
| 7 | **Register** `/register` | ✅ Done | Email + password + optional name, shared Zod schema, 8-character minimum matching `config.toml`. Handles both projects that require email confirmation and local, where sign-up returns a session immediately. Profile, `explorer` subscription and usage row come from the `on_auth_user_created` trigger |
| 9 | **Forgot / reset / verify** | ✅ Done | `/forgot-password` answers the same way whichever address is typed, so it cannot be used to ask who has an account. `/auth/confirm` trades an emailed token for a session and forwards — it takes a `token_hash`, which is verified server-side and so works on a different device, and still accepts a PKCE `code` for a project on the stock templates. `/reset-password` requires that session; `/verify` covers confirmed, expired and opened-directly, and offers the remedy matching the link that failed. Email templates live in `backend/supabase/templates/` |
| 10 | **Onboarding wizard** `/welcome` | ✅ Done | Username, home country, then tap the countries you have been to on a map that fills in as you go, with a searchable list beside it. Each step saves before advancing, so it resumes; only the last sets `onboarded_at`, which is what the app shell gates on |
| — | **Google OAuth** | ✅ Done | A Server Action starts it, so the browser never holds a client that can begin an OAuth flow and there is one code path into a session. `/auth/callback` is separate from `/auth/confirm` on purpose: that route verifies a `token_hash` server-side *so a link works in another browser*, and a PKCE code must do the opposite, so one route with two contracts would eventually apply the looser one to both. `next` rides through Google as a query parameter and is re-checked on return — a cookie would be a `Lax`/`Strict` distinction nobody should have to remember. Signup and sign-in are indistinguishable here, so `created_at` inside a minute is what fires the funnel's first step; without it every Google account would be missing from step one and present at every step after. `prompt=select_account`, so a shared computer does not silently reuse whichever account the browser holds. **Provider config is not in the repo**: `[auth.external.google]` is committed disabled with the local recipe, including `skip_nonce_check`, which local sign-in fails without; a hosted project needs the dashboard and its own origin in the allow-list |

## Dashboard & signature views

| # | Feature | Status | Notes |
|---|---|---|---|
| 13 | **Dashboard** `/dashboard` | ✅ Done | 8 live stat cards, world-progress bar, upcoming-trip widget, recent activity |
| 14 | **Travel Globe** `/globe` | ✅ Done | Real `visited_regions`; 4-state colouring; region list; empty state. Year, continent and trip-type filters, the same ones the world map carries, narrowing the globe, the list and the three counters on it together |
| 15 | **Country/region modal** | ✅ Done | Trips, memories, dates, cities; deep-linkable `?region=IND` |
| — | Globe region-detail paywall | ✅ Done | `showRegionDetail` from `planCode`, decided server-side |
| — | Dashboard globe preview | ✅ Done | `getGlobePreviewRegions()` had existed since the dashboard was built with nothing rendering it — the card offered a link to `/globe`, which is a description of a globe rather than a globe. Now embedded, lazily: `react-globe.gl` pulls in three.js and the dashboard is the first screen an account lands on, so shipping it in the entry chunk would make the slowest paint the one that greets a new user. Presentation only — any click opens `/globe`, where the list, filters and modal live — and it renders nothing at all for an account with no regions yet |
| 16 | **World map** `/maps/world` | ✅ Done | MapLibre 2D filling the page, with a basemap it draws itself — land, coastline and sea from the palette, no tile key needed. Country fills joined by `feature-state`, a halo on regions with data, hover lift, click-through to the region modal, layer toggles, and a floating places panel that is the keyboard-navigable equivalent. Subdivisions are gated on `globe_region_detail` and lazy-loaded only for the nine countries that have data. **Year, continent and trip-type filters** narrow the fills and the panel together, from `shared/geo/region-filter.ts`; only the years, continents and types the data can answer for are offered, so no choice empties the map. A year matches when it falls inside a region's first-to-last visit span, which is all `visited_regions` records, and the screen says so. **Trip type is built now**: the aggregate carries trip ids and not their kinds, so `getVisitedRegions()` resolves them from `trips` in one extra read — deliberately *not* a column on `visited_regions`, which has a policy exposing every row of anyone with a public profile, and where somebody went is a different disclosure from who they went with. The public profile's read leaves the field empty and the control renders nothing |
| — | **No-WebGL fallback** | ✅ Done | §6 asked for "no WebGL or low-power device → static SVG choropleth" and it was the one line of that section with nothing behind it: a browser without WebGL got a skeleton that never resolved, because `react-globe.gl` imports fine, three.js constructs a renderer, and the context request is what fails. `use-webgl-support.ts` asks for a real context — `'WebGLRenderingContext' in window` is true on every browser whose *driver* is blocklisted, which is how WebGL is commonly missing and covers most of the low-power half — and releases it immediately. `static-choropleth.tsx` draws the same regions in the same four states over `shared/geo/project.ts`, the projection the OG cards already use, so the two cannot disagree about where a country is. One merged path for the unvisited world and one path per country with data, so the element count scales with somebody's travel rather than with the world; `var()` fills, so it retunes with the theme picker without the canvas round-trip WebGL needs. **The choice is made by mounting**, not by picking between loaded modules, so a browser without WebGL never downloads three.js at all. It is also the fallback when the globe's chunk fails, which replaced a sentence that left the largest element on the screen empty while the data sat in hand. Used by `/globe` and the dashboard card alike, with 11 assertions |
| 17 | **India map** `/maps/india` | ✅ Done | All 36 states and union territories, free on every plan, fitted to the country on load |

## Trips & planner

| # | Feature | Status | Notes |
|---|---|---|---|
| 18 | **My Trips** `/trips` | ✅ Done | Tabs All/Past/Ongoing/Upcoming/Drafts with counts, flags, places, visibility |
| 19 | **Create trip** `/trips/new` | ✅ Done | 5-step wizard (basics → dates → places → cover → visibility), quota-gated, writes trip + places, and each place can carry a pin set by map click or place search. **The cover step is built**, in the position §5 always listed it. It is edit-only in substance and the reason is inherent: a cover is chosen from the trip's own photographs, and a trip being created has none — so on create the step says that rather than showing an empty grid, which also keeps the step numbers the same in both modes. It writes immediately rather than with the payload, the one place the wizard does: the choice is one idempotent field, and it goes through `setCoverPhoto` so the trip hero and `media.is_featured` are set by the same code the vault uses rather than a second copy of it. `clearCoverPhoto` is the way back to no hero |
| 20 | **Trip details** `/trips/[id]` | ✅ Done | Hero, stats, route timeline, memories, linked blogs, gallery counts, details panel, Edit and Share. **The route map is built** — `TripRouteMap` over the same three `MapView` props the vault's map tab uses, above the timeline, numbered and joined in visit order, with a note saying how many stops carry a pin. Renders nothing when none does, because the line under the list already says so |
| — | **Edit trip** `/trips/[id]/edit` | ✅ Done | Same wizard as create (`TripForm`), saveable from any step. Slug and `published_at` are deliberately stable; places are matched by id so memories stay pinned |
| — | **Delete trip** | ✅ Done | Confirm dialog → `soft_delete_trip()`; sets `deleted_at`, repaints the globe, frees quota, destroys nothing. Restorable from `/trash` for 30 days |
| — | **Trash** `/trash` | ✅ Done | Trips and posts deleted in the last 30 days, with restore, a countdown and a count of what comes back. Reads deleted trips through `list_deleted_trips()`, because `trips_select_own` hides them from their own owner. Restoring is refused when it would breach the plan's trip limit |
| 21 | **Itinerary builder** `/trips/[id]/itinerary` | ✅ Done | Days and entries over `itinerary_days` / `itinerary_items`. A day needs neither date nor title, so a trip in planning can be laid out before it has dates; a trip that has them offers to create every missing day in one click, capped at 60 so a mistyped year cannot write 370 rows. Six kinds, four statuses, per-day and per-trip cost roll-ups grouped by currency and never summed across. Times, costs, booking refs and links are gated on `itinerary_full` and **dropped rather than refused** on a free plan, which is what the pricing table sells. **Drag and drop** reorders entries within a day and moves them between days, by pointer, touch and keyboard — `@dnd-kit`, chosen over native HTML5 drag events because those do nothing at all on a phone; the write is one `reorder_itinerary_items()` call that renumbers from array position rather than one update per row. Also gated on `itinerary_full`, which is how the pricing table sells it. **Undated days drag too**, through `reorder_itinerary_days()`; a dated day gets no handle at all, because `getItinerary()` sorts on its date and a handle that lost every time is worse than none. Both levels share one `DndContext` — the day handles live inside the cards, so a second one would have captured them — and a day where every entry is timed says on the card that the clock decides its order. **The map alongside** draws entries that carry a pin, numbered across the whole trip and joined in order, from the same `PlacePicker` the trip wizard uses; free on every plan, and lazy-loaded like every other map here. **A priced entry can be recorded as spent** in one press: it becomes an expense carrying the entry's id, its title, its amount and its day's date — not today's — under the category its kind maps to, and the entry then shows what it came to and by how much it moved. Offered only on a priced entry that has not been recorded, and only once, which a partial unique index enforces underneath the sentence |
| 22 | **Budget planner** `/trips/[id]/budget` | ✅ Done | `expenses` against `trips.budget_planned`, which is the same field the trip form and analytics read, so a budget set here is set everywhere. One panel per currency: the plan only applies to the currency it was written in, and spend in any other gets a total and no comparison, because there is no exchange rate here. Category breakdown and its chart are gated on `budget_full`; recording an expense and seeing the totals are free, since a budget you cannot write to is not a budget. Also totals what the itinerary expects to cost. `shared/budget.ts` is pure and holds all of it, with 20 assertions. **An expense recorded from the itinerary carries `expenses.itinerary_item_id`** and says so on its row, with the planned figure beside the actual one and the difference when both are in one currency. The column is `on delete set null` and never cascade: the entry was a guess and the expense is a fact, and one is not allowed to take the other with it |
| 23 | **Packing / checklists** `/trips/[id]/packing` | ✅ Done | `checklists` / `checklist_items`, packing and to-do, grouped by a free-text category in the order they were built. Adding a line and ticking one off are each one gesture and no dialog; the tick sends the value it means rather than a toggle, so two taps cannot race. `limits.checklists` is read **per trip** — three on the free plan — and templates are the unlimited plans' feature: six of them in `shared/packing.ts`, copied in as ordinary rows so a list can be gutted without breaking anything |
| 24 | **Collaborators** `/trips/[id]/people` | ✅ Done | Invite by email as `editor` or `viewer`, change a role, remove somebody, and the other side — accept, decline, leave — on `/trips`. The screen states what each role can **and cannot** do, in two lists under two headings rather than one list with two icons, because the tick and the cross are `aria-hidden` and a flat list reads every line as a permission. `collaborators_per_trip` gates it: 0 on Explorer reads as "not available", not as a limit of none. **No email is sent** — an invitation is delivered by the app, which the invite form says plainly |

## Memory & content

| # | Feature | Status | Notes |
|---|---|---|---|
| 25 | **Memory Vault** `/trips/[id]/vault` | ✅ Done | Timeline, Gallery and Map. Timeline interleaves photos and notes by date; photo detail carries caption, alt text, coordinates, cover photo and a confirmed delete. The map draws pinned places as numbered stops joined in visit order, and photos at their EXIF coordinates or — dashed, and labelled — at the stop whose dates contain them. Photos matching neither are listed with the reason. `shared/geo/photo-placement.ts` owns that policy and is unit-tested. **HEIC has a fallback here now**: `server/media/display.ts` writes a WebP copy into the *private* bucket, beside the original under the owner's own prefix, and signs that instead — the public bucket would have made an unpublished photograph as reachable as an unlisted link. Generated lazily through the owner's own client, best-effort, and swept by both deletion paths |
| 26 | **Media upload + quota meter** | ✅ Done | `POST /api/uploads/sign` issues a quota-checked signed URL, the browser PUTs straight to Storage, and `confirmUpload` re-reads the object's real size and sniffs its magic bytes before writing the row. Drag-drop, per-file progress, per-trip and pool meters, EXIF date and GPS captured on the client |
| 27 | **Blog Studio** `/blogs/new`, `/blogs/[id]/edit` | ✅ Done | Tiptap v3 with a formatting toolbar, **inline images**, autosave (1.5s debounce, ⌘S, unload guard), excerpt and SEO fields, trip link, visibility, publish/unpublish, soft delete and a **share panel** for unlisted links. A new post writes no row until the first save, then swaps the URL in place so the cursor survives. Images upload through the signed-upload route and are inserted as EXIF-stripped copies, stored privately and served through a resolver that checks the post's visibility — so a picture in a draft is no more reachable than the draft is |
| 28 | **My Blogs** `/blogs` | ✅ Done | All / Published / Drafts with counts, reading time, linked trip, and a link to the public reader |
| 29 | **Blog reader** `/b/[slug]` | ✅ Done | Public route. Sanitised HTML, byline linking to the author's profile, reading time, linked trip, JSON-LD `Article`, `noindex` on anything unpublished or opened with a token, and the badge only on free plans. `?k=<token>` opens an unlisted post through `resolve_post_share_link()`; the author sees their own drafts behind a notice, and everyone else gets the same 404 as a slug that does not exist |
| 30 | **Wishlist** `/wishlist` | ✅ Done | Add, edit and remove, grouped by priority with its label always spelled out. Country is the only required field — the globe needs nothing else. Writes revalidate the globe, both maps and the dashboard, because `wishlist_items` is a source for `visited_regions` and a stale page would keep painting a deleted wish. The one-row-per-country index surfaces as a sentence, not an error, and a rejected save is echoed back into the form rather than cleared by React's reset. A country already visited is flagged on its card |
| 31 | **Travel timeline** `/timeline` | ✅ Done | Year sections newest first with a jump row, trips and published posts interleaved. Per-year stats come from `shared/timeline.ts`, which is pure and unit-tested because they are claims about someone's life: days are counted in the year actually spent (a New Year crossing splits), travel booked is counted apart from travel taken, and "first time in" reads `visited_regions` filtered to `visited`/`current` — a planned trip has reached nowhere. Undated trips get a trailing section rather than being dropped. Free on every plan |

## Analytics, resume, recap

| # | Feature | Status | Notes |
|---|---|---|---|
| 32 | **Analytics** `/analytics` | ✅ Done | Days away per year, with travel booked stacked apart from travel taken and the empty years drawn rather than skipped; longest, shortest and average trip; distance with the count of trips it could actually measure. Behind `analytics_advanced`: the day-by-day calendar, who you travel with, the countries you return to, and money — **planned and actual**, grouped per currency and never summed across them, because there is no exchange rate here. Plan meets spend only over the trips carrying both in the same currency; a budgeted trip with no expenses recorded is left out rather than counted as an underspend. `shared/analytics.ts` is pure and holds all of it |
| 33 | **Travel resume** `/resume` | ✅ Done | Countries, regions, trips, travel days — counted by `totalDaysAway` in `shared/timeline.ts`, the same definition the timeline and analytics use, so the three cannot disagree — years travelling, distance — with the count of trips actually behind that figure, since a trip with one pin among three contributes nothing and used to say so nowhere — and distinct places by kind: cities, mountains, beaches, UNESCO sites. `distanceCoverage()` is shared with analytics, so the two cannot disagree, and a visitor's card says the distance is not shown rather than implying nothing is pinned. Plus the share panel: public URL, copy button, the switch that publishes the profile, and display name and bio |
| 34 | Travel Wrapped | ⬜ Not started | Phase 1.2 |
| 35 | Achievements & XP | ⬜ Not started | Phase 1.2; tables not migrated |

## Public sharing

| # | Feature | Status | Notes |
|---|---|---|---|
| 36 | **Public profile** `/u/[username]` | ✅ Done | Avatar, bio, home city, interests, the resume counters, a read-only globe with its region list, trip cards and published posts. JSON-LD `Person`, canonical URL, `noindex` while private, and the free-plan badge. A private profile 404s for everyone but its owner, who sees a preview notice |
| — | **Sitemap** `/sitemap.xml` | ✅ Done | Public profiles and published posts, listed through the same client a visitor gets so it can never advertise a private page |
| 37 | **Public trip** `/t/[slug]` | ✅ Done | Read-only trip: hero, dates, route, gallery, notes and linked posts, with JSON-LD `Article` and OG images. Photos are published as EXIF-stripped derivatives, never originals. The route timeline now carries the same `TripRouteMap` the owner sees — a stop's pin is the place its owner chose from a picker on a trip they chose to publish, which is a different fact from a photograph's EXIF, and publication goes on stripping that |
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
| Skeleton loaders | ✅ Done | A `loading.tsx` on every route under the app shell, built from `page-skeleton.tsx`. They are not decoration: each authenticated route is `force-dynamic`, and Next does not prefetch a dynamic route without a loading boundary — so without one a click buys a full round trip with the previous screen frozen. The heading is passed as real text rather than drawn as a grey bar, because it is known at build time and a skeleton of a word we already have is worse than the word. The public readers — `/b/[slug]`, `/t/[slug]`, `/u/[username]` — have them too now, drawing their headings as bars, since a title belongs to whichever slug resolves |
| Charts | ✅ Done | `recharts` was a dependency nothing used. `client/components/analytics` is the first, reading `--chart-1`…`--chart-5`, so a chart retunes with the theme picker like everything else |
| Empty states | ✅ Done | On every screen that can be empty. `client/components/empty-state.tsx` holds the pattern the planner screens had each grown independently — icon, a line naming what is missing, and an action where one is honest. The trips tabs used to say "Nothing here yet" on all five, which is true of all of them and useful on none: an account with nine past trips and no upcoming one is not empty, and they now say so per tab. Deliberately not used inside a `Card` — the dashboard's two keep prose, because a dashed box in a bordered box reads as a rendering fault; what they borrow is the substance, saying what would appear |
| Command palette (⌘K) | ✅ Done | Cmd+K or Ctrl+K anywhere in the app shell. Destinations come from `shared/navigation.ts`, so a new route is reachable without a second list to keep; plus "New trip" and "New blog post". Hand-rolled over the existing dialog rather than adding `cmdk` — the matching is 15 lines. Ranked in three tiers (label prefix, label substring, then keyword aliases like "photos" or "bucket list"), and **the returned order is the rendered order**, which is load-bearing: the arrow keys walk the array while the screen groups by section, and a Create item out-ranking a destination used to highlight one thing while the eye was on another. Combobox pattern — focus stays in the input and `aria-activedescendant` announces the highlight. **Trips are not searchable**, which the empty state says rather than letting it be discovered |
| Sidebar quota meter | ✅ Done | Trips and storage at the foot of the sidebar, from `getAccountUsage()`. Two lines rather than five: one walls off the create button and the other is what costs money, while the per-trip photo cap belongs to a trip the sidebar cannot know. `plans.limits` uses null for **unlimited**, so an unlimited line keeps its count and loses its bar rather than reading "0 left"; a limit of 0 means "not on this plan" and is not a line at all. Amber from four fifths, destructive at the ceiling, and the upgrade link appears only when something is actually tight. Renders nothing on a plan with no limits. `shared/quota.ts` is pure with 13 assertions |
| `error.tsx` / `not-found.tsx` per group | ✅ Done | `not-found.tsx` for `/trips/[id]` and `/b/[slug]`, and error boundaries at all three levels: `(app)/error.tsx`, a public `app/error.tsx`, and `app/global-error.tsx` for a root layout that itself failed. Group level rather than per screen, and that is the point — the shell is rendered by the group's layout, *outside* the boundary, so a screen that throws keeps its header and sidebar and you can walk away from it. `client/components/error-state.tsx` is shared: it never prints the thrown message, which can carry a row id or the shape of a query, and shows React's digest instead, which identifies the fault without describing it. `global-error.tsx` is styled inline, since a layout that threw may never have loaded the stylesheet |
| Toasts | ✅ Done | `sonner` was mounted in `providers.tsx` and nothing ever called it. `useActionToast` announces a Server Action result once per submission — keyed on the state object `useActionState` returns, so a parent re-render cannot repeat it while the same failure twice running is still reported twice. Wired to the surfaces where a write was otherwise silent: the itinerary board, the budget, packing and collaborators. Errors are announced by default and suppressed where the form already prints its own. 8 assertions, with `sonner` mocked — a real toast is an animated element that removes itself after four seconds |

---

## Known gaps worth fixing next

1. **The Google round trip has never been performed.** The button, the action, the
   callback and the funnel event on a first arrival are all built and typecheck, and
   the sign-in screen renders correctly with the button above the credentials form.
   But no one has been bounced to Google and back, because that needs an OAuth client
   from a Google Cloud project and the repo deliberately ships `[auth.external.google]`
   disabled with no credentials. The recipe is in `config.toml` next to the switch.
   Production additionally needs the provider configured in the Supabase dashboard and
   the deployed origin in the redirect allow-list — the same class of gap as (3), and
   nothing in the repo can enforce either.
2. **Rate limiting is per-instance until Upstash is configured.** Without
   `UPSTASH_REDIS_REST_URL` the counter lives in the server's own memory, which is a
   real limit on one long-lived process and an approximation on serverless: a caller
   spread across enough instances gets more than the policy says, and a cold start
   forgets. The interface is identical either way, so this is a deployment step rather
   than a code change — but it is a deployment step somebody has to remember, and the
   limits are advertised in the changelog as though they hold.
3. **Sign-up confirmation works locally; production still needs its dashboard set up.**
   The path is no longer untested — on 2026-08-20 it was run end to end with
   `enable_confirmations = true`: sign-up returned the "check your inbox" branch, the
   mail arrived under the custom subject and template, and the link confirmed the
   address and forwarded to `/verify`, with the profile, `explorer` subscription and
   usage row all created by the trigger. Two things about that check are worth keeping:
   the link carries a **`pkce_`-prefixed `token_hash`**, and it was opened on a
   different host from the one that signed up — 127.0.0.1 rather than localhost, so a
   different cookie jar — and still worked, which is exactly the claim `/auth/confirm`
   makes about a mail opened on another device. `config.toml` records how to re-run it.
   What remains is the half no repo can enforce: a hosted project needs both email
   templates set in the Supabase dashboard and its own origin in the redirect
   allow-list, or it sends links that go nowhere.

4. **The year filter is still only as precise as the aggregate.** Trip type is built now, and
   the honest caveat that remains is the year's: `visited_regions` records a first and a last
   visit and nothing between, so a region visited in 2019 and 2026 matches every year between.
   The screen states it rather than hiding it. Making it exact needs a per-visit table, which
   is a schema change and a bigger one than it looks — the aggregate is rebuilt from three
   sources in a fixed precedence and a fourth grain would have to survive all of them.
5. **Nothing tells anyone a contact message arrived.** `submit_contact_message()` writes the row
   and the sender is told it reached us, which is true; but the inbox is a table that somebody has
   to remember to open in Studio. The page promises an answer within about three working days, and
   nothing in the repo makes that happen. A database webhook or a scheduled digest to
   `BRAND.support.email` would close it, and `handled_at` is already there to mark what has been
   answered.
6. **A collaborator can plan a trip but not see what it costs.** `expenses` has one policy,
   `user_id = auth.uid()`, and no collaborator clause at all, which is the right default for
   money and the wrong answer for four friends splitting a trip. `paid_by` is free text for that
   reason — it records who paid without pretending to settle up. Splitting properly needs its own
   sharing model rather than an early guess at one. Note the line is drawn between the two halves
   of "the budget": `trips.budget_planned` rides on the trip row and RLS shares it, so a
   collaborator sees the plan and never the spend, and every surface now says exactly that —
   including the analytics money section, which reads the caller's own expenses and nobody else's.
7. **An invitation is delivered by the app, not by email.** There is no transactional email in
   this codebase — the same gap that leaves a contact message sitting in a table (5). So an
   invitation only surfaces when the invitee next opens their own Trips screen, and somebody
   invited at an address they have not signed up with sees nothing until they do. The invite form
   says so rather than letting it be discovered. `invited_email` and the pending state are already
   the right shape for a mail to be sent from; nothing else has to change when one can be.
8. **Per-day actual spend is possible now, and not built.** An expense can name the itinerary
   entry it settles, so the day it belongs to is finally derivable — but the itinerary still
   totals only what a day was *planned* to cost, and the budget screen still groups by category
   rather than by day. This is the half of the plan-against-actual loop that was unblocked
   rather than finished. Note also that a recorded expense is deliberately editable afterwards
   and is *not* kept in step with the entry: changing the plan's price later does not touch the
   money, which is right, but nothing tells you the two have drifted.
9. **The drag gestures still want a human, and the keyboard path cannot stand in.**
   Entries within and between days, and undated days themselves. The obvious dodge was
   to drive dnd-kit's keyboard sensor instead of a pointer — space to lift, arrows to
   move, space to drop — since that needs no compositing. It was tried on 2026-08-20
   and does not work here either, for a reason worth writing down: the handle measures
   **0×0** in the harness, a zero-size element cannot take focus, and dnd-kit's
   keyboard sensor is anchored on the activator having it. The sortable itself is
   plainly live — the handles carry `aria-roledescription="sortable"` and
   `aria-describedby`, so `useSortable` ran — and a synthetic `keydown` reaches the
   document without dnd-kit acting on it. The markup, the handles and their labels are
   checked in the DOM, both `reorder_itinerary_items()` and `reorder_itinerary_days()`
   have pgTAP coverage including the cross-account no-op, and `parseOrderedIds` is
   unit-tested. The gesture wants a real browser.

10. **The map and globe filters are exercised now; only the painted fills are not.**
   All three — year, continent and trip type — were driven in a browser over the seed's
   real data on 2026-08-20, on `/maps/world` and `/globe` alike. Choosing a continent
   narrowed the places panel from 10 countries to 1 and the note read "Showing 1 of 10";
   trip type "solo" gave 3 of 10 and "family" 1 of 10, each with its own caveat sentence
   rendered; year 2022 gave 1 of 10 with the aggregate's caveat; continent and type
   together narrowed to the intersection; and clearing each restored the full list. On
   the globe the three counters moved with the list — 6 countries, 15 cities and 3% of
   the world going to 0, 0 and 0% under a filter whose only match is a *planned* region,
   which is `rollUpToCountries` counting `visited`/`current` and nothing else, exactly as
   documented. `shared/geo/region-filter.ts` has 24 assertions behind it and
   `shared/geo/continents.ts` proves its 250-country coverage.

   **What is still unverified is the picture.** Nobody has watched the country *fills*
   change colour, because MapLibre and three.js need compositing the harness does not do
   — so the filter's effect on the data and on the keyboard-navigable panel is proved,
   and its effect on the canvas is not. The same limitation still covers two other
   surfaces: **the cover picker has never been clicked**, because the trip wizard does not
   hydrate where `PlacePicker` lazy-loads MapLibre, and **the dashboard globe has never
   been seen drawn**. Their write paths are exercised elsewhere — `setCoverPhoto` by the
   vault — and their markup was read from the DOM.
