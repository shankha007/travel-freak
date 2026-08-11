# TravelFreak — Project Plan

> Canonical product + architecture plan. Authored during planning; stored here so
> it is versioned with the code rather than living in a chat transcript.
> Feature delivery status is tracked separately in [STATUS.md](STATUS.md).

## Context

**TravelFreak** (working name) is a new consumer web product: a **Personal Travel OS** where travellers plan future trips, document completed ones, preserve memories, write blogs, and visualize their entire travel history on an interactive 3D globe. Positioning is *Notion + Google Maps + Polarsteps + Instagram Memories*, with **emotional value of memories** as the differentiator — not another itinerary tool.

This plan merges the product vision document with an implementation architecture. Decisions locked during planning:

| Decision | Choice | Note |
|---|---|---|
| Stack | Next.js 15 (App Router, TS) + **Supabase** | Supabase *is* Postgres — schema lifts to self-hosted Postgres + NestJS later if you outgrow it |
| Maps | **MapLibre GL + MapTiler** (2D) + `react-globe.gl` (3D) | Open-source, no per-load billing |
| AI features | **Deferred to v1.1+** | Entitlement hooks built in v1 so it's a drop-in later |
| 3D Globe | **Free at country level**; depth is paid | Protects the growth loop |
| Payments | Provider-agnostic layer; Razorpay/Stripe wired in Phase 3 | |
| Visibility | Private-first, public opt-in (`private / unlisted / public`) | |
| Ads | **None, anywhere** | |
| Tiers | Explorer (free) · Voyager · Nomad | Revised limits (§4) |

**Outcome of the MVP:** a deployed app where a user signs up, logs a past trip with places + photos + a blog, watches their globe light up, and shares a public Travel Resume link.

> **Rename safety:** all product naming lives in `brand.ts` (`APP_NAME`, `APP_TAGLINE`, `APP_DOMAIN`). Never hardcode "TravelFreak" in a component. Use a neutral package name (`travel-app`) so a rename is a one-file change.

---

## 1. What changed from the original prompt, and why

Everything else from the source document carries through intact. These five are deliberate departures:

1. **3D Globe moved from Voyager to Explorer (country-level).** Ads are ruled out, so organic sharing is the only growth channel, and a shared globe screenshot *is* the marketing. Gating it means non-paying users never see the thing that makes people sign up. Instead the free globe is fully functional at country level with a small "Made with TravelFreak" badge; **state/province detail, themes, city pins, routes and timeline playback are paid.** Same upgrade pressure, growth loop intact.

2. **Nomad's storage numbers reconciled.** "Unlimited trips × 50 videos/trip" and "100 GB pool" contradict each other — 50 videos across even 20 trips blows past 100 GB. The **pool is the real limit**; per-trip caps exist for clarity. Both are stated on the pricing page so nobody feels tricked.

3. **"Unlimited AI" replaced with generous stated caps.** Every AI call costs real money. Unlimited usage on a ₹499/mo tier means one power user consumes ten subscriptions of margin. Voyager gets 50 generations/month, Nomad 200 — high enough that ~97% of users never notice, low enough to cap downside.

4. **Budget Planner and Packing Lists get a free basic tier.** These are utility features people use *before* they love the product. A free user who plans a trip and packs for it comes back; one who hits a paywall on day one leaves. Full versions (multi-currency, actual-vs-planned, templates, split-with-friends) stay paid.

5. **Blog cap raised from 15 to unlimited on Free.** Text costs nothing to store, and public blogs are inbound SEO traffic — capping them caps acquisition. The photos inside blogs are already limited, which is the real cost control.

Also added, absent from the original prompt but needed: **data export & account deletion** (GDPR / India DPDP Act), **abuse reporting + moderation** for public content, **EXIF GPS stripping** (§7), and an **admin panel**.

---

## 2. Architecture

### 2.1 Shape

