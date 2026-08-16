-- Planner isolation suite: itinerary, expenses, checklists.
--
-- Screens 21, 22 and 23 added five tables holding the most sensitive things in
-- the schema after the photographs — where somebody will be on a given evening,
-- their booking references, and what their holiday cost. Those three do not
-- share one visibility rule, and the differences are the point of this file:
--
--   itinerary   owner and accepted collaborators; never a public trip's viewers
--   expenses    owner only, with no collaborator clause at all
--   checklists  owner and accepted collaborators
--
-- The rule that keeps them honest is that **publishing a trip publishes nothing
-- here**. `can_read_trip()` is true for any published public trip, and none of
-- the policies below consults it. Half the assertions in this file exist to
-- prove that, because it is the failure that would go unnoticed: everything
-- would work, and the plans would be readable by anyone with the URL.
--
-- Conventions match `rls.test.sql` — set `request.jwt.claims`, then
-- `set local role authenticated`, with `reset role` first every time. The whole
-- file runs in one transaction and is rolled back, including the two users it
-- invents.

begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- Inserted as the session role, which bypasses RLS: the setup is deliberately
-- not the thing under test.
--
-- Alice has a private trip and a *published public* one, and puts a plan, an
-- expense and a checklist on both. Carol is a stranger. Dan is an accepted
-- collaborator on Alice's private trip, which is what separates the itinerary
-- and checklist policies from the expenses one.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-00000000000a', 'alice@planner.test', '{"full_name":"Alice"}'::jsonb),
  ('c0000000-0000-4000-8000-00000000000c', 'carol@planner.test', '{"full_name":"Carol"}'::jsonb),
  ('d0000000-0000-4000-8000-00000000000d', 'dan@planner.test',   '{"full_name":"Dan"}'::jsonb);

insert into public.trips (id, user_id, title, slug, visibility, status, published_at, currency, budget_planned)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   'Alice private', 'planner-alice-private', 'private', 'planning', null, 'INR', 50000),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a',
   'Alice public', 'planner-alice-public', 'public', 'completed', now(), 'INR', 80000);

-- Accepted, and an editor: the strongest collaborator this schema has. If the
-- expense policy leaks to anyone, it leaks to Dan.
insert into public.trip_collaborators (trip_id, user_id, role, accepted_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-00000000000d',
   'editor', now());

insert into public.itinerary_days (id, trip_id, user_id, day_date, title, order_index)
values
  ('11000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-00000000000a', '2026-03-01', 'Arrival', 0),
  ('11000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-00000000000a', '2026-05-01', 'Public trip day one', 0);

insert into public.itinerary_items (id, day_id, trip_id, user_id, kind, title, booking_ref)
values
  ('12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   'hotel', 'Alice private stay', 'PRIVATE-REF-1'),
  ('12000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002',
   'a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a',
   'hotel', 'Alice public trip stay', 'PUBLIC-REF-1');

insert into public.expenses (id, trip_id, user_id, category, title, amount, currency)
values
  ('13000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-00000000000a', 'hotels', 'Alice private spend', 12000, 'INR'),
  ('13000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-00000000000a', 'food', 'Alice public trip spend', 900, 'INR');

insert into public.checklists (id, trip_id, user_id, kind, title, order_index)
values
  ('14000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-00000000000a', 'packing', 'Alice private list', 0),
  ('14000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-00000000000a', 'packing', 'Alice public trip list', 0);

insert into public.checklist_items (id, checklist_id, trip_id, user_id, label, is_done)
values
  ('15000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   'Alice private item', false),
  ('15000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002',
   'a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a',
   'Alice public trip item', false);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('itinerary_days', 'itinerary_items', 'expenses',
                       'checklists', 'checklist_items')),
  'every planner table has row level security enabled'
);

