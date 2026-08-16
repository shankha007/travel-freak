-- Finishing the itinerary builder — screen 21: a place per entry, and an order
-- somebody can change.
--
-- `20260815000100` deliberately left `location` off `itinerary_items`, on the
-- grounds that a column nothing writes is a column nobody can trust. Something
-- writes it now — the entry dialog reuses the same `PlacePicker` the trip
-- wizard uses — so it arrives with the screen that fills it, which is what that
-- note promised.
--
-- Two halves.
--
-- **The pin.** Same shape as `trip_places`: a geography column, plus two
-- generated columns the Data API can actually return. `20260813000500` explains
-- why at length — PostgREST serialises geography as hex EWKB, which the app
-- cannot read, so `latitude` and `longitude` are derived in the one place that
-- is certain of the answer. Doing it differently here would mean two ways to
-- read a coordinate in one codebase.
--
-- **The order.** Reordering is one statement, not one per row. Dragging an
-- entry to the top of a fourteen-item day renumbers all fourteen, and doing
-- that as fourteen round trips would be slow, non-atomic, and would leave a
-- half-renumbered day behind if one failed. Both functions take the ids in
-- their new order and set `order_index` from the array position.
--
-- Both are SECURITY INVOKER — the default, and load-bearing. RLS still applies,
-- so the update touches only rows the caller may write; a forged id in the
-- array silently matches nothing rather than reordering somebody else's trip.
-- The count comes back so the application can tell a no-op from a partial write.

-- ---------------------------------------------------------------------------
-- Where an entry is
-- ---------------------------------------------------------------------------

alter table public.itinerary_items
  add column location geography(Point, 4326);

alter table public.itinerary_items
  add column latitude double precision
    generated always as (st_y(location::geometry)) stored,
  add column longitude double precision
    generated always as (st_x(location::geometry)) stored;

comment on column public.itinerary_items.latitude is
  'Derived from location. Exists because PostgREST returns geography as hex '
  'EWKB, which the app cannot read. Never written directly. See 20260813000500.';
comment on column public.itinerary_items.longitude is
  'Derived from location. See latitude.';

create index itinerary_items_location_idx on public.itinerary_items using gist (location);

-- Generated, so a write would be refused anyway; the grant should say what is true.
grant select (latitude, longitude) on public.itinerary_items to authenticated;

-- ---------------------------------------------------------------------------
-- Reordering
-- ---------------------------------------------------------------------------

/**
 * Puts `p_item_ids` in the given order on `p_day_id`.
 *
 * Doubles as the move-between-days operation: an entry dragged from Tuesday to
 * Wednesday is simply named in Wednesday's array, and `day_id` is rewritten
 * along with the position. `trip_id` is deliberately not touched — both days
 * belong to the same trip, and `itinerary_items_day_trip_fk` refuses the row
 * outright if that ever stops being true, so a cross-trip move cannot be
 * smuggled through this function.
 */
create or replace function public.reorder_itinerary_items(p_day_id uuid, p_item_ids uuid[])
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.itinerary_items i
  set day_id = p_day_id,
      order_index = o.ord - 1
  from unnest(p_item_ids) with ordinality as o(id, ord)
  where i.id = o.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.reorder_itinerary_items(uuid, uuid[]) is
  'Sets order_index from array position and moves entries onto p_day_id. '
  'SECURITY INVOKER: RLS decides which rows are actually written.';

/**
 * Puts `p_day_ids` in the given order on `p_trip_id`.
 *
 * Only meaningful for days without a date — `getItinerary()` sorts dated days
 * by their date, because a plan for the 3rd belongs before the plan for the 4th
 * whatever order the rows were made in. Undated days have nothing but this.
 */
create or replace function public.reorder_itinerary_days(p_trip_id uuid, p_day_ids uuid[])
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.itinerary_days d
  set order_index = o.ord - 1
  from unnest(p_day_ids) with ordinality as o(id, ord)
  where d.id = o.id and d.trip_id = p_trip_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.reorder_itinerary_items(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_itinerary_days(uuid, uuid[]) from public, anon;

grant execute on function public.reorder_itinerary_items(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_itinerary_days(uuid, uuid[]) to authenticated;