```
┌──────────────────────────────────────────────────────────────┐
│ Browser — Next.js App Router (RSC + Client Components)        │
│ react-globe.gl · MapLibre GL · Framer Motion · Tiptap         │
│ TanStack Query · Zustand · shadcn/ui                          │
└──────────────────┬───────────────────────────────────────────┘
                   │ Server Actions · Route Handlers
┌──────────────────▼───────────────────────────────────────────┐
│ Next.js server (Vercel)                                       │
│ auth middleware · zod validation · ENTITLEMENT CHECKS          │
│ signed-upload issuer · payment webhooks · OG image gen         │
└───┬──────────────────┬──────────────────┬────────────────────┘
    │                  │                  │
┌───▼──────────┐ ┌─────▼────────┐ ┌───────▼─────────────┐
│ Supabase     │ │ Supabase     │ │ Razorpay / Stripe   │
│ Postgres     │ │ Storage      │ │ (Phase 3)           │
│ + PostGIS    │ │ + CDN        │ └─────────────────────┘
│ + RLS        │ └──────────────┘
└──────┬───────┘        ▲
       │                │ direct upload (signed URL)
┌──────▼────────────────┴──────────────────────────────┐
│ Background jobs — Supabase Edge Functions / Vercel cron│
│ image derivatives · video transcode · quota recompute  │
│ trip status flips · Travel Wrapped generation · emails │
└───────────────────────────────────────────────────────┘
```

### 2.2 Three decisions that matter most

- **RLS is the security backbone.** Every table carries `user_id`; Postgres policies enforce ownership. A bug in a route handler cannot leak another user's trips. Public/unlisted visibility is expressed *as an RLS policy*, not as application logic — this is the difference between a privacy incident and none.
- **Media never transits the server.** The client asks a Route Handler for a signed upload URL; that handler checks the plan quota, then the browser PUTs directly to Storage. Vercel costs stay flat as media grows to terabytes.
- **PostGIS from day one.** `geography(Point,4326)` on places gives distance-travelled, nearest-city snapping, "trips within X km", and clustering without hand-rolled haversine math.

### 2.3 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, TypeScript strict mode |
| UI | Tailwind CSS + shadcn/ui + Radix · Framer Motion for micro-interactions |
| Forms | React Hook Form + Zod (schemas shared client↔server) |
| Server state | TanStack Query · **Client state** Zustand (globe/map view, modals) |
| 3D globe | `react-globe.gl` (Three.js) — dynamically imported, never in initial bundle |
| 2D maps | MapLibre GL JS + MapTiler vector tiles |
| Geo data | Natural Earth Admin-0 + Admin-1 → simplified topojson. Keys: **ISO 3166-1 α-3** and **ISO 3166-2** |
| Editor | Tiptap (ProseMirror) → `content_json` + rendered `content_html` |
| Charts | Recharts (analytics, budget breakdowns) |
| Images | `next/image` + Supabase transforms → AVIF/WebP, blurhash placeholders |
| Video/Audio | **Mux** or **Cloudflare Stream** (Phase 3, Nomad only) — never self-host transcoding |
| Email | Resend + React Email |
| Analytics | PostHog (funnels, feature flags) · **Errors** Sentry |
| Testing | Vitest · Playwright · **pgTAP for RLS** |
| CI/CD | GitHub Actions → Vercel; Supabase migrations via CLI |

### 2.4 Repo structure

> **Note:** the repo has since been split into `frontend/` and `backend/` at the
> root, and `src/` is layered `app / client / server / shared`. See
> [frontend/src/README.md](../frontend/src/README.md). The intent below is unchanged.

```
travel-app/
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/        # landing, features, pricing, blogs, about, contact
│  │  ├─ (auth)/             # login, register, forgot, reset, verify
│  │  ├─ (app)/              # authenticated shell
│  │  │  ├─ dashboard/ globe/ maps/ trips/ plan/
│  │  │  ├─ vault/ blogs/ wishlist/ timeline/
│  │  │  ├─ analytics/ resume/ wrapped/ settings/
│  │  ├─ u/[username]/       # public profile + Travel Resume
│  │  ├─ t/[slug]/           # public / unlisted trip
│  │  ├─ b/[slug]/           # public blog post
│  │  └─ api/                # webhooks, signed uploads, og-image
│  ├─ components/{ui,globe,map,trip,editor,vault,billing,charts}/
│  ├─ features/              # feature-sliced domain logic
│  ├─ lib/{supabase,auth,billing,entitlements,geo,validation,brand}.ts
│  └─ types/database.ts      # generated from Supabase
├─ supabase/{migrations,seed,functions}/
├─ public/geo/               # simplified topojson
└─ e2e/
```

