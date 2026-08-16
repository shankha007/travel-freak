-- Dummy data for local development.
--
-- Loaded automatically by `npm run db:start` and `npm run db:reset` — see
-- [db.seed] in config.toml. Never runs against a hosted project.
--
-- Mirrors the shape of the demo fixtures in
-- frontend/src/client/features/globe/fixtures.ts, so the globe looks the same
-- once the page swaps from fixtures to real queries.
--
-- Deliberately inserts NO rows into `media`. Media rows without matching objects
-- in storage would resolve to broken image URLs; upload real files instead.
-- `plans` is seeded by 20260807000300_plans_and_storage.sql, not here.

-- ---------------------------------------------------------------------------
-- Demo account
--
-- Sign in with demo@travelfreak.app / password123
--
-- Inserting into auth.users fires on_auth_user_created, which creates the
-- profile, subscription and usage_counters rows. We update those afterwards
-- rather than inserting them.
-- ---------------------------------------------------------------------------

-- crypt()/gen_salt() hash the demo password. Supabase ships pgcrypto in the
-- `extensions` schema, but asserting it here keeps the seed self-contained.
create extension if not exists pgcrypto with schema extensions;

-- Idempotent: a re-run replaces the demo account, and every child row cascades.
delete from auth.users where email = 'demo@travelfreak.app';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'demo@travelfreak.app',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo Traveller"}'::jsonb,
  now() - interval '2 years', now(),
  '', '', '', ''
);

-- Required for email/password sign-in to resolve the account.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@travelfreak.app","email_verified":true}'::jsonb,
  'email',
  now(), now(), now()
);

update public.profiles
set
  username = 'demo',
  display_name = 'Demo Traveller',
  bio = 'Chasing mountains, monsoons and the occasional street-food detour.',
  country_code = 'IND',
  city = 'Bengaluru',
  travel_interests = array['mountains', 'food', 'photography', 'road trips'],
  is_public = true,
  onboarded_at = now() - interval '2 years'
where id = '11111111-1111-1111-1111-111111111111';

-- Put the demo account on the paid tier so region detail and albums are visible.
update public.subscriptions
set plan_code = 'voyager', status = 'active', current_period_end = now() + interval '11 months'
where user_id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------------------
-- Trips
--
-- Statuses drive the globe colours: 'ongoing' paints 'current',
-- 'completed' paints 'visited', anything else paints 'planned'.
-- ---------------------------------------------------------------------------

