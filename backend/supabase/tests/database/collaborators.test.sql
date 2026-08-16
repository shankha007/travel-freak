-- Collaborator isolation suite — screen 24.
--
-- The first assertion in this file is a regression test for a real hole, and it
-- is the reason the rest exists.
--
-- `collaborators_accept_own`, in the original schema, was
-- `for update using (user_id = auth.uid())` with a comment claiming it let an
-- invitee "accept their own invitation, but not change its role". A policy
-- cannot compare a row against its previous values, so it constrained nothing:
-- a viewer could set its own role to `editor`, and `can_edit_trip()` would then
-- return true — write access to the trip, its places, its photographs, its
-- memories and its plan. It was never exploitable only because no collaborator
-- row could be created. `20260815000200` removed that policy and routed
-- accepting, declining and leaving through security-definer functions, each of
-- which writes only the columns it names.
--
-- Everything below runs in one transaction and is rolled back.

begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- Olive owns a trip with a plan, a checklist and an expense on it. Vic is an
-- accepted viewer. Ed has been invited by email and has not answered. Mal is a
-- stranger who wants in.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
values
  ('01000000-0000-4000-8000-00000000000a', 'olive@collab.test', '{"full_name":"Olive"}'::jsonb),
  ('02000000-0000-4000-8000-00000000000b', 'vic@collab.test',   '{"full_name":"Vic"}'::jsonb),
  ('03000000-0000-4000-8000-00000000000c', 'ed@collab.test',    '{"full_name":"Ed"}'::jsonb),
  ('04000000-0000-4000-8000-00000000000d', 'mal@collab.test',   '{"full_name":"Mal"}'::jsonb);

insert into public.trips (id, user_id, title, slug, visibility, status)
values ('0a000000-0000-4000-8000-000000000001', '01000000-0000-4000-8000-00000000000a',
        'Olive''s trip', 'collab-olive-trip', 'private', 'planning');

insert into public.trip_places (trip_id, user_id, country_code, city_name, order_index)
values ('0a000000-0000-4000-8000-000000000001', '01000000-0000-4000-8000-00000000000a',
        'ISL', 'Reykjavik', 0);

insert into public.itinerary_days (id, trip_id, user_id, day_date, title, order_index)
values ('0d000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
        '01000000-0000-4000-8000-00000000000a', '2026-09-01', 'Arrive', 0);

insert into public.checklists (id, trip_id, user_id, kind, title, order_index)
values ('0c000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
        '01000000-0000-4000-8000-00000000000a', 'packing', 'The bag', 0);

insert into public.expenses (id, trip_id, user_id, category, title, amount, currency)
values ('0e000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
        '01000000-0000-4000-8000-00000000000a', 'hotels', 'Olive''s spend', 20000, 'INR');

-- Vic: accepted viewer. Ed: invited by address, unanswered.
insert into public.trip_collaborators (id, trip_id, user_id, role, accepted_at, invited_by)
values ('0f000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
        '02000000-0000-4000-8000-00000000000b', 'viewer', now(),
        '01000000-0000-4000-8000-00000000000a');

insert into public.trip_collaborators (id, trip_id, invited_email, role, invited_by)
values ('0f000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001',
        'ed@collab.test', 'editor', '01000000-0000-4000-8000-00000000000a');

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

-- The owner of a trip is trips.user_id. A collaborator row claiming otherwise
-- would be a second source of truth for the fact every policy depends on.
select throws_ok(
  $$ insert into public.trip_collaborators (trip_id, user_id, role)
     values ('0a000000-0000-4000-8000-000000000001',
             '04000000-0000-4000-8000-00000000000d', 'owner') $$,
  '23514',
  null,
  'no collaborator row may claim to be the owner'
);

-- is_trip_collaborator() matches on user_id, so an acceptance with no account
-- behind it would make the owner's screen and the policies disagree.
select throws_ok(
  $$ insert into public.trip_collaborators (trip_id, invited_email, role, accepted_at)
     values ('0a000000-0000-4000-8000-000000000001', 'ghost@collab.test', 'viewer', now()) $$,
  '23514',
  null,
  'an invitation cannot be accepted without an account behind it'
);

select throws_ok(
  $$ insert into public.trip_collaborators (trip_id, invited_email, role)
     values ('0a000000-0000-4000-8000-000000000001', 'ed@collab.test', 'viewer') $$,
  '23505',
  null,
  'the same address cannot be invited to one trip twice'
);

-- ---------------------------------------------------------------------------
-- THE REGRESSION TEST
--
-- Vic is a viewer. Vic stays a viewer.
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"02000000-0000-4000-8000-00000000000b","role":"authenticated","email":"vic@collab.test"}',
  true
);
set local role authenticated;

