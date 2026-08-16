-- Collaborators — screen 24.
--
-- `trip_collaborators` has existed since `20260807000100_init.sql`, and so have
-- the policies that consult it: `is_trip_collaborator()`, `can_edit_trip()`, and
-- a collaborator clause on trips, places, albums, media, memories and — since
-- `20260815000100` — the planner. None of it has ever run, because nothing in
-- the application can create a collaborator row. This migration is what makes
-- that machinery reachable, and it has to fix two things first.
--
-- **A collaborator could promote itself.** `collaborators_accept_own` was
-- written as `for update using (user_id = auth.uid())` with a comment saying it
-- "lets an invitee accept their own invitation, but not change its role". The
-- policy says nothing about the role, so a viewer could:
--
--   update trip_collaborators set role = 'editor' where user_id = auth.uid();
--
-- and `can_edit_trip()` would then return true — write access to the trip, its
-- places, its photographs, its memories and its plan. Verified against this
-- schema before it was changed. It has never been exploitable because no row
-- could exist to escalate, which is exactly why it has to be closed in the same
-- change that lets rows exist.
--
-- The fix is not a narrower `with check`: a policy cannot compare a row against
-- its own previous values, so "you may update this row but not that column" is
-- not expressible here. The invitee therefore gets **no direct UPDATE at all**,
-- and accepting, declining and leaving go through the three security-definer
-- functions at the bottom, each of which writes exactly the columns it names.
--
-- **An invitation by email could not be accepted.** An invite addressed to
-- someone who has not signed up yet has `user_id = null`, and every policy on
-- the table keyed off `user_id = auth.uid()` — so the invitee could not see the
-- row, let alone claim it. Confirmed the same way: zero rows visible to the
-- address the invitation named.
--
-- One further decision, recorded because the enum invites the opposite reading:
-- **no row is ever written with `role = 'owner'`.** The owner of a trip is
-- `trips.user_id` and nothing else. A row saying otherwise would be a second
-- source of truth for the one fact every policy in the schema depends on, so the
-- constraint below forbids it rather than trusting the application to.

-- ---------------------------------------------------------------------------
-- Columns and constraints
-- ---------------------------------------------------------------------------

alter table public.trip_collaborators
  add column declined_at timestamptz;

comment on column public.trip_collaborators.declined_at is
  'Set when an invitation is turned down. The row is kept rather than deleted '
  'so the same address cannot be re-invited in a loop, and so the owner can see '
  'the answer.';

-- Ownership lives on trips.user_id. See the header.
alter table public.trip_collaborators
  add constraint trip_collaborators_role_not_owner check (role <> 'owner');

-- An accepted invitation belongs to an actual account. Without this, a row
-- could claim `accepted_at` while `user_id` stayed null, and
-- `is_trip_collaborator()` — which matches on user_id — would quietly disagree
-- with what the owner's screen displays.
alter table public.trip_collaborators
  add constraint trip_collaborators_accepted_has_user
  check (accepted_at is null or user_id is not null);

-- Answered one way or the other, never both.
alter table public.trip_collaborators
  add constraint trip_collaborators_one_answer
  check (accepted_at is null or declined_at is null);

-- One invitation per address per trip. Case-insensitive because `citext` makes
-- the comparison case-insensitive but the unique index would not be otherwise.
create unique index trip_collaborators_unique_email
  on public.trip_collaborators (trip_id, invited_email) where invited_email is not null;

create index trip_collaborators_pending_idx
  on public.trip_collaborators (invited_email)
  where accepted_at is null and declined_at is null;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- The escalation hole. Nothing replaces it: acceptance is a function call now.
drop policy collaborators_accept_own on public.trip_collaborators;

drop policy collaborators_select on public.trip_collaborators;

-- Who may see a collaborator row:
--
--   * the trip's owner, who manages the list
--   * the person it names, by account or by the address it was sent to — this
--     is what makes a pending invitation visible to its recipient
--   * anyone already collaborating on the trip, so a shared trip shows who else
--     is on it rather than each person seeing only themselves
--
-- `auth.jwt() ->> 'email'` is the address on the verified access token, not
-- something the client supplies.
create policy collaborators_select on public.trip_collaborators
  for select using (
    user_id = auth.uid()
    or (invited_email is not null and invited_email = (auth.jwt() ->> 'email')::citext)
    or exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
    or public.is_trip_collaborator(trip_id)
  );

-- `collaborators_manage_owner` from init.sql is unchanged and still the only
-- way a row is written directly: the owner inserts, re-roles and removes.

-- ---------------------------------------------------------------------------
-- Accepting, declining, leaving
--
-- SECURITY DEFINER because each one writes a row the caller is deliberately not
-- allowed to update, and because matching an invitation by email means reading
-- rows whose `user_id` is still null.
--
-- Each names its columns explicitly and none of them touches `role` or
-- `trip_id`. That is the whole reason they exist rather than a policy.
-- ---------------------------------------------------------------------------