---

## 3. Data model

Postgres. Every table: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, **RLS enabled, no exceptions**.

### Identity
- **`profiles`** — `id` (=`auth.users.id`), `username` (unique citext), `display_name`, `bio`, `avatar_url`, `country`, `city`, `travel_interests[]`, `social_links jsonb`, `is_public`, `onboarded_at`.

### Trips & geography
- **`trips`** — `user_id`, `title`, `slug`, `summary`, `cover_media_id`, `start_date`, `end_date`, `status` (`planning|upcoming|ongoing|completed`), `visibility`, `trip_type` (`solo|couple|friends|family|business`), `traveler_count`, `budget_planned`, `currency`, `published_at`, plus denormalized counters (`photo_count`, `video_count`, `audio_count`, `media_bytes`) maintained by triggers so quota checks are one cheap read.
  - `status` auto-flips nightly from dates via cron; user can override.
- **`trip_places`** — `trip_id`, `country_code` (α-3), `region_code` (ISO 3166-2, nullable), `city_name`, `location geography(Point,4326)`, `arrival_date`, `departure_date`, `order_index`, `place_kind` (`city|mountain|beach|forest|unesco|national_park|other`), `notes`.
  - **Single source of truth for the globe, maps, analytics and Travel Resume.** No parallel "visited countries" table to drift.
- **`visited_regions`** — aggregate refreshed by trigger: per user × `country_code` × `region_code` → `visit_count`, `first_visit`, `last_visit`, `trip_ids[]`, `featured_media_id`, `state` (`visited|current|planned|wishlist`). **The globe reads only this table** — one small result set, not a join across all trips.
- **`wishlist_items`** — `user_id`, `country_code`, `region_code`, `notes`, `est_budget`, `currency`, `priority`, `best_season`.

### Memory Vault & content
- **`media`** — `user_id`, `trip_id`, `kind` (`image|video|audio`), `storage_path`, `mime`, `bytes`, `width`, `height`, `duration_s`, `blurhash`, `taken_at`, `exif_lat/lng`, `caption`, `alt_text`, `is_featured`, `processing_status`, `album_id`.
  - EXIF GPS + timestamp parsed on upload → auto-suggests which trip/place a photo belongs to. **Public derivatives are EXIF-stripped** (§7).
- **`albums`** — `trip_id`, `title`, `cover_media_id`, `order_index`.
- **`memories`** — atomic entries pinned to a place: `trip_place_id`, `kind` (`note|photo|audio|video|quote|favorite_location`), `body`, `media_id`, `happened_at`. Drives the globe modal and Vault timeline.
- **`blog_posts`** — `trip_id` (nullable → standalone posts), `user_id`, `title`, `slug`, `content_json`, `content_html`, `excerpt`, `cover_media_id`, `reading_minutes`, `visibility`, `theme`, `seo_title`, `seo_description`, `published_at`, generated `search_vector tsvector` + GIN index.

### Planner
- **`itinerary_days`** — `trip_id`, `day_date`, `title`, `notes`.
- **`itinerary_items`** — `day_id`, `time_start`, `time_end`, `kind` (`activity|hotel|restaurant|transport|booking|note`), `title`, `location geography`, `cost`, `currency`, `booking_ref`, `url`, `attachment_media_id`, `order_index`, `status`.
- **`expenses`** — `trip_id`, `category` (`flights|hotels|food|activities|shopping|misc`), `amount`, `currency`, `fx_rate`, `spent_at`, `paid_by`, `notes`.
- **`checklists` / `checklist_items`** — packing & todo, with reusable templates by trip type.
- **`trip_collaborators`** — `trip_id`, `user_id`, `role` (`owner|editor|viewer`), `invited_email`, `accepted_at`. RLS policies consult this so collaborators see shared trips.

### Gamification
- **`achievements`** (catalogue: code, name, icon, criteria jsonb) · **`user_achievements`** (`user_id`, `achievement_code`, `earned_at`) · XP and level derived from `user_achievements` + trip counts, recomputed on write.