-- No update policy applies, so this matches nothing rather than erroring.
select lives_ok(
  $$ update public.trip_collaborators set role = 'editor'
     where user_id = '02000000-0000-4000-8000-00000000000b' $$,
  'a viewer naming its own row is not an error'
);

select is(
  (select role from public.trip_collaborators
   where id = '0f000000-0000-4000-8000-000000000001'),
  'viewer'::collaborator_role,
  'but a viewer CANNOT promote itself to editor'
);

select ok(
  not public.can_edit_trip('0a000000-0000-4000-8000-000000000001'),
  'and can_edit_trip() still refuses it write access'
);

-- The same attempt through an insert, in case the row could be replaced.
select throws_ok(
  $$ insert into public.trip_collaborators (trip_id, user_id, role, accepted_at)
     values ('0a000000-0000-4000-8000-000000000001',
             '02000000-0000-4000-8000-00000000000b', 'editor', now()) $$,
  '42501',
  null,
  'nor can a viewer insert itself a better row'
);

-- ---------------------------------------------------------------------------
-- What an accepted viewer can and cannot see
-- ---------------------------------------------------------------------------

select isnt_empty(
  $$ select id from public.trips where id = '0a000000-0000-4000-8000-000000000001' $$,
  'an accepted collaborator can read the trip'
);

select isnt_empty(
  $$ select id from public.itinerary_days
     where trip_id = '0a000000-0000-4000-8000-000000000001' $$,
  'and its itinerary'
);

select isnt_empty(
  $$ select id from public.checklists
     where trip_id = '0a000000-0000-4000-8000-000000000001' $$,
  'and its checklists'
);

select is_empty(
  $$ select id from public.expenses
     where trip_id = '0a000000-0000-4000-8000-000000000001' $$,
  'but never what the trip actually cost — expenses have no collaborator policy'
);

-- The other half of "the budget", and the reason the interface had to stop
-- saying a collaborator cannot see it. `trips.budget_planned` is a column on
-- the trip row, so RLS hands it over with the title and the dates. That is
-- deliberate — it is part of the shared plan — and the screens now say so
-- rather than claiming a privacy the schema does not provide. `/budget` itself
-- is owner-only in the application, which is what keeps the two apart.
select isnt_empty(
  $$ select budget_planned from public.trips
     where id = '0a000000-0000-4000-8000-000000000001' $$,
  'a collaborator does see the planned budget, because it rides on the trip row'
);

-- A viewer is not an editor: can_edit_trip() is what the write policies consult.
select is(
  (with attempted as (select 1 where public.can_edit_trip('0a000000-0000-4000-8000-000000000001'))
   select count(*) from attempted)::int,
  0,
  'a viewer cannot edit the trip'
);

-- Collaborators see each other, which is what makes a shared trip legible.
select is(
  (select count(*) from public.trip_collaborators
   where trip_id = '0a000000-0000-4000-8000-000000000001')::int,
  2,
  'a collaborator sees who else is on the trip'
);

-- ---------------------------------------------------------------------------
-- Seeing who you are travelling with
--
-- `profiles` returns your own row and any row marked public, and nothing else.
-- Two people sharing a trip is the case that breaks: without
-- `profiles_select_trip_mates` the owner's People screen renders an accepted
-- collaborator as "Someone", which is how this was found.
--
-- Vic's profile is private — nothing in this file made it public.
-- ---------------------------------------------------------------------------

select ok(
  not (select is_public from public.profiles
       where id = '02000000-0000-4000-8000-00000000000b'),
  'vic''s profile is private, so this is not being answered by the public policy'
);

select isnt_empty(
  $$ select username from public.profiles
     where id = '01000000-0000-4000-8000-00000000000a' $$,
  'a collaborator can see the name of the person whose trip they are on'
);

select is_empty(
  $$ select username from public.profiles
     where id = '04000000-0000-4000-8000-00000000000d' $$,
  'but not the name of somebody they share nothing with'
);

-- ---------------------------------------------------------------------------
-- Ed was invited by address and has never signed in as a collaborator
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"03000000-0000-4000-8000-00000000000c","role":"authenticated","email":"ed@collab.test"}',
  true
);
set local role authenticated;

select isnt_empty(
  $$ select id from public.trip_collaborators where invited_email = 'ed@collab.test' $$,
  'an invitation by address is visible to the address it names'
);

-- Before accepting, the trip itself is still none of Ed's business.
select is_empty(
  $$ select id from public.trips where id = '0a000000-0000-4000-8000-000000000001' $$,
  'but the trip is not readable until the invitation is accepted'
);

-- Which is exactly why list_my_invitations() exists: the title has to come
-- from somewhere, and it cannot come from a table the caller cannot read.
select is(
  (select trip_title from public.list_my_invitations()
   where trip_id = '0a000000-0000-4000-8000-000000000001'),
  'Olive''s trip',
  'list_my_invitations() names the trip a pending invitee cannot yet read'
);

