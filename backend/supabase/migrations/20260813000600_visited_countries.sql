-- visited_countries: "I have been here", with no trip to show for it.
--
-- The onboarding wizard's central moment is tapping the countries you have
-- already been to and watching the globe fill in. There was nowhere to record
-- that. `visited_regions` is derived from exactly two sources — `trip_places`
-- and `wishlist_items` — so the only ways to paint a country green were to log a
-- whole trip for it or to lie about wanting to go.
--
-- Neither works. Twenty countries would mean twenty trips, each one counting
-- against a plan that allows fifteen, each one a row in My Trips that records
-- nothing. And a wishlist entry paints planned, which is the opposite claim.
--
-- So this is a third source: the thinnest possible statement of "been there".
-- No dates, no places, no photos — those arrive if and when the user logs the
-- trip, and the aggregate prefers them when they do.

create table public.visited_countries (
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code char(3) not null,
  -- Always '' today: onboarding taps countries. Present in the key because
  -- `visited_regions` is keyed on (country, region), so a future "tap the states
  -- you have been to" needs no migration and no change to the union below.
  region_code text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, country_code, region_code)
);

create index visited_countries_user_idx on public.visited_countries (user_id);

comment on table public.visited_countries is
  'Countries the user says they have visited without recording a trip. Feeds '
  'visited_regions as ''visited'' wherever no trip already claims the region.';

alter table public.visited_countries enable row level security;

-- Owner only, in both directions. Nothing public reads this table: the globe
-- reads `visited_regions`, which has its own policy for public profiles, and it
-- deliberately exposes which regions were visited without the rows behind them.
create policy visited_countries_own on public.visited_countries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, delete on table public.visited_countries to authenticated;

-- ---------------------------------------------------------------------------
-- The aggregate, with three sources instead of two
-- ---------------------------------------------------------------------------

/**
 * Rebuilds every region row for one user.
 *
 * Byte-for-byte the function from 20260812000100 — including the visit_trip_ids
 * handling that made a country visited on four trips count as four — with one
 * insert added. Precedence runs richest-first: trips, then bare marks, then the
 * wishlist, each `on conflict do nothing`, so the order is the rule.
 */
create or replace function public.refresh_visited_regions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.visited_regions where user_id = p_user_id;

  insert into public.visited_regions (
    user_id, country_code, region_code, state, visit_count, visit_trip_ids,
    first_visit, last_visit, trip_ids, city_names, featured_media_id
  )
  select
    agg.user_id,
    agg.country_code,
    agg.region_code,
    agg.state,
    coalesce(array_length(agg.visit_trip_ids, 1), 0),
    agg.visit_trip_ids,
    agg.first_visit,
    agg.last_visit,
    agg.trip_ids,
    agg.city_names,
    -- Hero photo: the owner's explicit pick for a trip in this region wins;
    -- otherwise fall back to the most recent trip's cover image.
    coalesce(
      (
        select m.id from public.media m
        where m.user_id = agg.user_id
          and m.trip_id = any (agg.trip_ids)
          and m.kind = 'image'
          and m.is_featured
          and m.deleted_at is null
        order by m.created_at desc
        limit 1
      ),
      (
        select t.cover_media_id from public.trips t
        where t.id = any (agg.trip_ids) and t.cover_media_id is not null
        order by t.start_date desc nulls last
        limit 1
      )
    )
  from (
    select
      tp.user_id,
      tp.country_code,
      coalesce(tp.region_code, '') as region_code,
      -- Precedence: an in-progress trip outranks history, which outranks plans.
      (case
        when bool_or(t.status = 'ongoing') then 'current'
        when bool_or(t.status = 'completed') then 'visited'
        else 'planned'
      end)::region_state as state,
      -- array_agg(distinct) skips nulls only inside filter, so strip them.
      coalesce(
        array_remove(array_agg(distinct t.id) filter (where t.status = 'completed'), null),
        '{}'::uuid[]
      ) as visit_trip_ids,
      min(coalesce(tp.arrival_date, t.start_date)) as first_visit,
      max(coalesce(tp.departure_date, t.end_date)) as last_visit,
      array_agg(distinct t.id) as trip_ids,
      array_remove(array_agg(distinct tp.city_name), null) as city_names
    from public.trip_places tp
    join public.trips t on t.id = tp.trip_id
    where tp.user_id = p_user_id and t.deleted_at is null
    group by tp.user_id, tp.country_code, coalesce(tp.region_code, '')
  ) agg;

  -- Bare marks: visited, with nothing recorded about the visit. Sits between the
  -- two existing sources because the order *is* the precedence — a logged trip
  -- must never be downgraded to a mark, and a mark must beat a wishlist plan.
  --
  -- The `not exists` is doing more than the conflict clause could. Trips are
  -- recorded at whatever granularity they were logged at, so a country visited
  -- on a subdivision-level trip has rows for `IN-KA` and none for `IND` — and a
  -- country-level mark would not collide with them. It would simply sit
  -- alongside, a row claiming "been to India, no details" next to four rows that
  -- know the trips. A mark is strictly weaker information than a trip, so
  -- anything already known about the country wins.
  --
  -- Note this is not true of the wishlist below, which is left as it was: wanting
  -- to return somewhere you have been is a different claim, not a weaker one.
  insert into public.visited_regions (user_id, country_code, region_code, state, visit_count)
  select v.user_id, v.country_code, v.region_code, 'visited', 0
  from public.visited_countries v
  where v.user_id = p_user_id
    and not exists (
      select 1 from public.visited_regions r
      where r.user_id = v.user_id and r.country_code = v.country_code
    )
  on conflict (user_id, country_code, region_code) do nothing;

  -- Wishlist entries paint 'planned' wherever no trip already claims the region.
  insert into public.visited_regions (user_id, country_code, region_code, state, visit_count)
  select w.user_id, w.country_code, coalesce(w.region_code, ''), 'planned', 0
  from public.wishlist_items w
  where w.user_id = p_user_id
  on conflict (user_id, country_code, region_code) do nothing;
end;
$$;

-- Row-level, like the triggers on the other two sources. Onboarding inserts a
-- batch and therefore rebuilds once per country, which is fine precisely because
-- it happens on an account with no trips yet: the rebuild it repeats is nearly
-- empty. Consistency with the existing triggers is worth more here than saving
-- work that only ever occurs once per account.
create trigger visited_countries_refresh_regions
  after insert or update or delete on public.visited_countries
  for each row execute function public.trigger_refresh_visited_regions();