insert into public.trips (
  id, user_id, title, slug, summary, start_date, end_date,
  status, visibility, trip_type, traveler_count, budget_planned, currency, published_at
)
values
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Ladakh on two wheels', 'ladakh-on-two-wheels',
   'Manali to Leh over five passes, and the long quiet road to Pangong.',
   '2026-05-08', '2026-05-22', 'completed', 'public', 'friends', 3, 85000, 'INR',
   now() - interval '2 months'),

  ('a0000001-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Monsoon in Rishikesh', 'monsoon-in-rishikesh',
   'Rafting between downpours, and a week of not looking at a screen.',
   '2025-07-19', '2025-07-26', 'completed', 'public', 'solo', 1, 24000, 'INR',
   now() - interval '12 months'),

  ('a0000001-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Goa, slowly', 'goa-slowly',
   'The south beaches, no itinerary, and a rented scooter with bad brakes.',
   '2024-12-21', '2024-12-30', 'completed', 'private', 'couple', 2, 46000, 'INR', null),

  ('a0000001-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Kolkata for Durga Puja', 'kolkata-durga-puja',
   'Pandal hopping until 3am, and more mishti than is strictly advisable.',
   '2023-10-18', '2023-10-24', 'completed', 'public', 'family', 5, 38000, 'INR',
   now() - interval '20 months'),

  ('a0000001-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111',
   'Cherry blossom chase', 'cherry-blossom-chase',
   'Tokyo to Kyoto, timed badly and rescued by a late bloom in Osaka.',
   '2025-04-01', '2025-04-14', 'completed', 'public', 'couple', 2, 320000, 'INR',
   now() - interval '15 months'),

  ('a0000001-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111',
   'Annapurna base camp', 'annapurna-base-camp',
   'Eleven days up and four back down, with dal bhat at every stop.',
   '2024-03-09', '2024-03-24', 'completed', 'public', 'friends', 4, 95000, 'INR',
   now() - interval '28 months'),

  ('a0000001-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111',
   'Kathmandu long weekend', 'kathmandu-long-weekend',
   'Temples, thukpa and a very early flight home.',
   '2022-11-04', '2022-11-08', 'completed', 'private', 'solo', 1, 28000, 'INR', null),

  ('a0000001-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111',
   'Bangkok street food crawl', 'bangkok-street-food-crawl',
   'Six neighbourhoods, one very determined appetite.',
   '2023-02-11', '2023-02-18', 'completed', 'public', 'friends', 4, 72000, 'INR',
   now() - interval '30 months'),

  ('a0000001-0000-4000-8000-000000000009', '11111111-1111-1111-1111-111111111111',
   'Chiang Mai slow days', 'chiang-mai-slow-days',
   'Old city cafés, a cooking class, and the elephant sanctuary up north.',
   '2024-08-03', '2024-08-12', 'completed', 'private', 'couple', 2, 68000, 'INR', null),

  ('a0000001-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111111',
   'Dubai stopover', 'dubai-stopover',
   'Forty hours between flights, mostly spent in the old souk.',
   '2025-01-16', '2025-01-18', 'completed', 'private', 'solo', 1, 40000, 'INR', null),

  -- Ongoing: this is what paints Singapore as 'current' on the globe.
  ('a0000001-0000-4000-8000-000000000011', '11111111-1111-1111-1111-111111111111',
   'Singapore work week', 'singapore-work-week',
   'Client onsite, with hawker centres for every meal that is not catered.',
   '2026-08-08', '2026-08-15', 'ongoing', 'private', 'business', 1, 90000, 'INR', null),

  -- Planning: paints Bhutan as 'planned'.
  ('a0000001-0000-4000-8000-000000000012', '11111111-1111-1111-1111-111111111111',
   'Bhutan in autumn', 'bhutan-in-autumn',
   'Paro to Thimphu, and the hike up to Tiger''s Nest if the knees allow.',
   '2026-11-02', '2026-11-12', 'planning', 'private', 'couple', 2, 150000, 'INR', null);

-- ---------------------------------------------------------------------------
-- Trip places
--
-- The single source of truth for the globe. Each insert fires
-- trigger_refresh_visited_regions, so public.visited_regions is rebuilt from
-- these rows — it is never written directly.
--
-- `location` is the optional pin, written as EWKT because that is what the
-- geography column parses (see frontend `shared/geo/point.ts`). It is what the
-- route line, the distance total and the vault's map are drawn from. Three
-- rows deliberately have none, because the app allows a place recorded by name
-- alone and those screens have to be reachable in development:
--
--   * Kolkata — a trip with no pins at all.
--   * Thimphu — a trip pinned only in part, which is what makes a distance
--     total incomplete rather than absent.
-- ---------------------------------------------------------------------------

