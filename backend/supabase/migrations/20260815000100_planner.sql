-- The planner: itinerary, expenses, checklists — screens 21, 22 and 23.
--
-- Three features, one migration, because they share a shape and a set of
-- decisions that are only coherent read together.
--
-- **Every table carries `trip_id`, including the child tables.** `itinerary_items`
-- could reach its trip through `itinerary_days`, and `checklist_items` through
-- `checklists`. Denormalising it buys two things: an RLS policy that is one
-- predicate over a column rather than a subquery per row, and a budget rollup
-- that can sum an entire trip's item costs without a join. The risk of a
-- denormalised key is that it drifts from the parent's, so it cannot drift here:
-- the composite foreign keys below make an item whose `trip_id` disagrees with
-- its day's a row Postgres refuses to store.
--
-- **Who may read what differs per table, deliberately.**
--
--   itinerary   owner and collaborators. A public trip page shows where someone
--               went, not the plan they made to get there — and a plan carries
--               booking references and hotel names.
--   expenses    owner only. No collaborator policy at all: what a trip cost is
--               the most private thing in the schema, and "split with friends"
--               is a Phase 1.2 feature that will need its own sharing model
--               rather than an early guess at one.
--   checklists  owner and collaborators. Packing together is the point of a
--               shared list.
--
-- None of the three is readable through `can_read_trip()`, which is what a
-- published trip and a share token resolve through. Publishing a trip therefore
-- publishes nothing here, and it cannot start to by accident.
--
-- **No `location` column on itinerary items yet.** The plan (§4) lists one, and
-- the map-alongside view in the full builder will want it. A column nothing
-- writes is a column nobody can trust, so it arrives with the screen that fills
-- it.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type itinerary_kind as enum (
  'activity', 'hotel', 'restaurant', 'transport', 'booking', 'note'
);

create type itinerary_status as enum ('planned', 'booked', 'done', 'skipped');

-- The six from §4 of the plan, unchanged. 'transport' is deliberately absent
-- here while present in itinerary_kind: a train ticket is an expense under
-- `flights` — the category is "getting there" — and inventing a seventh would
-- put this list out of step with the one the plan and the pricing page name.
create type expense_category as enum (
  'flights', 'hotels', 'food', 'activities', 'shopping', 'misc'
);

create type checklist_kind as enum ('packing', 'todo');

-- ---------------------------------------------------------------------------
-- itinerary_days — screen 21
-- ---------------------------------------------------------------------------

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable, because a trip in planning has no dates yet and still deserves a
  -- day one. `order_index` is what the screen sorts by, so an undated plan is a
  -- first-class plan rather than a pile of rows in insertion order.
  day_date date,
  title text not null default '',
  notes text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger itinerary_days_set_updated_at
  before update on public.itinerary_days
  for each row execute function public.set_updated_at();

create index itinerary_days_trip_idx on public.itinerary_days (trip_id, order_index);

-- One row per calendar day per trip. Partial, so any number of undated days may
-- coexist while a dated one cannot be created twice by a double-submit.
create unique index itinerary_days_unique_date
  on public.itinerary_days (trip_id, day_date) where day_date is not null;

-- The target of the composite foreign key on itinerary_items. Redundant with the
-- primary key on its own, and the thing that makes a child's trip_id provably
-- its parent's.
create unique index itinerary_days_id_trip on public.itinerary_days (id, trip_id);

-- ---------------------------------------------------------------------------
-- itinerary_items
-- ---------------------------------------------------------------------------

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind itinerary_kind not null default 'activity',
  title text not null check (length(trim(title)) > 0),
  notes text not null default '',
  -- `time` not `timestamptz`: a plan says "the museum at 10", and which
  -- ten depends on where you are standing. Storing an instant would require a
  -- timezone the trip does not record and would shift the plan when read from
  -- home. Both ends are optional — most of an itinerary is an order, not a
  -- schedule.
  time_start time,
  time_end time,
  cost numeric(12, 2) check (cost is null or cost >= 0),
  currency char(3) not null default 'INR',
  booking_ref text not null default '',
  url text not null default '',
  status itinerary_status not null default 'planned',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itinerary_items_time_order
    check (time_end is null or time_start is null or time_end >= time_start),
  -- The day and the item agree about which trip they belong to, or the row does
  -- not exist. Without this, the denormalised trip_id — which the RLS policy
  -- trusts — could be set to a trip the day has nothing to do with.
  constraint itinerary_items_day_trip_fk
    foreign key (day_id, trip_id) references public.itinerary_days (id, trip_id)
    on delete cascade
);