### Billing
- **`plans`** — seeded config: `code` (`explorer|voyager|nomad`), `name`, `price_inr`, `price_usd`, **`limits jsonb`**.
- **`subscriptions`** — `user_id`, `plan_code`, `provider`, `provider_customer_id`, `provider_subscription_id`, `status`, `current_period_end`, `cancel_at_period_end`, `trial_ends_at`.
- **`usage_counters`** — `user_id`, `period_start`, `storage_bytes`, `trips_count`, `ai_calls_used`.
- **`webhook_events`** — raw payload + unique `provider_event_id` for **idempotent** processing.

### Ops
`share_links` (revocable unlisted tokens) · `notifications` · `audit_log` · `reports` (abuse on public content) · `wrapped_snapshots` (frozen yearly recap data).

### Indexes
`trips(user_id, start_date desc)` · `trip_places(trip_id)` · `trip_places using gist(location)` · `media(trip_id, kind)` · `blog_posts using gin(search_vector)` · unique `(user_id, country_code, region_code)` on `visited_regions`.

---

## 4. Pricing — Explorer / Voyager / Nomad

**Principle:** never gate the habit loop or the shareable artifact. Charge for **media richness, storage, AI, collaboration, and export** — the things that cost real money and that only committed users want. No ads, ever.

| | **Explorer** (Free) | **Voyager** | **Nomad** |
|---|---|---|---|
| **Price** | ₹0 | ₹399/mo · ₹3,499/yr | ₹799/mo · ₹6,999/yr |
| **Trips** | **15** | Unlimited | Unlimited |
| **Photos / trip** | **5** (stored ≤1600px) | **200** (full-res) | **500** (full-res + RAW) |
| **Videos / trip** | ✗ | ✗ | **50**, ≤10 min each |
| **Audio diaries / trip** | ✗ | ✗ | **50**, ≤15 min each |
| **Storage pool** *(the real cap)* | 1 GB | 30 GB | **100 GB** |
| **Blogs** | **Unlimited** (public + private) | Unlimited + custom themes | Unlimited + themes |
| **Text memories, quotes, notes** | Unlimited | Unlimited | Unlimited |
| **3D Globe** | ✓ **country-level** | ✓ + states/provinces, themes, heatmap | ✓ + city pins, routes, **timeline playback**, premium skins |
| **World / India maps** | ✓ country + India states | ✓ all province-level maps | ✓ |
| **Wishlist, Travel Timeline** | ✓ | ✓ | ✓ |
| **Itinerary builder** | Basic (days, activities, notes) | Full (times, costs, bookings, attachments, drag-drop) | Full + offline/print pack |
| **Budget planner** | Basic totals | Full: categories, planned-vs-actual, charts, multi-currency | + CSV import, split-with-friends |
| **Packing lists** | 3 lists | Unlimited + templates | Unlimited + shared templates |
| **Collaborative planning** | ✗ | 3 collaborators/trip | Unlimited |
| **Analytics** | Basic counters | Advanced + heatmaps | + comparisons, route stats |
| **Travel Resume (public URL)** | ✓ *(with "Made with" badge)* | ✓ badge removed | ✓ + custom domain |
| **Travel Wrapped** | Basic yearly recap | Full animated + shareable graphics | Advanced + video recap |
| **Album management** | ✗ | ✓ | ✓ + AI organization *(v1.1)* |
| **Export** | JSON/CSV of your text | + PDF & Markdown trip export | + photobook PDF, full media archive |
| **AI generations/month** *(v1.1)* | **5** | **50** | **200** |
| **Achievements & XP** | ✓ | ✓ | ✓ |
| **Support** | Community | Email | Priority |
| **Ads** | **None** | **None** | **None** |

### Why these lines