insert into public.trip_places (
  trip_id, user_id, country_code, region_code, city_name,
  place_kind, arrival_date, departure_date, order_index, notes, location
)
values
  -- India
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'IND', 'IN-LA', 'Leh', 'mountain', '2026-05-12', '2026-05-22', 0,
   'Acclimatised two days before heading to Khardung La.',
   'SRID=4326;POINT(77.5771 34.1526)'),
  ('a0000001-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111',
   'IND', 'IN-UT', 'Rishikesh', 'other', '2025-07-19', '2025-07-26', 0, '',
   'SRID=4326;POINT(78.2676 30.0869)'),
  ('a0000001-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111',
   'IND', 'IN-GA', 'Goa', 'beach', '2024-12-21', '2024-12-30', 0, '',
   'SRID=4326;POINT(73.8278 15.4909)'),
  -- No pin: a place recorded by name alone, which the wizard allows.
  ('a0000001-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111',
   'IND', 'IN-WB', 'Kolkata', 'city', '2023-10-18', '2023-10-24', 0, '', null),

  -- Japan
  ('a0000001-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111',
   'JPN', 'JP-13', 'Tokyo', 'city', '2025-04-01', '2025-04-06', 0, '',
   'SRID=4326;POINT(139.6917 35.6895)'),
  ('a0000001-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111',
   'JPN', 'JP-26', 'Kyoto', 'city', '2025-04-06', '2025-04-11', 1, '',
   'SRID=4326;POINT(135.7681 35.0116)'),
  ('a0000001-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111',
   'JPN', 'JP-27', 'Osaka', 'city', '2025-04-11', '2025-04-14', 2,
   'The late bloom that saved the trip.',
   'SRID=4326;POINT(135.5023 34.6937)'),

  -- Nepal
  ('a0000001-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111',
   'NPL', 'NP-P4', 'Pokhara', 'mountain', '2024-03-09', '2024-03-24', 0, '',
   'SRID=4326;POINT(83.9856 28.2096)'),
  ('a0000001-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111',
   'NPL', 'NP-P3', 'Kathmandu', 'city', '2022-11-04', '2022-11-08', 0, '',
   'SRID=4326;POINT(85.3240 27.7172)'),

  -- Thailand
  ('a0000001-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111',
   'THA', 'TH-10', 'Bangkok', 'city', '2023-02-11', '2023-02-18', 0, '',
   'SRID=4326;POINT(100.5018 13.7563)'),
  ('a0000001-0000-4000-8000-000000000009', '11111111-1111-1111-1111-111111111111',
   'THA', 'TH-50', 'Chiang Mai', 'city', '2024-08-03', '2024-08-12', 0, '',
   'SRID=4326;POINT(98.9853 18.7883)'),

  -- UAE
  ('a0000001-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111111',
   'ARE', 'AE-DU', 'Dubai', 'city', '2025-01-16', '2025-01-18', 0, '',
   'SRID=4326;POINT(55.2708 25.2048)'),

  -- Singapore (ongoing -> 'current')
  ('a0000001-0000-4000-8000-000000000011', '11111111-1111-1111-1111-111111111111',
   'SGP', '', 'Singapore', 'city', '2026-08-08', '2026-08-15', 0, '',
   'SRID=4326;POINT(103.8198 1.3521)'),

  -- Bhutan (planning -> 'planned')
  ('a0000001-0000-4000-8000-000000000012', '11111111-1111-1111-1111-111111111111',
   'BTN', 'BT-11', 'Paro', 'mountain', '2026-11-02', '2026-11-07', 0, '',
   'SRID=4326;POINT(89.4133 27.4287)'),
  -- No pin, while Paro has one: half a route, which is the case the resume's
  -- distance total has to be honest about.
  ('a0000001-0000-4000-8000-000000000012', '11111111-1111-1111-1111-111111111111',
   'BTN', 'BT-15', 'Thimphu', 'city', '2026-11-07', '2026-11-12', 1, '', null);

-- ---------------------------------------------------------------------------
-- Memories — what the globe's region modal shows under a country
-- ---------------------------------------------------------------------------

insert into public.memories (user_id, trip_id, kind, body, happened_at, order_index)
values
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000001',
   'note', 'Khardung La at 5,359m. Colder than the forecast promised, and worth every minute.',
   '2026-05-14 09:20+05:30', 0),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000001',
   'favorite_location', 'Pangong Tso at first light, before the day-trippers arrive.',
   '2026-05-18 06:05+05:30', 1),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000002',
   'quote', '"The river does not hurry, yet it arrives." Painted on a wall near Laxman Jhula.',
   '2025-07-22 17:40+05:30', 0),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000005',
   'note', 'Missed peak bloom in Tokyo by four days. Osaka was still holding on.',
   '2025-04-12 11:15+09:00', 0),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000006',
   'note', 'Base camp at 4,130m in light snow. Ten of us in the dining hall, nobody talking.',
   '2024-03-19 16:50+05:45', 0),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000008',
   'note', 'Boat noodles at Victory Monument — four bowls each, and still the cheapest meal of the trip.',
   '2023-02-13 13:30+07:00', 0),
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000011',
   'note', 'Tiong Bahru market before the 9am standup. Kaya toast is now the routine.',
   '2026-08-10 07:45+08:00', 0);

