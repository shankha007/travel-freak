-- public_resume_stats: count days away the way the rest of the product does.
--
-- Three screens answer "how many days have you been away", and one of them
-- answered differently. The timeline and the analytics screen count both ends
-- of a trip — a Friday-to-Sunday weekend is three days, which is how people
-- count holidays — and count only trips that have actually happened. This
-- function did neither: `end_date - start_date` is two days for that weekend,
-- and it summed every trip including the ones still to come.
--
-- On the demo account that came out as 103 against the analytics screen's 104.
-- The two errors happen to pull in opposite directions, which is why nobody
-- noticed: exclusive counting loses a day per trip, and counting the November
-- booking adds eleven back. The number was wrong twice and looked about right.
--
-- Both halves are fixed here, and the same change is made to `ownCounters` in
-- `server/queries/resume.ts` so the owner's own view and a visitor's view of
-- the same profile cannot disagree either.
--
-- `trips_count` and `years_travelling` are deliberately untouched. Those count
-- what someone has recorded rather than what they have lived through, which is
-- the same thing the analytics headline counts, and the two already agree.

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
          -- `+ 1` because both ends count, and the status filter because a
          -- booking in November is not time anybody has spent away yet. The
          -- statuses are the SQL half of `HAPPENED` in shared/timeline.ts.
          when t.status in ('completed', 'ongoing')
            and t.start_date is not null
            and t.end_date is not null
            then greatest(0, (t.end_date - t.start_date)) + 1
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
  -- row of zeros. (Unchanged from 20260813000300; restated because `create or
  -- replace` rewrites the whole body.)
  where exists (
    select 1 from public.profiles pr where pr.id = p_user_id and pr.is_public = true
  );
$$;

revoke all on function public.public_resume_stats(uuid) from public;
grant execute on function public.public_resume_stats(uuid) to anon, authenticated;