- **5 photos/trip on Explorer** is the right friction point: enough that a trip page feels real and gets shared, not enough for someone back from Ladakh with 300 photos. The upgrade prompt appears mid-upload — the moment of maximum motivation.
- **Per-trip caps *and* a storage pool.** Per-trip caps are easy to communicate; the pool is the actual cost backstop. State both.
- **State-level globe detail as the headline Voyager feature** — near-zero marginal cost, most visually obvious "your map is better" moment, and the best screenshot for the pricing page.
- **Collaboration drives expansion:** an invited free user sees a Voyager-quality trip and converts.
- **Annual ≈ 8.75 months' cost** — standard SaaS discount; dramatically improves cash flow and churn.
- **Badge on free public pages** is the entire no-ads growth engine. Removing it is a cheap, real upgrade reason.

### Mechanics that must be built in

- **Never delete over-quota data on downgrade.** Lock it read-only with a clear banner; 30-day grace, then archive-but-retain 90 more. Deleting someone's honeymoon photos ends the relationship permanently.
- **Soft limits, clear copy.** At 4/5 photos: "1 photo left on this trip." At 5/5: an inline upgrade card showing exactly what Voyager adds — not a modal wall.
- **14-day Voyager trial, no card**, triggered *on first quota hit* rather than at signup. Converts far better.
- **Server-side enforcement only.** All quota logic lives in `entitlements.ts` and runs **before** the signed upload URL is issued. Client checks are UX, never enforcement.
- **`plans.limits` JSONB is the single source of truth** — read by both the pricing page and the enforcement code, so they can never disagree.
- **Founding-member offer:** lifetime 40% off for the first 500 payers.

---

## 5. Web screens

**[M]** = MVP · **[1.1]** · **[1.2]**

### Public / marketing
1. **Landing** `/` — hero with live rotating demo globe, feature sections, testimonials, CTA **[M]**
2. **Features** `/features` **[M]** · 3. **Pricing** `/pricing` — rendered from `plans.limits`, monthly/annual toggle, FAQ **[M]**
4. **Public Blogs** `/blogs` — featured & recent published posts, SEO landing **[M]**
5. **About** `/about` · 6. **Contact** `/contact` **[1.1]**
7. **Register** `/register` — email+password, Google OAuth **[M]** · 8. **Login** `/login` (+ magic link) **[M]**
9. **Forgot / Reset / Verify** **[M]**
10. **Onboarding wizard** `/welcome` — username → home country → **"tap countries you've already visited"** (instant globe payoff) → optional first trip **[M]**
11. Legal: `/privacy`, `/terms`, `/refunds` **[M]** · 12. **Changelog** `/changelog` **[1.1]**

### Dashboard & signature views
13. **Dashboard** `/dashboard` — overview cards (countries/states/cities/trips/upcoming/blogs/memories/travel days/distance), recent activity, upcoming-trip widget with countdown + budget + checklist, travel heatmap, **clickable 3D globe preview** **[M]**
14. **Travel Globe** `/globe` — full-screen 3D; colour states: **green = visited, blue = current trip, yellow = planned, grey = unvisited**; filters (year, continent, trip type); sidebar region list; share button **[M]**
15. **Country/Region modal** — hero photo, trip summary, cities visited, dates, short memory, quick stats, View Blog, View Gallery; **timeline when multiple trips exist for one country** **[M]**
16. **World Map** `/maps/world` — MapLibre 2D; visited / wishlist / planned layers; filters **[M]**
17. **India Map** `/maps/india` — state-level tracking **[M]** — architecture generalizes to any country's admin-1 **[1.1]**

### Trips & planner
18. **My Trips** `/trips` — tabs Past / Ongoing / Upcoming / Drafts; grid & timeline views; filter, sort, bulk actions **[M]**
19. **Create Trip** `/trips/new` — multi-step: basics → places (search + map picker) → dates → cover → visibility **[M]**
20. **Trip Details** `/trips/[id]` — hero, route map, places, gallery, linked blogs, memories, stats **[M]**
21. **Itinerary Builder** `/trips/[id]/itinerary` — day-by-day timeline, **drag-and-drop**, activities/hotels/restaurants/notes/bookings/attachments, map alongside, per-day cost rollup **[M basic → 1.1 full]**
22. **Budget Planner** `/trips/[id]/budget` — planned vs actual, category breakdown charts, savings, multi-currency **[M basic → 1.1 full]**
23. **Packing / Checklists** `/trips/[id]/packing` — categories, templates by trip type, progress **[1.1]**
24. **Collaborators** `/trips/[id]/people` — invite by email, roles, pending invites **[1.2]**

