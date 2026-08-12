-- RLS isolation suite.
--
-- The plan calls this the highest-value test suite in the project: every table
-- carries user_id and Postgres policies are what stop one traveller reading
-- another's trips. A regression here is a privacy incident, not a bug.
--
-- Run with `npm run db:test` from backend/ (wraps `supabase test db`).
--
-- Two conventions used throughout:
--
--   * Acting as a user means exactly what PostgREST does — set
--     `request.jwt.claims`, then `set local role authenticated`. The policies
--     are therefore exercised through the same inputs they see in production.
--   * `reset role` comes first every time, because `authenticated` is not a
--     member of `anon` (or of `postgres`) and cannot switch to it directly.
--     Resetting returns to the session role, which is always permitted.
--
-- pgtap is created inside the test transaction rather than in a migration, so a
-- test-only extension never ships to the production database. The whole file is
-- rolled back at the end, including the extension and the two users it invents.

begin;

create extension if not exists pgtap with schema extensions;

-- no_plan() rather than plan(n): the number of assertions is not information
-- worth maintaining by hand, and getting it wrong fails the suite for a reason
-- unrelated to security.
select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- Inserted as the session role, which bypasses RLS — the setup is deliberately
-- not the thing under test. `on_auth_user_created` seeds each user's profile,
-- subscription and usage row.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@rls.test', '{"full_name":"Alice"}'::jsonb),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@rls.test',   '{"full_name":"Bob"}'::jsonb);

-- Alice: one private trip and one published public trip.
insert into public.trips (id, user_id, title, slug, visibility, status, published_at)
values
  ('a1111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Alice private', 'rls-alice-private', 'private', 'completed', null),
  ('a1111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Alice public', 'rls-alice-public', 'public', 'completed', now());

-- Bob: one private trip, so "no rows" can be told apart from "no data".
insert into public.trips (id, user_id, title, slug, visibility, status)
values
  ('b2222222-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
   'Bob private', 'rls-bob-private', 'private', 'completed');

insert into public.trip_places (trip_id, user_id, country_code, city_name, order_index)
values
  ('a1111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'IND', 'Leh', 0),
  ('a1111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'JPN', 'Kyoto', 0),
  ('b2222222-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
   'NPL', 'Pokhara', 0);

insert into public.memories (user_id, trip_id, kind, body)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000001',
   'note', 'Alice private memory'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b2222222-0000-4000-8000-000000000001',
   'note', 'Bob private memory');

-- Ids are fixed so the media tests can name bob's photo without being able to
-- read it — which is the whole point of the assertion that follows.
insert into public.media (id, user_id, trip_id, kind, storage_path, mime, bytes)
values
  ('d1111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a1111111-0000-4000-8000-000000000001', 'image', 'rls/alice/1.jpg', 'image/jpeg', 100),
  ('d2222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
   'b2222222-0000-4000-8000-000000000001', 'image', 'rls/bob/1.jpg', 'image/jpeg', 100);

insert into public.blog_posts (user_id, trip_id, title, slug, visibility, published_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000001',
   'Alice draft', 'rls-alice-draft', 'private', null),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000002',
   'Alice published', 'rls-alice-published', 'public', now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b2222222-0000-4000-8000-000000000001',
   'Bob draft', 'rls-bob-draft', 'private', null);

insert into public.wishlist_items (user_id, country_code)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ISL'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'PER');

-- ---------------------------------------------------------------------------
-- Every table has RLS on. A table added without it is the failure this catches.
-- ---------------------------------------------------------------------------

-- spatial_ref_sys is PostGIS's read-only catalogue of coordinate systems. It
-- belongs to the extension, contains no user data, and cannot have RLS enabled
-- without superuser rights, so it is the one deliberate exemption.
select is_empty(
  $$ select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
       and c.relname <> 'spatial_ref_sys' $$,
  'every table holding user data has row level security enabled'
);

-- ---------------------------------------------------------------------------
-- Alice sees her own rows
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.trips where slug like 'rls-%')::int, 2,
  'alice sees both of her own trips'
);

select is(
  (select count(*) from public.memories where body like 'Alice%')::int, 1,
  'alice sees her own memory'
);

select is(
  (select count(*) from public.media where storage_path like 'rls/alice/%')::int, 1,
  'alice sees her own media'
);

select is(
  (select count(*) from public.blog_posts where slug like 'rls-alice-%')::int, 2,
  'alice sees her own draft and published post'
);

select is(
  (select count(*) from public.wishlist_items where country_code = 'ISL')::int, 1,
  'alice sees her own wishlist item'
);

-- Scoped by user_id, not just country: `visited_regions_select_public` also
-- exposes the aggregate of anyone with a public profile, which is what makes a
-- shared globe work. Alice's own row is the claim under test here.
select is(
  (select count(*) from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'IND')::int,
  1,
  'alice sees her own visited region'
);

-- ---------------------------------------------------------------------------
-- Alice cannot see Bob's rows
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select id from public.trips where slug = 'rls-bob-private' $$,
  'alice cannot read bob''s private trip'
);

