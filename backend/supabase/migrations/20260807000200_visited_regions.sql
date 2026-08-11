-- visited_regions: the aggregate the globe and maps read.
--
-- Derived entirely from trip_places, trips and wishlist_items so there is no
-- second source of truth to drift. The globe fetches one small row set per user
-- instead of joining across every trip the user has ever taken.

create table public.visited_regions (
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code char(3) not null,
  region_code text not null default '',   -- '' means country-level only
  state region_state not null default 'visited',
  visit_count integer not null default 0,
  first_visit date,
  last_visit date,
  trip_ids uuid[] not null default '{}',
  featured_media_id uuid references public.media (id) on delete set null,
  city_names text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, country_code, region_code)
);

create index visited_regions_user_idx on public.visited_regions (user_id);

alter table public.visited_regions enable row level security;

create policy visited_regions_select_own on public.visited_regions
  for select using (user_id = auth.uid());

-- Public globes: readable when the profile itself is public. The aggregate
-- exposes only which regions were visited, never the underlying private trips.
create policy visited_regions_select_public on public.visited_regions
  for select using (
    exists (select 1 from public.profiles p where p.id = user_id and p.is_public = true)
  );

-- ---------------------------------------------------------------------------
-- Recompute
-- ---------------------------------------------------------------------------

-- Rebuilds every region row for one user. A full per-user rebuild is far
-- simpler to reason about than incremental patching, and stays cheap because a
-- user has at most a few hundred places.
create or replace function public.refresh_visited_regions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.visited_regions where user_id = p_user_id;

  insert into public.visited_regions (
    user_id, country_code, region_code, state, visit_count,
    first_visit, last_visit, trip_ids, city_names, featured_media_id
  )
  select
    agg.user_id,
    agg.country_code,
    agg.region_code,
    agg.state,
    agg.visit_count,
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
      count(distinct t.id) filter (where t.status = 'completed')::integer as visit_count,
      min(coalesce(tp.arrival_date, t.start_date)) as first_visit,
      max(coalesce(tp.departure_date, t.end_date)) as last_visit,
      array_agg(distinct t.id) as trip_ids,
      array_remove(array_agg(distinct tp.city_name), null) as city_names
    from public.trip_places tp
    join public.trips t on t.id = tp.trip_id
    where tp.user_id = p_user_id and t.deleted_at is null
    group by tp.user_id, tp.country_code, coalesce(tp.region_code, '')
  ) agg;

  -- Wishlist entries paint 'planned' wherever no trip already claims the region.
  insert into public.visited_regions (user_id, country_code, region_code, state, visit_count)
  select w.user_id, w.country_code, coalesce(w.region_code, ''), 'planned', 0
  from public.wishlist_items w
  where w.user_id = p_user_id
  on conflict (user_id, country_code, region_code) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.trigger_refresh_visited_regions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected uuid;
begin
  affected := coalesce(new.user_id, old.user_id);
  if affected is not null then
    perform public.refresh_visited_regions(affected);
  end if;
  return null;
end;
$$;

create trigger trip_places_refresh_regions
  after insert or update or delete on public.trip_places
  for each row execute function public.trigger_refresh_visited_regions();

create trigger wishlist_refresh_regions
  after insert or update or delete on public.wishlist_items
  for each row execute function public.trigger_refresh_visited_regions();

-- A trip's status or soft-delete changes region colours even when no place row
-- was touched, so watch the columns that feed the aggregate.
create trigger trips_refresh_regions
  after update of status, deleted_at, start_date, end_date, cover_media_id
    or delete on public.trips
  for each row execute function public.trigger_refresh_visited_regions();

-- ---------------------------------------------------------------------------
-- Denormalized media counters on trips
--
-- Keeps per-trip quota checks to a single row read instead of an aggregate.
-- ---------------------------------------------------------------------------

create or replace function public.sync_trip_media_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  target := coalesce(new.trip_id, old.trip_id);
  if target is null then
    return null;
  end if;

  update public.trips t
  set
    photo_count = counts.photos,
    video_count = counts.videos,
    audio_count = counts.audios,
    media_bytes = counts.bytes
  from (
    select
      count(*) filter (where kind = 'image')::integer as photos,
      count(*) filter (where kind = 'video')::integer as videos,
      count(*) filter (where kind = 'audio')::integer as audios,
      coalesce(sum(bytes), 0)::bigint as bytes
    from public.media
    where trip_id = target and deleted_at is null
  ) counts
  where t.id = target;

  return null;
end;
$$;

create trigger media_sync_trip_counters
  after insert or update of bytes, kind, deleted_at, trip_id or delete on public.media
  for each row execute function public.sync_trip_media_counters();

-- Account-wide storage pool, the real backstop behind the per-trip caps.
create or replace function public.sync_usage_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  target := coalesce(new.user_id, old.user_id);
  if target is null then
    return null;
  end if;

  update public.usage_counters u
  set storage_bytes = coalesce(
    (select sum(bytes) from public.media where user_id = target and deleted_at is null), 0
  )
  where u.user_id = target;

  return null;
end;
$$;

create trigger media_sync_usage
  after insert or update of bytes, deleted_at or delete on public.media
  for each row execute function public.sync_usage_counters();

create or replace function public.sync_trip_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  target := coalesce(new.user_id, old.user_id);
  if target is null then
    return null;
  end if;

  update public.usage_counters u
  set trips_count = (
    select count(*) from public.trips where user_id = target and deleted_at is null
  )
  where u.user_id = target;

  return null;
end;
$$;

create trigger trips_sync_usage
  after insert or update of deleted_at or delete on public.trips
  for each row execute function public.sync_trip_count();