-- The denormalised trip_id is what the policies trust, so it has to be provably
-- the parent's. The composite foreign key is the proof.
select throws_ok(
  $$ insert into public.itinerary_items (day_id, trip_id, user_id, kind, title)
     values ('11000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-000000000002',
             'a0000000-0000-4000-8000-00000000000a', 'note', 'Mismatched trip') $$,
  '23503',
  null,
  'an itinerary item cannot claim a trip its day does not belong to'
);

select throws_ok(
  $$ insert into public.checklist_items (checklist_id, trip_id, user_id, label)
     values ('14000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-000000000002',
             'a0000000-0000-4000-8000-00000000000a', 'Mismatched trip') $$,
  '23503',
  null,
  'a checklist item cannot claim a trip its list does not belong to'
);

-- One day per calendar date per trip, so a double-submit cannot duplicate one.
select throws_ok(
  $$ insert into public.itinerary_days (trip_id, user_id, day_date)
     values ('a1000000-0000-4000-8000-000000000001',
             'a0000000-0000-4000-8000-00000000000a', '2026-03-01') $$,
  '23505',
  null,
  'the same calendar day cannot be added to one trip twice'
);

-- Undated days are exempt from that, because a trip in planning has no dates
-- and still deserves a day one, a day two and a day three.
select lives_ok(
  $$ insert into public.itinerary_days (trip_id, user_id, day_date, order_index)
     values ('a1000000-0000-4000-8000-000000000001',
             'a0000000-0000-4000-8000-00000000000a', null, 90),
            ('a1000000-0000-4000-8000-000000000001',
             'a0000000-0000-4000-8000-00000000000a', null, 91) $$,
  'any number of undated days may sit on one trip'
);

select throws_ok(
  $$ insert into public.expenses (trip_id, user_id, amount)
     values ('a1000000-0000-4000-8000-000000000001',
             'a0000000-0000-4000-8000-00000000000a', -100) $$,
  '23514',
  null,
  'an expense cannot be negative'
);

select throws_ok(
  $$ insert into public.itinerary_items (day_id, trip_id, user_id, title, time_start, time_end)
     values ('11000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-000000000001',
             'a0000000-0000-4000-8000-00000000000a', 'Backwards', '14:00', '09:00') $$,
  '23514',
  null,
  'an entry cannot end before it starts'
);

-- ---------------------------------------------------------------------------
-- Alice reads her own planner
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.itinerary_days
   where trip_id in ('a1000000-0000-4000-8000-000000000001',
                     'a1000000-0000-4000-8000-000000000002'))::int,
  4,
  'alice sees every day she planned, dated and undated'
);

select is(
  (select count(*) from public.itinerary_items where title like 'Alice%')::int, 2,
  'alice sees her own itinerary entries'
);

select is(
  (select count(*) from public.expenses where title like 'Alice%')::int, 2,
  'alice sees her own expenses'
);

select is(
  (select count(*) from public.checklists where title like 'Alice%')::int, 2,
  'alice sees her own lists'
);

select is(
  (select count(*) from public.checklist_items where label like 'Alice%')::int, 2,
  'alice sees her own list items'
);

select lives_ok(
  $$ update public.checklist_items set is_done = true
     where id = '15000000-0000-4000-8000-000000000001' $$,
  'alice can tick her own item off'
);

-- ---------------------------------------------------------------------------
-- Carol is a stranger, and Alice's second trip is PUBLISHED AND PUBLIC
--
-- This is the block that matters. Carol can read the trip itself — that is what
-- publishing means — and must still see nothing of its plan, its cost or its
-- packing.
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}',
  true
);
set local role authenticated;

select isnt_empty(
  $$ select id from public.trips where slug = 'planner-alice-public' $$,
  'carol can read the published trip itself, which is the point of publishing it'
);

select is_empty(
  $$ select id from public.itinerary_days
     where trip_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'publishing a trip does not publish its itinerary days'
);

select is_empty(
  $$ select id from public.itinerary_items
     where trip_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'nor its entries, which carry hotel names and booking references'
);

select is_empty(
  $$ select id from public.expenses
     where trip_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'nor what it cost'
);