-- ---------------------------------------------------------------------------
-- Blog posts
-- ---------------------------------------------------------------------------

insert into public.blog_posts (
  user_id, trip_id, title, slug, content_html, excerpt,
  reading_minutes, visibility, published_at
)
values
  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000001',
   'Five passes, one very tired clutch hand', 'five-passes-one-tired-clutch-hand',
   '<p>Manali to Leh is not a hard ride so much as a long one. The altitude does the work the gradient does not.</p><p>We budgeted two days to acclimatise in Leh and used both of them properly, which is the only reason the rest of the trip happened.</p>',
   'Manali to Leh over five passes, what we got right, and the one thing we would change.',
   7, 'public', now() - interval '2 months'),

  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000005',
   'How to miss the cherry blossom and still have a good time', 'how-to-miss-the-cherry-blossom',
   '<p>Sakura forecasts are a genre of fiction. We arrived in Tokyo four days after peak and spent a week chasing the bloom south.</p><p>Osaka, improbably, delivered.</p>',
   'Chasing a bloom that had already moved on, and why the chase was the better trip.',
   5, 'public', now() - interval '15 months'),

  ('11111111-1111-1111-1111-111111111111', 'a0000001-0000-4000-8000-000000000006',
   'Dal bhat power, twenty-four hour', 'dal-bhat-power-twenty-four-hour',
   '<p>Eleven days up. Four back down. One meal, repeated, that somehow never got old.</p>',
   'What eleven days on the Annapurna trail teaches you about pacing.',
   9, 'public', now() - interval '28 months'),

  ('11111111-1111-1111-1111-111111111111', null,
   'Packing list, sixth revision', 'packing-list-sixth-revision',
   '<p>Still a draft. Still too heavy.</p>',
   'The list I keep rewriting and never actually follow.',
   3, 'private', null);

-- ---------------------------------------------------------------------------
-- Wishlist
--
-- Paints 'planned' on the globe wherever no trip already claims the region,
-- via the same refresh trigger.
-- ---------------------------------------------------------------------------

insert into public.wishlist_items (
  user_id, country_code, region_code, title, notes, est_budget, currency, priority, best_season
)
values
  ('11111111-1111-1111-1111-111111111111', 'ISL', null, 'Iceland ring road',
   'Two weeks, camper van, ideally with a northern lights window.', 450000, 'INR', 1, 'Sep-Mar'),
  ('11111111-1111-1111-1111-111111111111', 'GEO', null, 'Georgia and Svaneti',
   'Tbilisi for a few days, then the mountains.', 180000, 'INR', 2, 'Jun-Sep'),
  ('11111111-1111-1111-1111-111111111111', 'VNM', null, 'Vietnam north to south',
   'Trains the whole way if the timings work.', 160000, 'INR', 3, 'Oct-Apr');

-- ---------------------------------------------------------------------------
-- The planner — screens 21, 22 and 23
--
-- Two trips carry planner rows, chosen so both halves of each screen are
-- reachable in a fresh checkout:
--
--   Bhutan in autumn (planning, Nov 2026) gets the itinerary and the packing.
--     A trip being planned is where a plan and a packing list belong, and its
--     dates run past the range the "lay out the days" button covers in part, so
--     the missing-days path is visible too.
--   Ladakh on two wheels (completed, ₹85,000 planned) gets the expenses, one of
--     them in USD — so the multi-currency case, which is the one the arithmetic
--     refuses to collapse, is on screen rather than only in a unit test.
--
-- Deliberately partial: Bhutan's later days are left empty and its list is only
-- half ticked, because a screen that is complete on first sight never shows its
-- empty states.
-- ---------------------------------------------------------------------------

