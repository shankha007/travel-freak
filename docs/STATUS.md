# TravelFreak — Delivery status

Feature-by-feature state of the build. Screen numbers refer to §5 of
[PROJECT_PLAN.md](PROJECT_PLAN.md).

Last updated: 2026-08-11

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
| Infrastructure | 8 | 1 | 0 | 4 |
| Public / marketing | 1 | 1 | 0 | 8 |
| Auth | 1 | 0 | 0 | 4 |
| Dashboard & globe | 3 | 1 | 2 | 0 |
| Trips & planner | 1 | 0 | 0 | 6 |
| Memory & content | 0 | 0 | 1 | 4 |
| Analytics & resume | 0 | 0 | 2 | 2 |
| Public sharing | 0 | 0 | 0 | 3 |
| Account | 0 | 0 | 1 | 5 |
| **Total** | **14** | **3** | **6** | **36** |

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
| — | `entitlements.ts` | 🟡 Partial | `plans.limits` seeded and read for the globe gate; no central quota module yet |
| — | Framer Motion | ⬜ Not started | Not installed |
| — | CI (GitHub Actions) | ⬜ Not started | lint/typecheck/test all pass locally |
| — | Sentry + PostHog | ⬜ Not started | Plan wants the funnel instrumented on day one |
| — | pgTAP RLS tests | ⬜ Not started | Plan calls this the highest-value suite; RLS verified manually only |

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
| 7 | Register `/register` | ⬜ Not started | Linked from login and landing — **currently 404s** |
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
| 19 | Create trip `/trips/new` | ⬜ Not started | No write path exists yet — the app is read-only |
| 20 | Trip details `/trips/[id]` | ⬜ Not started | Dashboard activity links here and **currently 404s** |
| 21 | Itinerary builder | ⬜ Not started | Tables not yet migrated |
| 22 | Budget planner | ⬜ Not started | `expenses` table not yet migrated |
| 23 | Packing / checklists | ⬜ Not started | Phase 1.1 |
| 24 | Collaborators | ⬜ Not started | Phase 1.2; `trip_collaborators` table and policies exist |

## Memory & content

| # | Feature | Status | Notes |
|---|---|---|---|
| 25 | Memory Vault | 🔵 Stub | Region modal links to `/trips/[id]/vault` |
| 26 | Media upload + quota meter | ⬜ Not started | Signed-upload route handler is the critical path |
| 27 | Blog Studio (Tiptap) | ⬜ Not started | Tiptap installed, not wired |
| 28 | My Blogs `/blogs` | 🔵 Stub | 4 posts seeded and counted on the dashboard |
| 29 | Blog reader `/b/[slug]` | ⬜ Not started | Region modal links here and **currently 404s** |
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
| `error.tsx` / `not-found.tsx` per group | ⬜ Not started | |
| Toasts | ⬜ Not started | `sonner` installed and mounted |

---

## Known gaps worth fixing next

1. **The app is read-only.** No create/edit path exists for trips, blogs or media, so a
   new user sees empty states with no way out. `/trips/new` is the single highest-value
   next screen.
2. **Three links 404**: `/register`, `/trips/[id]`, `/b/[slug]`. They are linked from
   shipped screens.
3. **No `entitlements.ts`.** The globe paywall reads `planCode` inline. Every quota rule
   should move into one module before any upload path is written — the plan is explicit
   that enforcement must be server-side and centralised.
4. **No pgTAP RLS tests.** RLS was verified by hand against the running stack (owner sees
   12 trips, anon sees 6 public, 0 private leaked). That check should be automated before
   real users exist.
5. **`rollUpToCountries` uses `max(visit_count)`** rather than counting distinct trips, so
   a country visited on four separate trips reports "1 trip" at country level. Existing
   unit tests assert the current behaviour, so changing it means changing them too.