select is(
  (select inviter_name from public.list_my_invitations()
   where trip_id = '0a000000-0000-4000-8000-000000000001'),
  'Olive',
  'and says who sent it'
);

select ok(
  public.accept_trip_invitation('0a000000-0000-4000-8000-000000000001'),
  'ed can accept an invitation addressed to his email'
);

select isnt_empty(
  $$ select id from public.trips where id = '0a000000-0000-4000-8000-000000000001' $$,
  'and the trip opens once he has'
);

select ok(
  public.can_edit_trip('0a000000-0000-4000-8000-000000000001'),
  'as an editor, he can change it'
);

select is_empty(
  $$ select id from public.expenses
     where trip_id = '0a000000-0000-4000-8000-000000000001' $$,
  'and still cannot see what it cost'
);

select is(
  (select count(*) from public.list_my_invitations())::int, 0,
  'an accepted invitation stops being an invitation'
);

-- Accepting twice is a no-op rather than an error, so a double-click is safe.
select ok(
  not public.accept_trip_invitation('0a000000-0000-4000-8000-000000000001'),
  'accepting again answers false rather than throwing'
);

-- ---------------------------------------------------------------------------
-- Mal was invited to nothing
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"04000000-0000-4000-8000-00000000000d","role":"authenticated","email":"mal@collab.test"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.list_my_invitations())::int, 0,
  'a stranger has no invitations'
);

select ok(
  not public.accept_trip_invitation('0a000000-0000-4000-8000-000000000001'),
  'and cannot accept one addressed to somebody else'
);

select is_empty(
  $$ select id from public.trips where id = '0a000000-0000-4000-8000-000000000001' $$,
  'so the trip stays shut to them'
);

select is_empty(
  $$ select id from public.trip_collaborators
     where trip_id = '0a000000-0000-4000-8000-000000000001' $$,
  'and they cannot even see who is on it'
);

-- The profile policy is scoped to people you actually share a trip with, so a
-- pending invitation is not a way to read the owner's private profile either.
select is_empty(
  $$ select username from public.profiles
     where id = '01000000-0000-4000-8000-00000000000a' $$,
  'a stranger cannot read the owner''s private profile'
);

-- Naming somebody else's row does not remove them.
select lives_ok(
  $$ delete from public.trip_collaborators
     where id = '0f000000-0000-4000-8000-000000000001' $$,
  'deleting a row they cannot see is a no-op'
);

-- ---------------------------------------------------------------------------
-- Declining, and leaving
-- ---------------------------------------------------------------------------

reset role;

-- A fresh invitation for Mal, to decline.
insert into public.trip_collaborators (trip_id, invited_email, role, invited_by)
values ('0a000000-0000-4000-8000-000000000001', 'mal@collab.test', 'viewer',
        '01000000-0000-4000-8000-00000000000a');

select set_config(
  'request.jwt.claims',
  '{"sub":"04000000-0000-4000-8000-00000000000d","role":"authenticated","email":"mal@collab.test"}',
  true
);
set local role authenticated;

select ok(
  public.decline_trip_invitation('0a000000-0000-4000-8000-000000000001'),
  'an invitation can be turned down'
);

select is(
  (select count(*) from public.list_my_invitations())::int, 0,
  'and stops being offered once it has been'
);

select is_empty(
  $$ select id from public.trips where id = '0a000000-0000-4000-8000-000000000001' $$,
  'declining opens nothing'
);

-- Vic leaves.
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"02000000-0000-4000-8000-00000000000b","role":"authenticated","email":"vic@collab.test"}',
  true
);
set local role authenticated;

select ok(
  public.leave_trip('0a000000-0000-4000-8000-000000000001'),
  'a collaborator can leave a trip'
);

select is_empty(
  $$ select id from public.trips where id = '0a000000-0000-4000-8000-000000000001' $$,
  'and loses it immediately'
);

select ok(
  not public.leave_trip('0a000000-0000-4000-8000-000000000001'),
  'leaving twice answers false'
);

-- ---------------------------------------------------------------------------
-- What the owner is left with, and what survives the trip
-- ---------------------------------------------------------------------------

reset role;

select is(
  (select count(*) from public.trip_collaborators
   where trip_id = '0a000000-0000-4000-8000-000000000001')::int,
  2,
  'the owner is left with ed accepted and mal declined; vic''s row is gone'
);

-- Anything a collaborator added belongs to the trip, not to them: nothing
-- above deleted a place, a day or a list.
select is(
  (select count(*) from public.itinerary_days
   where trip_id = '0a000000-0000-4000-8000-000000000001')::int,
  1,
  'nothing on the trip left with the person who left'
);

delete from public.trips where id = '0a000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.trip_collaborators
   where trip_id = '0a000000-0000-4000-8000-000000000001')::int,
  0,
  'deleting a trip for good takes its collaborator rows'
);

select * from finish();

rollback;
