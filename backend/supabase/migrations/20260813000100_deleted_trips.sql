-- Reading the trash.
--
-- `restore_trip()` has existed since 20260812000200, and nothing could call it,
-- because a deleted trip cannot be listed: `trips_select_own` ends in
--
--     deleted_at is null
--
-- which is deliberate — it is what stops every read path in the app from having
-- to remember to filter. But it also means the owner of a deleted trip cannot
-- see that it exists, so the 30-day promise in the delete dialog had no screen.
--
-- Same shape of answer as everywhere else in this schema: rather than loosening
-- the policy, one SECURITY DEFINER function answers the one question the trash
-- screen asks, for the caller's own rows only, inside the retention window only.
-- A trip past its window is not returned even though the row is still there — the
-- window is what the UI promises, so the function is what enforces it.

create or replace function public.list_deleted_trips()
returns table (
  id uuid,
  title text,
  slug text,
  summary text,
  start_date date,
  end_date date,
  visibility public.visibility,
  deleted_at timestamptz,
  -- What restoring brings back with it. Counted here because the caller cannot
  -- read trip_places for a deleted trip either.
  place_count integer,
  photo_count integer,
  post_count integer
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    t.id,
    t.title,
    t.slug,
    t.summary,
    t.start_date,
    t.end_date,
    t.visibility,
    t.deleted_at,
    (select count(*)::integer from public.trip_places p where p.trip_id = t.id),
    (select count(*)::integer from public.media m
      where m.trip_id = t.id and m.deleted_at is null),
    (select count(*)::integer from public.blog_posts b
      where b.trip_id = t.id and b.deleted_at is null)
  from public.trips t
  where t.user_id = auth.uid()
    and t.deleted_at is not null
    and t.deleted_at > now() - interval '30 days'
  order by t.deleted_at desc;
$$;

revoke all on function public.list_deleted_trips() from public, anon;
grant execute on function public.list_deleted_trips() to authenticated;

comment on function public.list_deleted_trips() is
  'Trips the caller deleted within the last 30 days, for the trash screen. '
  'Nothing outside the retention window is returned, so the screen can never '
  'offer a restore that restore_trip() would refuse.';
