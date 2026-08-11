-- visited_regions.visit_trip_ids — which trips a visit count is made of.
--
-- `visit_count` was a bare integer, which is enough for one row but loses the
-- information needed to combine rows. Rolling a country's subdivisions up to
-- country level had no correct option: max() reports "1 trip" for a country
-- visited on four separate trips, and sum() double-counts a single trip that
-- crossed two subdivisions.
--
-- Carrying the ids makes the roll-up a set union, which is right in both cases.
-- `visit_count` stays as the cardinality of that array so nothing that reads it
-- has to change.

alter table public.visited_regions
  add column visit_trip_ids uuid[] not null default '{}';

-- Only difference from the original: the aggregate now also collects the ids of
-- the completed trips it counted, and visit_count is derived from them.
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

  -- Wishlist entries paint 'planned' wherever no trip already claims the region.
  insert into public.visited_regions (user_id, country_code, region_code, state, visit_count)
  select w.user_id, w.country_code, coalesce(w.region_code, ''), 'planned', 0
  from public.wishlist_items w
  where w.user_id = p_user_id
  on conflict (user_id, country_code, region_code) do nothing;
end;
$$;

-- Backfill: existing rows predate the column, so rebuild every user's aggregate
-- rather than leaving visit_trip_ids empty behind an accurate visit_count.
do $$
declare
  u uuid;
begin
  for u in select id from auth.users loop
    perform public.refresh_visited_regions(u);
  end loop;
end;
$$;