-- Scoped to bob's trip rather than to a city name: the seed's public trips
-- visit the same places, and those are readable on purpose.
select is_empty(
  $$ select id from public.trip_places
     where trip_id = 'b2222222-0000-4000-8000-000000000001' $$,
  'alice cannot read bob''s places'
);

select is_empty(
  $$ select id from public.memories where body like 'Bob%' $$,
  'alice cannot read bob''s memories'
);

select is_empty(
  $$ select id from public.media where storage_path like 'rls/bob/%' $$,
  'alice cannot read bob''s media'
);

select is_empty(
  $$ select id from public.blog_posts where slug = 'rls-bob-draft' $$,
  'alice cannot read bob''s draft'
);

select is_empty(
  $$ select id from public.wishlist_items where country_code = 'PER' $$,
  'alice cannot read bob''s wishlist'
);

select is_empty(
  $$ select country_code from public.visited_regions
     where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'alice cannot read bob''s visited regions, because his profile is private'
);

select is_empty(
  $$ select user_id from public.subscriptions
     where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'alice cannot read bob''s subscription'
);

select is_empty(
  $$ select user_id from public.usage_counters
     where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'alice cannot read bob''s usage counters'
);

-- Bob's profile is private by default; a profile marked public is readable on
-- purpose, which is what the public-profile screen depends on.
select is_empty(
  $$ select id from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'alice cannot read bob''s private profile'
);

-- ---------------------------------------------------------------------------
-- Alice cannot write Bob's rows
--
-- An update or delete that matches no row is how a policy denies a write: it
-- does not error, it silently affects nothing. Checking the row afterwards from
-- the session role is what makes the assertion meaningful.
-- ---------------------------------------------------------------------------

update public.trips set title = 'Hijacked' where id = 'b2222222-0000-4000-8000-000000000001';
delete from public.trips where id = 'b2222222-0000-4000-8000-000000000001';

reset role;
select is(
  (select title from public.trips where id = 'b2222222-0000-4000-8000-000000000001'),
  'Bob private',
  'alice''s update of bob''s trip changed nothing'
);
select isnt_empty(
  $$ select id from public.trips where id = 'b2222222-0000-4000-8000-000000000001' $$,
  'alice''s delete of bob''s trip removed nothing'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- Inserting a row owned by someone else is refused outright by the WITH CHECK
-- clause, which is the one case that does raise.
select throws_ok(
  $$ insert into public.trips (user_id, title, slug)
     values ('bbbbbbbb-0000-4000-8000-000000000002', 'Forged', 'rls-forged') $$,
  '42501',
  null,
  'alice cannot insert a trip owned by bob'
);

select throws_ok(
  $$ insert into public.wishlist_items (user_id, country_code)
     values ('bbbbbbbb-0000-4000-8000-000000000002', 'JPN') $$,
  '42501',
  null,
  'alice cannot insert a wishlist item owned by bob'
);

-- visited_regions is derived by refresh_visited_regions(); no client may write
-- it, not even for their own rows, or it becomes a second source of truth.
select throws_ok(
  $$ insert into public.visited_regions (user_id, country_code, region_code)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'FRA', '') $$,
  '42501',
  null,
  'the derived aggregate cannot be written by a client'
);

-- ---------------------------------------------------------------------------
-- Signed-out visitors
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.trips where slug like 'rls-%')::int, 1,
  'anon sees only the published public trip'
);

select is(
  (select slug from public.trips where slug like 'rls-%'),
  'rls-alice-public',
  'and it is the public one'
);

select is(
  (select count(*) from public.blog_posts where slug like 'rls-%')::int, 1,
  'anon sees only the published public post'
);

select isnt_empty(
  $$ select id from public.trip_places
     where trip_id = 'a1111111-0000-4000-8000-000000000002' $$,
  'anon can read the places of a published public trip'
);

select is_empty(
  $$ select id from public.trip_places
     where trip_id = 'a1111111-0000-4000-8000-000000000001' $$,
  'anon cannot read the places of a private trip'
);

select is_empty(
  $$ select id from public.memories where body like '%private memory' $$,
  'anon reads no memories, because none belong to a public trip here'
);

-- Billing tables are not granted to `anon` at all, so this fails at the GRANT
-- rather than at a policy — one layer earlier than everything else here.
select throws_ok(
  $$ select user_id from public.subscriptions $$,
  '42501',
  null,
  'anon cannot touch subscriptions at all'
);

select isnt_empty(
  $$ select code from public.plans where is_active $$,
  'anon can read the plan catalogue, which the pricing page needs'
);

select throws_ok(
  $$ insert into public.trips (user_id, title, slug)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'Anon forged', 'rls-anon-forged') $$,
  '42501',
  null,
  'anon cannot insert a trip'
);

-- ---------------------------------------------------------------------------
-- Unpublishing takes a trip back out of public reach immediately
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

update public.trips set visibility = 'private'
where id = 'a1111111-0000-4000-8000-000000000002';

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is_empty(
  $$ select id from public.trips where slug = 'rls-alice-public' $$,
  'a trip flipped back to private disappears from anon reads'
);