create trigger itinerary_items_set_updated_at
  before update on public.itinerary_items
  for each row execute function public.set_updated_at();

create index itinerary_items_day_idx on public.itinerary_items (day_id, order_index);
create index itinerary_items_trip_idx on public.itinerary_items (trip_id);

-- ---------------------------------------------------------------------------
-- expenses — screen 22
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category expense_category not null default 'misc',
  title text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  spent_at date,
  paid_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create index expenses_trip_idx on public.expenses (trip_id, spent_at desc nulls last);
create index expenses_user_idx on public.expenses (user_id);

-- No `fx_rate`. The plan lists one, and analytics already refuses to add ₹40,000
-- to $400 because this codebase has no exchange rate and should not invent one.
-- A rate column that nothing sets would make the same wrong sum look supported.
comment on table public.expenses is
  'What a trip actually cost, against trips.budget_planned. Amounts are never '
  'converted between currencies — totals are grouped by currency instead.';

-- ---------------------------------------------------------------------------
-- checklists / checklist_items — screen 23
-- ---------------------------------------------------------------------------

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind checklist_kind not null default 'packing',
  title text not null check (length(trim(title)) > 0),
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger checklists_set_updated_at
  before update on public.checklists
  for each row execute function public.set_updated_at();

create index checklists_trip_idx on public.checklists (trip_id, order_index);

create unique index checklists_id_trip on public.checklists (id, trip_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  -- Free text rather than an enum: "Camera", "Meds", "Paperwork" and "Cold
  -- weather" are all categories somebody packs by, and a fixed list would be
  -- wrong for the next trip.
  category text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  is_done boolean not null default false,
  notes text not null default '',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_items_list_trip_fk
    foreign key (checklist_id, trip_id) references public.checklists (id, trip_id)
    on delete cascade
);

create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

create index checklist_items_list_idx on public.checklist_items (checklist_id, order_index);
create index checklist_items_trip_idx on public.checklist_items (trip_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.itinerary_days   enable row level security;
alter table public.itinerary_items  enable row level security;
alter table public.expenses         enable row level security;
alter table public.checklists       enable row level security;
alter table public.checklist_items  enable row level security;

-- Itinerary: the owner, and accepted collaborators. `is_trip_collaborator()`
-- rather than `can_read_trip()` — the latter is true for any published public
-- trip, which would put every plan on the internet.
create policy itinerary_days_select on public.itinerary_days
  for select using (user_id = auth.uid() or public.is_trip_collaborator(trip_id));
create policy itinerary_days_write on public.itinerary_days
  for all using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));

create policy itinerary_items_select on public.itinerary_items
  for select using (user_id = auth.uid() or public.is_trip_collaborator(trip_id));
create policy itinerary_items_write on public.itinerary_items
  for all using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));

-- Expenses: the owner, and nobody else. Not even an editor.
create policy expenses_own on public.expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy checklists_select on public.checklists
  for select using (user_id = auth.uid() or public.is_trip_collaborator(trip_id));
create policy checklists_write on public.checklists
  for all using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));

create policy checklist_items_select on public.checklist_items
  for select using (user_id = auth.uid() or public.is_trip_collaborator(trip_id));
create policy checklist_items_write on public.checklist_items
  for all using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));

-- ---------------------------------------------------------------------------
-- Data API grants
--
-- `20260811000100` explains why these are needed and why no default privilege is
-- set: without an explicit grant PostgREST answers 42501 before a policy is ever
-- consulted. `anon` gets nothing — no policy above exposes a row to a signed-out
-- visitor, and a grant that cannot be used is still a grant somebody has to read
-- and reason about later.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table
  public.itinerary_days,
  public.itinerary_items,
  public.expenses,
  public.checklists,
  public.checklist_items
to authenticated;