insert into public.itinerary_days (id, trip_id, user_id, day_date, title, notes, order_index)
values
  ('1a000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', '2026-11-02', 'Land at Paro',
   'The approach is the famous bit. Left window if the seat map allows.', 0),
  ('1a000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', '2026-11-03', 'Paro to Thimphu', '', 1),
  ('1a000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', '2026-11-04', 'Thimphu, slowly', '', 2),
  -- Undated, and last: the idea nobody has placed yet.
  ('1a000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', null, 'Tiger''s Nest, whenever the knees agree',
   'Six hours up and back. Start before seven.', 3);

insert into public.itinerary_items (
  day_id, trip_id, user_id, kind, title, notes,
  time_start, time_end, cost, currency, booking_ref, status, order_index
)
values
  ('1a000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'transport', 'Flight to Paro', '',
   '09:20', '11:45', 42000, 'INR', 'KB-204-PBH', 'booked', 0),
  ('1a000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'hotel', 'Guesthouse near the bridge',
   'Three nights, breakfast included.', '14:00', null, 18000, 'INR', 'GH-8891', 'booked', 1),
  ('1a000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'transport', 'Road to Thimphu', 'Two hours, hired car.',
   '10:00', '12:00', 3500, 'INR', '', 'planned', 0),
  ('1a000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'restaurant', 'Ema datshi, properly',
   'Ask for it hot and regret it.', '13:30', null, null, 'INR', '', 'planned', 1),
  ('1a000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'activity', 'Buddha Dordenma at sunset', '',
   '16:30', '18:00', null, 'INR', '', 'planned', 0),
  ('1a000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'activity', 'Taktsang monastery hike', '',
   null, null, 2000, 'INR', '', 'planned', 0);

insert into public.expenses (
  trip_id, user_id, category, title, amount, currency, spent_at, paid_by, notes
)
values
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'flights', 'Delhi to Manali, coach', 4200, 'INR', '2026-05-07', 'me', ''),
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'hotels', 'Guesthouses, fourteen nights', 31500, 'INR', '2026-05-22', 'split three ways', ''),
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'activities', 'Bike hire and fuel', 26800, 'INR', '2026-05-22', 'me', 'Two punctures included.'),
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'food', 'Everything eaten on the road', 14300, 'INR', '2026-05-22', 'split three ways', ''),
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'shopping', 'Inner line permits and a new jacket', 6100, 'INR', '2026-05-10', 'me', ''),
  -- The one in another currency. It gets its own total and no comparison
  -- against the plan, because there is no exchange rate in this codebase.
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111',
   'misc', 'Spare GoPro battery, bought online', 39, 'USD', '2026-05-05', 'me', '');

insert into public.checklists (id, trip_id, user_id, kind, title, order_index)
values
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'packing', 'The bag', 0),
  ('1c000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'todo', 'Before we leave', 1);

insert into public.checklist_items (
  checklist_id, trip_id, user_id, label, category, quantity, is_done, order_index
)
values
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Passport', 'Documents', 1, true, 0),
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Bhutan permit printout', 'Documents', 1, true, 1),
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Thermal base layers', 'Layers', 2, false, 2),
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Down jacket', 'Layers', 1, false, 3),
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Walking boots, broken in', 'Extremities', 1, true, 4),
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Camera and spare batteries', 'Electronics', 1, false, 5),
  -- Uncategorised on purpose: the screen has to render a group with no heading.
  ('1c000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Altitude tablets', '', 1, false, 6),

  ('1c000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Confirm the guide', 'Bookings', 1, true, 0),
  ('1c000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Pay the daily levy', 'Bookings', 1, false, 1),
  ('1c000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000012',
   '11111111-1111-1111-1111-111111111111', 'Download offline maps', 'Phone', 1, false, 2);

-- ---------------------------------------------------------------------------
-- A second traveller, and collaboration — screen 24
--
-- Sign in with friend@travelfreak.app / password123
--
-- Collaboration cannot be demonstrated with one account, and every collaborator
-- policy in the schema was unreachable until screen 24 shipped. So the seed now
-- has two people and covers all three states a collaborator row can be in:
--
--   accepted   the friend is an editor on Ladakh, so signing in as them shows
--              somebody else's trip in their list and the planner open to them
--   pending    an invitation addressed to somebody who has not signed up at
--              all, which is the case the invite-by-email path exists for
--   declined   answered and kept, so the owner's screen has all three to draw
--
-- The friend also owns one trip and has invited the demo account to it, which
-- is what puts a live invitation on the demo user's own Trips screen.
-- ---------------------------------------------------------------------------

delete from auth.users where email = 'friend@travelfreak.app';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated',
  'authenticated',
  'friend@travelfreak.app',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Riya Sharma"}'::jsonb,
  now() - interval '1 year', now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"friend@travelfreak.app","email_verified":true}'::jsonb,
  'email',
  now(), now(), now()
);