create or replace function public.accept_trip_invitation(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_email citext := (auth.jwt() ->> 'email')::citext;
  v_updated integer;
begin
  if v_user is null then
    return false;
  end if;

  -- Matched by account or by the address it was sent to. `role` is read from
  -- the row and written back untouched, so an invitation cannot be upgraded on
  -- the way in.
  update public.trip_collaborators
  set user_id = v_user,
      accepted_at = now(),
      declined_at = null
  where trip_id = p_trip_id
    and accepted_at is null
    and declined_at is null
    and (
      user_id = v_user
      or (invited_email is not null and v_email is not null and invited_email = v_email)
    );

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

comment on function public.accept_trip_invitation(uuid) is
  'Claims a pending invitation for the calling user. Never changes the role it '
  'was sent with — see 20260815000200 for why this is a function and not a policy.';

create or replace function public.decline_trip_invitation(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_email citext := (auth.jwt() ->> 'email')::citext;
  v_updated integer;
begin
  if v_user is null then
    return false;
  end if;

  update public.trip_collaborators
  set declined_at = now()
  where trip_id = p_trip_id
    and accepted_at is null
    and declined_at is null
    and (
      user_id = v_user
      or (invited_email is not null and v_email is not null and invited_email = v_email)
    );

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Leaving is a delete rather than a decline: a collaborator who walks away has
-- no standing row to explain, and keeping one would mean the owner's list shows
-- somebody who is not there. Re-inviting them is one click.
create or replace function public.leave_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer;
begin
  if v_user is null then
    return false;
  end if;

  delete from public.trip_collaborators
  where trip_id = p_trip_id and user_id = v_user;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- The invitations somebody has been sent
--
-- A pending invitee cannot read the trip: `trips_select_collaborator` goes
-- through `is_trip_collaborator()`, which requires `accepted_at`. So an
-- invitation list built from the table alone would show a row with no trip
-- title and no idea who sent it — "you have been invited to something, by
-- someone". This returns the three facts the screen needs and nothing else
-- about a trip the caller has not yet agreed to see.
-- ---------------------------------------------------------------------------

create or replace function public.list_my_invitations()
returns table (
  trip_id uuid,
  trip_title text,
  role collaborator_role,
  invited_at timestamptz,
  inviter_name text,
  inviter_username citext
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    tc.trip_id,
    t.title,
    tc.role,
    tc.created_at,
    coalesce(nullif(p.display_name, ''), p.username::text),
    p.username
  from public.trip_collaborators tc
  join public.trips t on t.id = tc.trip_id and t.deleted_at is null
  left join public.profiles p on p.id = t.user_id
  where tc.accepted_at is null
    and tc.declined_at is null
    and (
      tc.user_id = auth.uid()
      or (
        tc.invited_email is not null
        and tc.invited_email = (auth.jwt() ->> 'email')::citext
      )
    )
    and auth.uid() is not null
  order by tc.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Seeing who you are travelling with
--
-- `profiles` has exactly two select policies: your own row, and any row marked
-- `is_public`. That was right while a profile was either yours or a stranger's,
-- and it stops being right the moment two people share a trip — the owner's
-- People screen rendered an accepted collaborator as "Someone", because the
-- name is on a row RLS would not return.
--
-- Making the collaborator public is not the answer, and neither is passing the
-- name through a definer function: the profile is genuinely readable now, and
-- the honest fix is to say so in a policy.
--
-- SECURITY DEFINER, for the reason the header of `20260807000100_init.sql`
-- gives about `is_trip_collaborator()`: a policy on `profiles` that read
-- `trip_collaborators` directly would trigger that table's own policies, which
-- read `trips`, whose policies read `trip_collaborators` again. The definer
-- boundary is what stops it recursing.
--
-- Deliberately narrow. It answers only for **accepted** rows, so a pending
-- invitation does not hand out a name, and only for the three ways two people
-- can share one trip.
-- ---------------------------------------------------------------------------

create or replace function public.shares_a_trip_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select p_user_id is not null and auth.uid() is not null and (
    -- They collaborate on a trip I own.
    exists (
      select 1
      from public.trip_collaborators tc
      join public.trips t on t.id = tc.trip_id
      where tc.user_id = p_user_id
        and tc.accepted_at is not null
        and t.user_id = auth.uid()
        and t.deleted_at is null
    )
    -- I collaborate on a trip they own.
    or exists (
      select 1
      from public.trip_collaborators tc
      join public.trips t on t.id = tc.trip_id
      where tc.user_id = auth.uid()
        and tc.accepted_at is not null
        and t.user_id = p_user_id
        and t.deleted_at is null
    )
    -- We both collaborate on the same trip.
    or exists (
      select 1
      from public.trip_collaborators mine
      join public.trip_collaborators theirs on theirs.trip_id = mine.trip_id
      where mine.user_id = auth.uid()
        and mine.accepted_at is not null
        and theirs.user_id = p_user_id
        and theirs.accepted_at is not null
    )
  );
$$;

comment on function public.shares_a_trip_with(uuid) is
  'True when the caller and the given user are on a trip together, by ownership '
  'or by an accepted collaboration. Backs profiles_select_trip_mates.';

create policy profiles_select_trip_mates on public.profiles
  for select using (public.shares_a_trip_with(id));

-- ---------------------------------------------------------------------------
-- Grants
--
-- `20260811000100` explains why these are needed at all. The functions are
-- callable by signed-in users only; each one derives the caller from
-- `auth.uid()` and does nothing when that is null.
-- ---------------------------------------------------------------------------

revoke all on function public.accept_trip_invitation(uuid) from public, anon;
revoke all on function public.decline_trip_invitation(uuid) from public, anon;
revoke all on function public.leave_trip(uuid) from public, anon;
revoke all on function public.list_my_invitations() from public, anon;
revoke all on function public.shares_a_trip_with(uuid) from public, anon;

grant execute on function public.accept_trip_invitation(uuid) to authenticated;
grant execute on function public.decline_trip_invitation(uuid) to authenticated;
grant execute on function public.leave_trip(uuid) to authenticated;
grant execute on function public.list_my_invitations() to authenticated;
grant execute on function public.shares_a_trip_with(uuid) to authenticated;
