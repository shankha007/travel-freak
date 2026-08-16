-- Joining what a trip was planned to cost to what it actually cost.
--
-- The two halves of the money story have been separate rows since the planner
-- shipped. The budget screen totals the itinerary's costs beside the expenses
-- and analytics sets plan against spend per currency, but nobody could say
-- "this hotel is that expense" — so an entry planned at ₹8,000 and an expense of
-- ₹9,240 were two unrelated facts, and per-day actual spend was not a question
-- the schema could answer at all.
--
-- One nullable column closes it. Deliberately on `expenses` rather than on
-- `itinerary_items`: an expense is the thing that really happened, an itinerary
-- entry is a guess, and the record of what happened is the one that should
-- survive the other being edited or thrown away.

alter table public.expenses
  add column itinerary_item_id uuid
    references public.itinerary_items (id) on delete set null;

comment on column public.expenses.itinerary_item_id is
  'The planned entry this expense settles, when it came from one. Null for an '
  'expense recorded on its own, which is most of them.';

-- `on delete set null`, never cascade. Deleting a plan must not delete the money
-- you spent — the entry was a guess and the expense is a fact, and dropping the
-- fact because the guess went away would quietly change what a trip cost.

-- At most one expense per planned entry. Without this, pressing the button twice
-- records the same hotel bill twice, and the day's actual spend is wrong in the
-- direction nobody checks. Partial, because null is the ordinary case and every
-- unlinked expense would otherwise collide with every other one.
create unique index expenses_itinerary_item_uniq
  on public.expenses (itinerary_item_id)
  where itinerary_item_id is not null;

-- The expense and the entry it settles belong to the same trip, or the row does
-- not exist.
--
-- A composite foreign key on (itinerary_item_id, trip_id) would have said this
-- declaratively, the way itinerary_items says it about its day. It cannot be
-- used here: `on delete set null` nulls *every* column of the key, and
-- expenses.trip_id is `not null`, so deleting a planned entry would fail on a
-- constraint rather than release the link. A trigger keeps both properties.
create or replace function public.expenses_itinerary_same_trip()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip_id uuid;
  v_user_id uuid;
begin
  if new.itinerary_item_id is null then
    return new;
  end if;

  select trip_id, user_id into v_trip_id, v_user_id
  from public.itinerary_items
  where id = new.itinerary_item_id;

  if v_trip_id is null then
    raise exception 'itinerary entry % does not exist', new.itinerary_item_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_trip_id <> new.trip_id then
    raise exception 'that itinerary entry belongs to another trip'
      using errcode = 'check_violation';
  end if;

  -- Belt and braces over RLS. The policy on `expenses` already restricts a write
  -- to `user_id = auth.uid()`, but this function reads `itinerary_items` with
  -- definer rights, so it states the owner check rather than assuming the caller
  -- could only have named a row it can see.
  if v_user_id <> new.user_id then
    raise exception 'that itinerary entry belongs to another account'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger expenses_itinerary_same_trip
  before insert or update of itinerary_item_id, trip_id on public.expenses
  for each row execute function public.expenses_itinerary_same_trip();

-- Reading the other way: "what did this entry actually cost". The unique index
-- above already serves a lookup by itinerary_item_id, so no second index.
