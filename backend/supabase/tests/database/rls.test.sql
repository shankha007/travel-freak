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

-- Ids are fixed for the same reason the media ids are: the post share-link
-- tests name these rows without reading them.
insert into public.blog_posts (id, user_id, trip_id, title, slug, visibility, published_at)
values
  ('c1111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a1111111-0000-4000-8000-000000000001',
   'Alice draft', 'rls-alice-draft', 'private', null),
  ('c1111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a1111111-0000-4000-8000-000000000002',
   'Alice published', 'rls-alice-published', 'public', now()),
  ('c2222222-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
   'b2222222-0000-4000-8000-000000000001',
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
-- Share links
--
-- A token is a capability: it is the only thing standing between a stranger and
-- an unlisted trip, so what it refuses matters more than what it allows.
-- ---------------------------------------------------------------------------

reset role;

-- An earlier test flipped this trip back to private. Unlisted is the state a
-- share link exists for, so put it there explicitly rather than depending on
-- what the section above happened to leave behind.
update public.trips set visibility = 'unlisted'
where id = 'a1111111-0000-4000-8000-000000000002';

insert into public.share_links (id, trip_id, user_id, token)
values
  ('e1111111-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'token-for-alices-public-trip'),
  ('e1111111-0000-4000-8000-000000000002', 'a1111111-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'token-for-alices-private-trip'),
  ('e1111111-0000-4000-8000-000000000003', 'a1111111-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'token-revoked'),
  ('e1111111-0000-4000-8000-000000000004', 'a1111111-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'token-expired');

update public.share_links set revoked_at = now() where token = 'token-revoked';
update public.share_links set expires_at = now() - interval '1 day' where token = 'token-expired';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select public.resolve_share_link('token-for-alices-public-trip')),
  'a1111111-0000-4000-8000-000000000002'::uuid,
  'a live token resolves to its trip'
);

select is(
  (select public.resolve_share_link('token-revoked')),
  null::uuid,
  'a revoked token resolves to nothing'
);

select is(
  (select public.resolve_share_link('token-expired')),
  null::uuid,
  'an expired token resolves to nothing'
);

select is(
  (select public.resolve_share_link('no-such-token')),
  null::uuid,
  'and an invented token is indistinguishable from a revoked one'
);

-- The trip behind that private token is `private`, not `unlisted`. A link must
-- not be able to publish something the owner has kept back.
select is(
  (select public.resolve_share_link('token-for-alices-private-trip')),
  null::uuid,
  'a link to a private trip resolves to nothing, whatever the token says'
);

-- Resolving a token does not hand over the trip itself: the caller still has to
-- read it, and RLS still refuses.
select is_empty(
  $$ select id from public.trips where id = 'a1111111-0000-4000-8000-000000000002'
     and visibility = 'unlisted' $$,
  'and the token alone does not make the trip readable through RLS'
);

select throws_ok(
  $$ insert into public.share_links (trip_id, user_id)
     values ('b2222222-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002') $$,
  '42501',
  null,
  'anon cannot mint a share link'
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

-- Days away, counted the way the timeline and the analytics screen count them:
-- both ends, and only trips that have happened. The function used to do neither,
-- and the two errors cancelled just enough to look plausible.
reset role;

update public.trips
set start_date = date '2025-04-01', end_date = date '2025-04-05', status = 'completed'
where slug = 'rls-alice-public';

update public.trips
set start_date = date '2026-11-01', end_date = date '2026-11-10', status = 'upcoming'
where slug = 'rls-alice-private';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

-- Five, not four: 1 to 5 April is five days. And not fifteen: the ten-day
-- November trip is booked, not taken.
select is(
  (select travel_days from public.public_resume_stats('aaaaaaaa-0000-4000-8000-000000000001')),
  5,
  'days away counts both ends, and counts only travel that has happened'
);

-- The same ten days, once they have been. Proves it is the status deciding
-- rather than the date being in the future.
reset role;
update public.trips set status = 'completed' where slug = 'rls-alice-private';
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select travel_days from public.public_resume_stats('aaaaaaaa-0000-4000-8000-000000000001')),
  15,
  'and a booking that becomes a trip taken starts counting'
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

-- ---------------------------------------------------------------------------
-- Post share links
--
-- Same capability model as trips, with one extra condition: a post has to be
-- published as well as unlisted, because publishing is the act that says the
-- text is ready for someone else to read.
-- ---------------------------------------------------------------------------

reset role;

-- One unlisted-and-published post, and one that is unlisted but still a draft.
update public.blog_posts
   set visibility = 'unlisted', published_at = now()
 where id = 'c1111111-0000-4000-8000-000000000002';

update public.blog_posts
   set visibility = 'unlisted', published_at = null
 where id = 'c1111111-0000-4000-8000-000000000001';

insert into public.share_links (id, post_id, user_id, token)
values
  ('e2222222-0000-4000-8000-000000000001', 'c1111111-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'post-token-live'),
  ('e2222222-0000-4000-8000-000000000002', 'c1111111-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'post-token-draft'),
  ('e2222222-0000-4000-8000-000000000003', 'c1111111-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'post-token-revoked');

update public.share_links set revoked_at = now() where token = 'post-token-revoked';

-- The constraint is what stops one token being two capabilities.
select throws_ok(
  $$ insert into public.share_links (trip_id, post_id, user_id, token)
     values ('a1111111-0000-4000-8000-000000000002', 'c1111111-0000-4000-8000-000000000002',
             'aaaaaaaa-0000-4000-8000-000000000001', 'token-both') $$,
  '23514',
  null,
  'a share link cannot point at a trip and a post at once'
);

select throws_ok(
  $$ insert into public.share_links (user_id, token)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'token-neither') $$,
  '23514',
  null,
  'and cannot point at nothing'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select public.resolve_post_share_link('post-token-live')),
  'c1111111-0000-4000-8000-000000000002'::uuid,
  'a live post token resolves to its post'
);

select is(
  (select public.resolve_post_share_link('post-token-draft')),
  null::uuid,
  'an unpublished post resolves to nothing, even with a token'
);

select is(
  (select public.resolve_post_share_link('post-token-revoked')),
  null::uuid,
  'a revoked post token resolves to nothing'
);

select is(
  (select public.resolve_post_share_link('no-such-post-token')),
  null::uuid,
  'and an invented one is indistinguishable from a revoked one'
);

-- A trip token is not a post token. The two functions read the same table, so
-- this is worth stating: neither can be used to resolve the other's rows.
select is(
  (select public.resolve_post_share_link('token-for-alices-public-trip')),
  null::uuid,
  'a trip token does not resolve as a post token'
);

select is(
  (select public.resolve_share_link('post-token-live')),
  null::uuid,
  'and a post token does not resolve as a trip token'
);

-- Resolving does not hand over the post: RLS still refuses the read, which is
-- why the app does that part with the service role scoped to this one id.
select is_empty(
  $$ select id from public.blog_posts where id = 'c1111111-0000-4000-8000-000000000002' $$,
  'resolving a post token does not make the post readable through RLS'
);

reset role;

-- The badge question a public post page asks. Defaults to true, so it can never
-- accidentally reveal that someone is not paying.
select is(
  (select public.post_shows_branding_badge('c1111111-0000-4000-8000-000000000002')),
  true,
  'a free-plan post shows the branding badge'
);

select is(
  (select public.post_shows_branding_badge('00000000-0000-4000-8000-000000000000')),
  true,
  'and an unknown post defaults to showing it'
);

-- ---------------------------------------------------------------------------
-- The trash
--
-- A deleted trip is invisible to its own owner under RLS, which is what
-- list_deleted_trips() exists to work around — for the caller's own rows only.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.soft_delete_trip('a1111111-0000-4000-8000-000000000002')),
  true,
  'alice deletes a second trip'
);

select is(
  (select count(*) from public.list_deleted_trips())::int,
  1,
  'and it is the only thing in her trash'
);

select is(
  (select id from public.list_deleted_trips()),
  'a1111111-0000-4000-8000-000000000002'::uuid,
  'listed by id, so the restore button has something to name'
);

select is(
  (select place_count from public.list_deleted_trips()),
  1,
  'with a count of what comes back with it'
);

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select id from public.list_deleted_trips() $$,
  'bob cannot see alice''s deleted trip in his trash'
);

-- ---------------------------------------------------------------------------
-- visited_countries — bare "been there" marks
--
-- A third source for the aggregate, and the reason it exists is precedence: a
-- mark must never overwrite what a real trip knows, and must never be mistaken
-- for a plan.
-- ---------------------------------------------------------------------------

reset role;

-- Clear the decks: earlier sections left trips and wishlist rows for alice.
delete from public.wishlist_items where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
delete from public.trip_places where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
delete from public.visited_countries where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- A tapped country with no trip behind it.
insert into public.visited_countries (user_id, country_code)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'ISL');

select is(
  (select state::text from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  'visited',
  'a bare mark paints the country visited'
);

select is(
  (select visit_count from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  0,
  'and counts zero trips, because none were recorded'
);

-- A wishlist entry for the same country must not downgrade it to planned.
insert into public.wishlist_items (user_id, country_code)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'ISL');

select is(
  (select state::text from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  'visited',
  'a mark outranks a wishlist plan for the same country'
);

-- A real completed trip must outrank the mark, bringing its count with it.
reset role;
insert into public.trips (id, user_id, title, slug, status, visibility, published_at)
values ('a1111111-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001',
        'Iceland for real', 'rls-alice-iceland', 'completed', 'private', null);
insert into public.trip_places (trip_id, user_id, country_code, city_name, order_index)
values ('a1111111-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001',
        'ISL', 'Reykjavik', 0);

select is(
  (select visit_count from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  1,
  'a logged trip outranks the mark and contributes its visit count'
);

select is(
  (select city_names from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  array['Reykjavik'],
  'and the trip''s cities survive, which a mark could not have supplied'
);

-- Removing the mark leaves the trip-derived row untouched.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

delete from public.visited_countries
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL';

select is(
  (select visit_count from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  1,
  'un-marking a country the user has actually been to changes nothing'
);

-- Subdivision-level trips: the trap the conflict clause alone does not catch.
-- Alice's Iceland trip is country-level, so mark a country recorded by region
-- instead and confirm no bare row appears beside the detailed ones.
reset role;
-- The wishlist row from the assertion above would add a second, country-level
-- ISL row and muddy what this is measuring. (It is harmless in the product:
-- rollUpToCountries takes the strongest state, so visited still wins on the
-- globe.) Removed here so the count below is only about marks.
delete from public.wishlist_items
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL';

update public.trip_places set region_code = 'IS-1'
where trip_id = 'a1111111-0000-4000-8000-000000000009';

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

insert into public.visited_countries (user_id, country_code)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'ISL');

select is(
  (select count(*) from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL')::int,
  1,
  'a mark adds no row beside a country already recorded at subdivision level'
);

select is(
  (select region_code from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL'),
  'IS-1',
  'and the row that survives is the one that knows the trip'
);

delete from public.visited_countries
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and country_code = 'ISL';

-- Cross-user: bob cannot mark a country for alice, nor read hers.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.visited_countries (user_id, country_code)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'PER') $$,
  '42501',
  null,
  'bob cannot mark a country on alice''s behalf'
);

insert into public.visited_countries (user_id, country_code)
values ('bbbbbbbb-0000-4000-8000-000000000002', 'PER');

select is(
  (select count(*) from public.visited_countries)::int,
  1,
  'and sees only his own marks'
);

-- ---------------------------------------------------------------------------
-- contact_messages — screen 6
--
-- The one table in the schema that a signed-out stranger may write to, so the
-- interesting assertions are about what that write cannot become: a way to read
-- the inbox, or a way to fill it.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$ insert into public.contact_messages (name, email, topic, message)
     values ('Mallory', 'm@rls.test', 'support', 'straight at the table') $$,
  '42501',
  null,
  'anon cannot insert into contact_messages directly'
);

select lives_ok(
  $$ select public.submit_contact_message(
       'Mallory', 'M@RLS.test', 'support', 'the globe will not load for me') $$,
  'but may send one through submit_contact_message()'
);

select throws_ok(
  $$ select * from public.contact_messages $$,
  '42501',
  null,
  'and cannot read the inbox back'
);

-- Four more takes the address to the limit of five; the sixth is refused.
select public.submit_contact_message('Mallory', 'm@rls.test', 'support', 'message number two');
select public.submit_contact_message('Mallory', 'm@rls.test', 'support', 'message number three');
select public.submit_contact_message('Mallory', 'm@rls.test', 'support', 'message number four');
select public.submit_contact_message('Mallory', 'm@rls.test', 'support', 'message number five');

select throws_ok(
  $$ select public.submit_contact_message(
       'Mallory', 'm@rls.test', 'support', 'message number six') $$,
  'P0001',
  'contact rate limit reached',
  'the sixth message from one address within the hour is refused'
);

select lives_ok(
  $$ select public.submit_contact_message(
       'Someone else', 'other@rls.test', 'bug', 'a different address is unaffected') $$,
  'and the limit is per address, not global'
);

-- A signed-in sender is recorded as themselves, so a reply can find the account.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select public.submit_contact_message('Alice', 'alice@rls.test', 'billing', 'a question about plans');

reset role;

select is(
  (select user_id from public.contact_messages where email = 'alice@rls.test'),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'a message from a signed-in sender carries their user id'
);

select is(
  (select email from public.contact_messages where message = 'the globe will not load for me'),
  'm@rls.test',
  'the address is stored folded to lower case, which is what the rate limit counts on'
);

select throws_ok(
  $$ select public.submit_contact_message('Mallory', 'short@rls.test', 'support', 'too short') $$,
  '23514',
  null,
  'a message under ten characters is refused by the constraint, not silently stored'
);

select throws_ok(
  $$ select public.submit_contact_message('Mallory', 'new@rls.test', 'marketing', 'a topic nobody offered') $$,
  '23514',
  null,
  'and so is a topic that is not one of the seven'
);

-- ---------------------------------------------------------------------------
-- Purging expired trash
--
-- The window is the whole feature: one day inside it and the trip must survive,
-- one day outside and it must go, along with everything hanging off it. Both
-- functions take the cutoff as an argument, so this can ask about a trip
-- deleted forty days ago without waiting forty days.
-- ---------------------------------------------------------------------------

reset role;

insert into public.trips (id, user_id, title, slug, visibility, status, deleted_at)
values
  ('a1111111-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Long gone', 'rls-purge-old', 'private', 'completed', now() - interval '40 days'),
  ('a1111111-0000-4000-8000-0000000000e2', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Recently binned', 'rls-purge-recent', 'private', 'completed', now() - interval '3 days');

insert into public.trip_places (trip_id, user_id, country_code, city_name, order_index)
values ('a1111111-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-000000000001',
        'PER', 'Cusco', 0);

insert into public.media (id, user_id, trip_id, kind, storage_path, mime, public_path)
values ('a1111111-0000-4000-8000-0000000000e3', 'aaaaaaaa-0000-4000-8000-000000000001',
        'a1111111-0000-4000-8000-0000000000e1', 'image',
        'aaaaaaaa/expired/photo.jpg', 'image/jpeg', 'aaaaaaaa/expired/photo.webp');

insert into public.blog_posts (user_id, title, slug, deleted_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Old draft', 'rls-purge-post',
        now() - interval '40 days');

-- The caller removes the files first, while the rows that name them still
-- exist. Both paths come back, because both are real objects in two buckets.
select results_eq(
  $$ select storage_path, public_path
     from public.expired_trash_media(now() - interval '30 days') $$,
  $$ values ('aaaaaaaa/expired/photo.jpg'::text, 'aaaaaaaa/expired/photo.webp'::text) $$,
  'the purge is told which files to remove before the rows naming them go'
);

select is(
  (select count(*) from public.expired_trash_media(now() - interval '90 days'))::int,
  0,
  'and nothing is listed for trash that is still inside its window'
);

select results_eq(
  $$ select trips_purged, posts_purged from public.purge_expired_trash(now() - interval '30 days') $$,
  $$ values (1, 1) $$,
  'exactly the trip and the post past their 30 days are purged'
);

select is(
  (select count(*) from public.trips where slug = 'rls-purge-recent')::int,
  1,
  'a trip binned three days ago is left alone'
);

select is(
  (select count(*) from public.trip_places
   where trip_id = 'a1111111-0000-4000-8000-0000000000e1')::int,
  0,
  'the purged trip takes its places with it'
);

select is(
  (select count(*) from public.media
   where id = 'a1111111-0000-4000-8000-0000000000e3')::int,
  0,
  'and its media rows'
);

select is(
  (select count(*) from public.trips where slug = 'rls-alice-public')::int,
  1,
  'and a trip nobody deleted is untouched'
);

-- Cleaned up so the account-deletion block below counts what it expects to.
delete from public.trips where slug = 'rls-purge-recent';

-- ---------------------------------------------------------------------------
-- Account deletion — screen 44
--
-- `deleteAccount` removes the storage objects itself and then deletes one row
-- from auth.users, trusting `on delete cascade` for everything else. That trust
-- is the thing worth testing: a foreign key added later without the cascade
-- would leave a deleted person's trips in the database, and nothing in the
-- application would notice or ever look again.
--
-- Alice is the fixture and is deleted here, which is why this is last.
-- ---------------------------------------------------------------------------

reset role;

-- Something in every table that hangs off a user, so "it cascaded" is a claim
-- about all of them rather than about the two that happen to have rows.
insert into public.wishlist_items (user_id, country_code, title)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'PER', 'Machu Picchu');

insert into public.visited_countries (user_id, country_code)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'ISL');

select isnt(
  (select count(*) from public.trips
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'alice has rows before the account is deleted'
);

delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.profiles
   where id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'deleting the auth user takes the profile'
);

select is(
  (select count(*) from public.trips
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the trips'
);

select is(
  (select count(*) from public.trip_places
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the places on them'
);

select is(
  (select count(*) from public.media
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the media rows'
);

select is(
  (select count(*) from public.blog_posts
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the posts'
);

select is(
  (select count(*) from public.wishlist_items
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the wishlist'
);

select is(
  (select count(*) from public.visited_countries
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the bare "been there" marks'
);

select is(
  (select count(*) from public.visited_regions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the globe aggregate built from them'
);

select is(
  (select count(*) from public.share_links
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and every share token, so no old link outlives the account'
);

select is(
  (select count(*) from public.subscriptions
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the subscription'
);

select is(
  (select count(*) from public.usage_counters
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  0,
  'and the usage counters'
);

-- The other half of the claim: one person leaving takes nothing of anyone
-- else's with them.
select isnt(
  (select count(*) from public.trips
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')::int,
  0,
  'and bob still has everything he had'
);

select is(
  (select count(*) from public.profiles
   where id = 'bbbbbbbb-0000-4000-8000-000000000002')::int,
  1,
  'including his profile'
);

-- A contact message deliberately survives its sender, detached: the column is
-- `on delete set null`, because a support thread that vanishes mid-conversation
-- helps nobody.
select is(
  (select count(*) from public.contact_messages where email = 'alice@rls.test')::int,
  1,
  'a message sent from the account outlives it, with its user id cleared'
);

select is(
  (select user_id from public.contact_messages where email = 'alice@rls.test'),
  null,
  'and no longer points at a user that does not exist'
);

select * from finish();

rollback;