### Memory & content
25. **Memory Vault** `/trips/[id]/vault` — **three views: Timeline · Gallery · Map**; photos, videos, audio diaries, notes, quotes, favourite locations **[M photos/notes → 1.2 video/audio]**
26. **Media upload** (inside Vault) — drag-drop, per-file progress, **quota meter**, EXIF auto-place suggestions, reorder, caption/alt-text, set featured **[M]**
27. **Blog Studio** `/blogs/new`, `/blogs/[id]/edit` — Tiptap rich text + Markdown, slash commands, blocks for images/gallery/map/location-card/trip-summary/budget/tips, autosave, draft/publish, private/public, SEO fields, preview **[M]**
28. **My Blogs** `/blogs` **[M]** · 29. **Blog Reader** `/b/[slug]` — clean reading view, TOC, related trips **[M]**
30. **Wishlist** `/wishlist` — country, notes, est. budget, priority, best season; push to globe as yellow **[M]**
31. **Travel Timeline** `/timeline` — chronological by year **[M]**

### Analytics, resume, recap
32. **Analytics** `/analytics` — countries/states/cities, world %, longest & shortest trip, avg budget, total distance, favourite destination, most-visited category, per-year charts, heatmap calendar **[1.1]**
33. **Travel Resume** `/resume` + public `/u/[username]` — countries, states, cities, mountains, beaches, forests, UNESCO sites, national parks, distance, years travelling; public URL **[M]**
34. **Travel Wrapped** `/wrapped/[year]` — animated yearly recap, shareable graphics **[1.2]**
35. **Achievements** `/achievements` — badge grid, XP, level progress **[1.2]**

### Public / shared
36. **Public profile** `/u/[username]` — avatar, bio, public globe, counters, published blogs **[M]**
37. **Public trip** `/t/[slug]` — read-only trip + gallery + blog; unlisted variant via token **[M]**
38. **OG image endpoint** `/api/og/*` — auto-generated share cards showing the user's globe. Major organic-reach win **[1.1]**

### Account
39. **Profile** `/settings/profile` **[M]** · 40. **Account & security** — email, password, 2FA, sessions, delete account **[M]**
41. **Privacy** — default visibility, discoverability, **EXIF-strip toggle** **[M]**
42. **Notifications** **[1.1]** · 43. **Subscription & billing** — plan, usage meters, invoices, upgrade/downgrade/cancel **[1.2]**
44. **Data** — export JSON/CSV/PDF, import GPX / Google Photos **[1.2]**
45. **Upgrade / checkout** `/upgrade` **[1.2]** · 46. **Admin** `/admin` — users, reports, feature flags, plan config **[1.2]**

### Global UI
Command palette (⌘K) · sidebar quota meter · contextual upgrade nudges · toasts · illustrated empty states · skeleton loaders · `error.tsx` + `not-found.tsx` per route group · mobile bottom-nav below `md` · light/dark theme with system default.

---

## 6. The Globe & Maps — design detail

This is the product, so it gets its own spec.

**Data flow:** `trip_places` → trigger-refreshed `visited_regions` → one API read returns `{country_code, region_code, state, visit_count, featured_media_url, last_visit}[]`. The globe never touches `trips`.

**Rendering:**
- **3D:** `react-globe.gl`, `polygonsData` = Admin-0 topojson. `polygonCapColor` maps `state` → **green/blue/yellow/grey**, with opacity scaled by `visit_count` so 8 visits reads differently from 1. Auto-rotate until first interaction, then stop.
- **2D:** MapLibre GL with two GeoJSON fill layers (admin-0, admin-1) joined to visited data via `feature-state`. **The admin-1 layer is only mounted for entitled users** — this is the paywall, enforced at data-fetch as well as render.
- **Performance:** simplify Natural Earth to 2–5% with `mapshaper`, ship topojson from `/public/geo` with immutable cache headers. Admin-1 is large — **split per country and lazy-load only for countries the user has visited**. India's admin-1 ships eagerly (free feature). Budget: hero globe interactive **<2s** on a mid-range laptop.
- **Fallback:** no WebGL or low-power device → static SVG choropleth. Fewer polygons and no auto-rotate on mobile.

