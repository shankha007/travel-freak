-- What a public profile may say about someone.
--
-- Two questions a visitor's page needs answered that RLS cannot answer by
-- handing over rows.
--
-- 1. Whether to show the "Made with" badge. `subscriptions` is readable only by
--    its owner, which is right — nobody should be able to enumerate who pays.
--    So the question is answered rather than the data exposed.
--
-- 2. What the resume's counters add up to. `visited_regions` is already public
--    for a public profile, and deliberately so: it says which countries someone
--    has been to without revealing the trips behind them. But the rest of the
--    resume — trips, travel days, years, cities, mountains, beaches — would
--    come from `trip_places` and `trips`, where a visitor sees only the
--    *published* ones. That makes a shared resume shrink: countries counted
--    from the whole history, cities counted from a fraction of it.
--
--    These functions take the same stance the aggregate already does. They
--    return counts over everything, and never a row that identifies a private
--    trip. Both refuse unless the profile has been made public by its owner.

create or replace function public.shows_branding_badge(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (
      select (p.limits ->> 'branding_badge')::boolean
      from public.profiles pr
      join public.subscriptions s on s.user_id = pr.id
      join public.plans p on p.code = s.plan_code
      where pr.id = p_user_id
        and pr.is_public = true
        and s.status in ('trialing', 'active')
    ),
    -- Unknown plan, or a profile that is not public: show the badge. The safe
    -- default is the free-plan behaviour, never the paid one.
    true
  );
$$;

revoke all on function public.shows_branding_badge(uuid) from public;
grant execute on function public.shows_branding_badge(uuid) to anon, authenticated;

/**
 * Distinct places by kind, over every trip.
 *
 * "Distinct" matches countByKind() in shared/resume.ts: a place is identified by
 * the most specific thing recorded — city, else subdivision, else country — so
 * four trips to Goa are one beach. The two implementations have to agree,
 * because the owner sees the TypeScript one and a visitor sees this.
 */
create or replace function public.public_place_counts(p_user_id uuid)
returns table (place_kind text, place_count integer)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    tp.place_kind::text,
    count(distinct (
      tp.country_code || ':' ||
      lower(coalesce(nullif(btrim(tp.city_name), ''), tp.region_code, tp.country_code))
    ))::integer
  from public.trip_places tp
  join public.trips t on t.id = tp.trip_id
  where tp.user_id = p_user_id
    and t.deleted_at is null
    and exists (
      select 1 from public.profiles pr where pr.id = p_user_id and pr.is_public = true
    )
  group by tp.place_kind;
$$;

revoke all on function public.public_place_counts(uuid) from public;
grant execute on function public.public_place_counts(uuid) to anon, authenticated;

/**
 * The rest of the resume's headline numbers, over every trip.
 *
 * Years travelling counts distinct calendar years rather than the span between
 * the first and last, matching yearsTravelling() in shared/resume.ts.
 */
create or replace function public.public_resume_stats(p_user_id uuid)
returns table (
  trips_count integer,
  travel_days integer,
  years_travelling integer,
  first_trip date,
  latest_trip date
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    count(*)::integer,
    coalesce(sum(
      case
        when t.start_date is not null and t.end_date is not null
          then greatest(0, (t.end_date - t.start_date))
        else 0
      end
    ), 0)::integer,
    count(distinct extract(year from t.start_date))::integer,
    min(t.start_date),
    max(t.start_date)
  from public.trips t
  where t.user_id = p_user_id
    and t.deleted_at is null
    and exists (
      select 1 from public.profiles pr where pr.id = p_user_id and pr.is_public = true
    );
$$;

revoke all on function public.public_resume_stats(uuid) from public;
grant execute on function public.public_resume_stats(uuid) to anon, authenticated;