update public.profiles
set
  username = 'riya',
  display_name = 'Riya Sharma',
  bio = 'Rides pillion, takes the better photographs.',
  country_code = 'IND',
  city = 'Pune',
  onboarded_at = now() - interval '1 year'
where id = '22222222-2222-2222-2222-222222222222';

-- The friend's own trip, so the demo account has something to be invited to.
insert into public.trips (
  id, user_id, title, slug, summary, start_date, end_date,
  status, visibility, trip_type, traveler_count, budget_planned, currency
)
values (
  'b0000002-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
  'Spiti in the shoulder season', 'spiti-shoulder-season',
  'Kaza, Key monastery, and whichever passes are still open.',
  '2027-06-05', '2027-06-18', 'planning', 'private', 'friends', 4, 70000, 'INR'
);

insert into public.trip_places (
  trip_id, user_id, country_code, region_code, city_name, place_kind, order_index
)
values (
  'b0000002-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
  'IND', 'IN-HP', 'Kaza', 'mountain', 0
);

-- Accepted: the friend edits the demo account's Ladakh trip. The row keeps the
-- address it was sent to, because accept_trip_invitation() sets `user_id` and
-- `accepted_at` and leaves `invited_email` alone — a seeded row that dropped it
-- would not look like one the app produces.
insert into public.trip_collaborators (trip_id, user_id, invited_email, role, invited_by, accepted_at)
values (
  'a0000001-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222',
  'friend@travelfreak.app', 'editor', '11111111-1111-1111-1111-111111111111',
  now() - interval '3 months'
);

-- Pending, addressed to somebody with no account: the invite-by-email case.
insert into public.trip_collaborators (trip_id, invited_email, role, invited_by)
values (
  'a0000001-0000-4000-8000-000000000001', 'arjun@example.com',
  'viewer', '11111111-1111-1111-1111-111111111111'
);

-- Declined, and kept, so the owner can see the answer.
insert into public.trip_collaborators (trip_id, invited_email, role, invited_by, declined_at)
values (
  'a0000001-0000-4000-8000-000000000001', 'nikhil@example.com',
  'viewer', '11111111-1111-1111-1111-111111111111', now() - interval '2 months'
);

-- Waiting for the demo account on its own Trips screen.
insert into public.trip_collaborators (trip_id, invited_email, role, invited_by)
values (
  'b0000002-0000-4000-8000-000000000001', 'demo@travelfreak.app',
  'editor', '22222222-2222-2222-2222-222222222222'
);

select public.refresh_visited_regions('22222222-2222-2222-2222-222222222222');

-- ---------------------------------------------------------------------------
-- Safety net
--
-- The triggers above rebuild visited_regions row by row. Running the refresh
-- once more at the end guarantees a consistent aggregate regardless of the
-- order rows happened to land in.
-- ---------------------------------------------------------------------------

select public.refresh_visited_regions('11111111-1111-1111-1111-111111111111');
