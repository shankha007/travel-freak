-- public_resume_stats: answer with nothing, not with zeros.
--
-- The function's contract, stated in 20260812000400 and asserted by the pgTAP
-- suite, is that it refuses to answer for a profile its owner has not made
-- public. It did not: the visibility check sat in the WHERE clause of an
-- ungrouped aggregate, and `count(*)` over zero rows is 0, not NULL. So a private
-- profile got back a row of zeros — the shape of an answer, for a question the
-- function is supposed to decline.
--
-- Nothing leaked: zeros reveal nothing about anyone, which is why this went
-- unnoticed. What it broke is the difference between "this profile is private"
-- and "this profile is public and has no trips", which is exactly the ambiguity
-- the sibling function `public_place_counts` avoids by returning no rows at all.
--
-- The fix moves the gate outside the aggregate, so the row is withheld rather
-- than zeroed. `resume.ts` already reads this as `stats.data?.[0]` and falls back
-- to zeros, so no caller changes.
--
-- (This was only discovered once the migration was applied to a local stack —
-- 20260812000400 and 20260812000500 had never been run here, so the assertions
-- written alongside them had never executed.)

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
  select agg.*
  from (
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
  ) agg
  -- Outside the aggregate: a private profile gets no row, where before it got a
  -- row of zeros.
  where exists (
    select 1 from public.profiles pr where pr.id = p_user_id and pr.is_public = true
  );
$$;

revoke all on function public.public_resume_stats(uuid) from public;
grant execute on function public.public_resume_stats(uuid) to anon, authenticated;