**Interaction:** hover → tooltip (region name + visit count). Click → modal (screen #15). **Deep-linkable: `/globe?region=IN-KA` opens the modal directly**, making every region individually shareable.

**Picking the hero photo,** in priority order: (1) media explicitly `is_featured` for that region → (2) cover image of the most recent trip touching it → (3) highest-resolution image whose EXIF GPS falls inside it → (4) tasteful placeholder. User can override from the modal.

**Distance travelled** is computed with PostGIS over consecutive `trip_places` ordered by `order_index`, as great-circle distance. Flag it in the UI as approximate — it's not GPS-tracked.

**Accessibility:** the globe must never be the only path to the data. Ship a parallel keyboard-navigable region list opening the same modal. Announce region names via `aria-live` on focus. Respect `prefers-reduced-motion` — no auto-rotation.

---

## 7. Security, privacy & best practices

- **RLS on every table.** Write pgTAP tests asserting user A cannot read user B's rows. This is the highest-value test suite in the project — write it first.
- **Service-role key is server-only**, used solely by webhook handlers and cron jobs. Never in client-reachable code.
- **Signed, short-lived upload URLs** with server-enforced content-type and size limits. Validate actual magic bytes after upload, not the declared MIME.
- **Strip EXIF — especially GPS — from every public derivative.** Home addresses leak through photo metadata; for a travel app this is a genuine safety issue, not a nicety. Originals keep EXIF, visible only to the owner.
- **Home-location fuzzing:** per-trip option to snap points near home to city-level precision.
- **Idempotent webhooks** keyed on `provider_event_id`; verify signatures; never accept a plan change from the client.
- **Rate limiting** on auth, upload-URL issuance, AI endpoints and public pages (Upstash Redis).
- **CSP + security headers**; typed, validated Server Actions (`next-safe-action` or equivalent).
- **Soft deletes** (`deleted_at`) on trips/media with a 30-day restore window; hard delete via cron.
- **Data export + account deletion** are legal requirements (GDPR, India DPDP Act). Phase 3, not "someday."
- **Moderation:** report button on all public content, admin queue, ability to unpublish.
- **Backups:** enable Supabase PITR before real customers. **Test a restore once** — an untested backup isn't a backup.
- **Accessibility, WCAG 2.1 AA:** contrast on map fills, focus-visible everywhere, **no colour-only meaning** (the green/blue/yellow/grey states need labels or patterns too — this matters for ~8% of men), `prefers-reduced-motion` honoured.
- **SEO:** public trip/blog/resume pages statically generated with `generateStaticParams` + ISR; full metadata; JSON-LD (`Article`, `Place`, `Person`); sitemap; RSS per public profile.
- **Observability:** Sentry for errors; PostHog funnel `signup → onboarding complete → first trip → first photo → first share → upgrade`, instrumented on day one. That funnel tells you where the product is broken.

---

## 8. Delivery phases

### Phase 0 — Foundation (~1 week)
Scaffold Next.js 15 + TS + Tailwind + shadcn/ui + Framer Motion. Supabase project, local dev via CLI, migration workflow. `brand.ts`, design tokens, light/dark theming. Auth (email + Google) with middleware-protected route groups. CI (lint/typecheck/test) → Vercel preview deploys.

### Phase 1 — MVP (~5–6 weeks)
Profiles + onboarding wizard. Trips CRUD with places (search + map picker). Photo upload with **entitlements enforced end-to-end**. Memory Vault (timeline/gallery/map, photos + notes). Blog Studio + reader. **3D globe, country-level, with the region modal.** World map + India state map. Wishlist. Travel Timeline. Dashboard. Travel Resume + public profile + public trip pages. Basic itinerary and basic budget. Landing + pricing.
**Ship it. Get 20 real users before building anything below.**

### Phase 2 — v1.1 (~4 weeks)
Province-level maps for more countries (paid gate). Full itinerary builder with drag-drop. Full budget planner + expense charts. Packing lists & templates. Analytics page. Full-text search. OG image generation. Notifications + transactional email. **AI features begin here** — Trip Planner and Packing List first, behind the entitlement caps already built in Phase 1.

### Phase 3 — v1.2 (~4–5 weeks)
Billing: entitlements → real gateway (Razorpay INR / Stripe global), checkout, webhooks, customer portal, trial and downgrade-grace logic. **Video & audio** via Mux/Cloudflare Stream (Nomad). Collaborators. Albums. Travel Wrapped. Achievements & XP. Export (JSON/PDF/Markdown/photobook). Data export & account deletion. Admin panel + moderation.

### Phase 4 — Beyond
Remaining AI (Blog Writer, Story, Captions, Trip Summary). Social layer (follow, like, comment, collaborative planning). **Mobile app** — React Native (Expo) reusing the Supabase schema and generated types; offline-first capture and photo upload queueing are the native wins, so design the sync model then, not now.

---

## 9. Files to create first (Phase 0/1 critical path)

| File | Purpose |
|---|---|
| `brand.ts` | All product naming — makes the rename trivial |
| `supabase/{client,server,proxy}.ts` | Typed Supabase clients per context |
| **`entitlements.ts`** | **Single source of truth for plan limits & quota checks.** Every create/upload path calls this |
| `geo/regions.ts` | ISO code ↔ name/flag lookup, region normalization |
| `migrations/0001_init.sql` | Tables + RLS policies + indexes |
| `migrations/0002_visited_regions.sql` | Aggregate table + refresh triggers |
| `seed/plans.sql` | Explorer/Voyager/Nomad rows with `limits` JSONB |
| `components/globe/Globe.tsx` | react-globe.gl wrapper, four-state colouring |
| `components/globe/RegionModal.tsx` | The signature interaction |
| `components/map/WorldMap.tsx` · `IndiaMap.tsx` | MapLibre 2D views |
| `app/api/uploads/sign/route.ts` | Quota-checked signed upload issuance |
| `types/database.ts` | Generated via `supabase gen types typescript` |

---

## 10. Verification

- **RLS tests (do these first):** pgTAP suite creating two users, asserting cross-user reads/writes on `trips`, `media`, `blog_posts`, `memories`, `expenses` all return zero rows or fail. Runs in CI against a freshly migrated DB.
- **Entitlement tests:** unit tests over `entitlements.ts` for each plan × resource, with boundaries (5th photo allowed, 6th rejected; 15th trip allowed, 16th rejected) and **downgrade-with-over-quota → read-only, nothing deleted**.
- **E2E (Playwright), the full funnel:** sign up → onboarding marks 3 countries → globe shows 3 green → create trip with 2 places → upload 5 photos → 6th blocked with upgrade card → write & publish a blog → set trip public → open `/t/[slug]` logged-out and confirm it renders → set back to private → confirm 404.
- **Globe correctness:** unit-test the aggregation (a trip with 3 places across 2 countries yields exactly 2 country rows with correct counts and states) + visual regression snapshot at a fixed camera position.
- **Manual pass per phase:** `npm run dev`, walk every screen at 1280px and 375px, check dark mode, keyboard-only navigation, and reduced-motion globe.
- **Performance budget:** Lighthouse ≥ 90 on landing and public pages; globe interactive < 2s; confirm via `next build --analyze` that globe/map libraries are dynamically imported and **absent from the initial bundle**.

---

## 11. Open items

1. **Final name & domain** — check availability before commissioning a logo. `brand.ts` keeps the change cheap.
2. **Payment gateway** — decide once you know whether early users are mostly Indian (Razorpay) or global (Stripe/Paddle). The billing interface is built to make this a swap, not a rewrite.
3. **Pricing validated?** ₹399/₹799 are starting points. Test against 10 target users before launch.
4. **Video provider** — Mux (better DX) vs Cloudflare Stream (cheaper). Only matters at Phase 3.
5. **Tile provider** — MapTiler free tier vs self-hosted Protomaps (cheaper at scale, more setup).
6. **AI Travel Movie** deliberately left out of all phases — multi-week project with significant per-render cost. Revisit only if users ask for it.