select is_empty(
  $$ select id from public.checklists
     where trip_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'nor its checklists'
);

select is_empty(
  $$ select id from public.checklist_items
     where trip_id = 'a1000000-0000-4000-8000-000000000002' $$,
  'nor the items on them'
);

select is_empty(
  $$ select id from public.itinerary_items where booking_ref = 'PRIVATE-REF-1' $$,
  'and a stranger reads nothing at all of the private trip'
);

select is_empty(
  $$ select id from public.expenses where title = 'Alice private spend' $$,
  'including its expenses'
);

-- Naming a row is not reading it. A `using` clause hides the row rather than
-- refusing the statement, so both of these succeed and match nothing — the
-- block below, running with RLS bypassed, is what proves nothing changed.
select lives_ok(
  $$ update public.itinerary_items set title = 'Carol was here'
     where id = '12000000-0000-4000-8000-000000000001' $$,
  'carol naming an entry she cannot see is not an error, just a no-op'
);

select lives_ok(
  $$ delete from public.expenses where id = '13000000-0000-4000-8000-000000000001' $$,
  'and neither is deleting an expense she cannot see'
);

-- Forging the owner does not help: the WITH CHECK clause is on auth.uid().
select throws_ok(
  $$ insert into public.expenses (trip_id, user_id, amount)
     values ('a1000000-0000-4000-8000-000000000001',
             'a0000000-0000-4000-8000-00000000000a', 500) $$,
  '42501',
  null,
  'carol cannot file an expense in alice''s name'
);

-- ---------------------------------------------------------------------------
-- Dan collaborates on the private trip
--
-- Planning together works; the money does not follow. `expenses` has one
-- policy, `user_id = auth.uid()`, and splitting a bill is a Phase 1.2 feature
-- that will need a sharing model rather than an early guess at one.
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000000d","role":"authenticated"}',
  true
);
set local role authenticated;

select isnt_empty(
  $$ select id from public.itinerary_days
     where trip_id = 'a1000000-0000-4000-8000-000000000001' and day_date = '2026-03-01' $$,
  'an accepted collaborator reads the itinerary of the trip they were invited to'
);

select isnt_empty(
  $$ select id from public.checklists where title = 'Alice private list' $$,
  'and its checklists, because packing together is the point of a shared list'
);

select is_empty(
  $$ select id from public.expenses where title = 'Alice private spend' $$,
  'but not what it cost — expenses have no collaborator policy at all'
);

select lives_ok(
  $$ update public.expenses set amount = 1
     where id = '13000000-0000-4000-8000-000000000001' $$,
  'and an editor naming a figure they cannot read changes nothing'
);

-- An editor may plan: that is what the role is for.
select lives_ok(
  $$ insert into public.itinerary_items (day_id, trip_id, user_id, kind, title)
     values ('11000000-0000-4000-8000-000000000001',
             'a1000000-0000-4000-8000-000000000001',
             'd0000000-0000-4000-8000-00000000000d', 'activity', 'Dan adds a stop') $$,
  'an editor can add to the itinerary of a trip they collaborate on'
);

-- ---------------------------------------------------------------------------
-- Reordering — screen 21's drag and drop
--
-- `reorder_itinerary_items` is SECURITY INVOKER, which is the whole security
-- story: RLS decides which rows the update touches, so an id somebody else owns
-- in the array is silently skipped rather than reordered. Dan is still acting
-- here — an editor on Alice's private trip, which is exactly who should be
-- allowed to rearrange it.
-- ---------------------------------------------------------------------------

reset role;

insert into public.itinerary_items (id, day_id, trip_id, user_id, kind, title, order_index)
values
  ('12000000-0000-4000-8000-00000000000a', '11000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   'activity', 'First', 0),
  ('12000000-0000-4000-8000-00000000000b', '11000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
   'activity', 'Second', 1);

-- A second day on the same trip, to move an entry onto.
insert into public.itinerary_days (id, trip_id, user_id, day_date, order_index)
values ('11000000-0000-4000-8000-00000000000f', 'a1000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-00000000000a', '2026-03-02', 5);

select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  public.reorder_itinerary_items(
    '11000000-0000-4000-8000-000000000001',
    array['12000000-0000-4000-8000-00000000000b',
          '12000000-0000-4000-8000-00000000000a']::uuid[]
  ),
  2,
  'reordering renumbers every entry named, in one statement'
);