select is_empty(
  $$ select id from public.trip_places
     where trip_id = 'a1111111-0000-4000-8000-000000000002' $$,
  'and so do its places'
);

-- ---------------------------------------------------------------------------
-- Media: cross-user isolation on the storage-backed table
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- The upload path mints the media id server-side and derives the storage key
-- from the session's user id, but the row insert is still an ordinary write, so
-- the policy has to be the thing that stops a forged one.
select throws_ok(
  $$ insert into public.media (user_id, trip_id, kind, storage_path, mime, bytes)
     values ('bbbbbbbb-0000-4000-8000-000000000002',
             'b2222222-0000-4000-8000-000000000001',
             'image', 'rls/forged/1.jpg', 'image/jpeg', 10) $$,
  '42501',
  null,
  'alice cannot insert media owned by bob'
);

select throws_ok(
  $$ update public.media set deleted_at = now()
     where storage_path = 'rls/alice/1.jpg' $$,
  '42501',
  null,
  'a photo cannot be soft-deleted by a direct update, for the same reason trips cannot'
);

select is(
  (select public.soft_delete_media('d1111111-0000-4000-8000-000000000001')),
  true,
  'the owner can soft-delete a photo through soft_delete_media()'
);

select is_empty(
  $$ select id from public.media where storage_path = 'rls/alice/1.jpg' $$,
  'and it stops being readable'
);

-- Named by id rather than found by query: the function bypasses RLS, so the
-- thing under test is its own ownership check, not alice's inability to see it.
select is(
  (select public.soft_delete_media('d2222222-0000-4000-8000-000000000002')),
  false,
  'but bob''s photo is not deletable through it'
);

-- Deleting a photo has to give the storage back, or "deleted" would keep
-- costing the user their pool.
reset role;
select is(
  (select bytes from public.media where storage_path = 'rls/alice/1.jpg'),
  0::bigint,
  'a deleted photo releases its bytes'
);

-- ---------------------------------------------------------------------------
-- The public profile helpers
--
-- These are SECURITY DEFINER, so they are the one place where a visitor learns
-- something aggregated over rows they cannot read. What they must never do is
-- answer at all for a profile its owner has not made public.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

-- Both fixture profiles are private by default.
select is_empty(
  $$ select * from public.public_place_counts('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'place counts say nothing about a private profile'
);

-- Cast so pgTAP can resolve the comparison: an untyped NULL leaves is() with
-- nothing to match the integer against.
select is(
  (select trips_count from public.public_resume_stats('aaaaaaaa-0000-4000-8000-000000000001')),
  null::integer,
  'resume stats say nothing about a private profile'
);

select is(
  (select public.shows_branding_badge('aaaaaaaa-0000-4000-8000-000000000001')),
  true,
  'an unknown or private profile defaults to showing the badge, never to hiding it'
);

-- Publish alice's profile and ask again.
reset role;
update public.profiles set is_public = true
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select isnt_empty(
  $$ select * from public.public_place_counts('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'a public profile does report its place counts'
);

-- Alice has two trips, one private and one public. The counters describe her
-- whole history, the way the public globe already does — otherwise a shared
-- resume would shrink the moment someone else looked at it.
select is(
  (select trips_count from public.public_resume_stats('aaaaaaaa-0000-4000-8000-000000000001')),
  2,
  'the counters cover every trip, not only the published ones'
);

-- But nothing here hands over a private trip.
select is_empty(
  $$ select id from public.trips where slug = 'rls-alice-private' $$,
  'while the trips themselves stay hidden'
);

select is_empty(
  $$ select * from public.public_place_counts('bbbbbbbb-0000-4000-8000-000000000002') $$,
  'and bob, who is still private, is unchanged'
);

reset role;
update public.profiles set is_public = false
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Soft delete hides a trip without destroying it
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- A direct write is refused, and that is not a bug to route around: on update
-- the new row must still satisfy the SELECT policies, and a deleted trip does
-- not. Asserting it keeps anyone from "fixing" delete by loosening the policy.
select throws_ok(
  $$ update public.trips set deleted_at = now()
     where id = 'a1111111-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'deleted_at cannot be set by a direct update, even by the owner'
);

select is(
  (select public.soft_delete_trip('a1111111-0000-4000-8000-000000000001')),
  true,
  'the owner can soft-delete through soft_delete_trip()'
);

select is_empty(
  $$ select id from public.trips where slug = 'rls-alice-private' $$,
  'a soft-deleted trip is no longer readable by its owner'
);

select is(
  (select public.soft_delete_trip('b2222222-0000-4000-8000-000000000001')),
  false,
  'and cannot delete bob''s trip through it'
);

select is(
  (select public.restore_trip('a1111111-0000-4000-8000-000000000001')),
  true,
  'the owner can restore inside the 30-day window'
);

select isnt_empty(
  $$ select id from public.trips where slug = 'rls-alice-private' $$,
  'and the trip comes back intact'
);

reset role;
select is(
  (select count(*) from public.trips where id = 'b2222222-0000-4000-8000-000000000001'
   and deleted_at is null)::int,
  1,
  'bob''s trip was never touched'
);

select * from finish();

rollback;