select is(
  (select order_index from public.itinerary_items
   where id = '12000000-0000-4000-8000-00000000000b'),
  0,
  'the entry moved to the front is now first'
);

-- Moving between days is the same call: the entry is simply named in the other
-- day's array, and day_id is rewritten with the position.
select is(
  public.reorder_itinerary_items(
    '11000000-0000-4000-8000-00000000000f',
    array['12000000-0000-4000-8000-00000000000a']::uuid[]
  ),
  1,
  'an entry can be moved onto another day of the same trip'
);

select is(
  (select day_id from public.itinerary_items
   where id = '12000000-0000-4000-8000-00000000000a'),
  '11000000-0000-4000-8000-00000000000f'::uuid,
  'and lands on the day it was dropped on'
);

-- trip_id is untouched by the function, and itinerary_items_day_trip_fk is what
-- guarantees the two still agree.
select is(
  (select trip_id from public.itinerary_items
   where id = '12000000-0000-4000-8000-00000000000a'),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'while its trip stays what the day says it is'
);

-- Carol names Alice's entries in a reorder of her own. SECURITY INVOKER means
-- RLS filters them out, so the call is a no-op rather than a rearrangement.
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  public.reorder_itinerary_items(
    '11000000-0000-4000-8000-000000000001',
    array['12000000-0000-4000-8000-00000000000a',
          '12000000-0000-4000-8000-00000000000b']::uuid[]
  ),
  0,
  'a stranger reordering entries they cannot see writes nothing'
);

reset role;

select is(
  (select day_id from public.itinerary_items
   where id = '12000000-0000-4000-8000-00000000000a'),
  '11000000-0000-4000-8000-00000000000f'::uuid,
  'and the entry is exactly where its owner left it'
);

-- ---------------------------------------------------------------------------
-- Nothing the two of them tried actually landed
--
-- Read with RLS bypassed, because the whole question is what the rows say now
-- rather than what Carol and Dan were allowed to see a moment ago.
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select title from public.itinerary_items
   where id = '12000000-0000-4000-8000-000000000001'),
  'Alice private stay',
  'the entry carol tried to rename still says what alice wrote'
);

select is(
  (select amount from public.expenses where id = '13000000-0000-4000-8000-000000000001'),
  12000::numeric(12, 2),
  'the expense carol tried to delete and dan tried to rewrite is untouched'
);

-- ---------------------------------------------------------------------------
-- Deleting a trip takes its planner with it
-- ---------------------------------------------------------------------------

delete from public.trips where id = 'a1000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.itinerary_days
   where trip_id = 'a1000000-0000-4000-8000-000000000001')::int,
  0,
  'deleting a trip for good takes its itinerary days'
);

select is(
  (select count(*) from public.itinerary_items
   where trip_id = 'a1000000-0000-4000-8000-000000000001')::int,
  0,
  'and every entry on them'
);

select is(
  (select count(*) from public.expenses
   where trip_id = 'a1000000-0000-4000-8000-000000000001')::int,
  0,
  'and its expenses'
);

select is(
  (select count(*) from public.checklist_items
   where trip_id = 'a1000000-0000-4000-8000-000000000001')::int,
  0,
  'and its checklist items, through two levels of cascade'
);

-- A soft delete is the opposite: `soft_delete_trip()` sets `deleted_at` and
-- destroys nothing, so a trip restored from the trash comes back with its plan.
select is(
  (select count(*) from public.itinerary_days
   where trip_id = 'a1000000-0000-4000-8000-000000000002')::int,
  1,
  'the other trip is untouched'
);

select * from finish();

rollback;
