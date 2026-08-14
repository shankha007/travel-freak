-- Purging the trash, once its 30 days are up.
--
-- Soft delete has been half a promise since it shipped. "Recoverable for 30
-- days" was kept — `restore_trip()` refuses past the window, and the trash
-- screen counts down — but nothing ever came back for what expired. A trip
-- deleted forty days ago is unreachable to its owner, to a visitor and to the
-- restore path, and is still every byte it ever was on disk. That is the
-- opposite of what the privacy policy says happens, and the storage is being
-- paid for.
--
-- Two functions rather than one, because the order matters and only half of it
-- can happen in SQL:
--
--   1. `expired_trash_media()` lists the objects that are about to be orphaned.
--      Storage is not the database — deleting a `media` row leaves the file
--      exactly where it was — so the caller removes those objects first, while
--      the rows that name them still exist.
--   2. `purge_expired_trash()` deletes the rows. `on delete cascade` takes the
--      places, media rows, memories and albums with the trip.
--
-- Both take the cutoff as an argument rather than computing `now() - 30 days`
-- themselves. That is what makes them testable: a test can ask for the state of
-- the world as of any date without inventing a trip deleted forty days ago and
-- waiting.

/**
 * Objects belonging to trash that is past the window.
 *
 * Both paths per row: `storage_path` is the original in the private bucket and
 * `public_path` the stripped derivative in the public one, which is null until
 * something has been published.
 *
 * Post images are deliberately absent, and this is a known hole rather than an
 * oversight: `media` has no `post_id`, so an image placed inside a post cannot
 * be found from the post. Purging a post therefore reclaims its row and not its
 * pictures. Closing it needs a column, which needs a migration of its own.
 */
create or replace function public.expired_trash_media(p_cutoff timestamptz)
returns table (storage_path text, public_path text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select m.storage_path, m.public_path
  from public.media m
  join public.trips t on t.id = m.trip_id
  where t.deleted_at is not null
    and t.deleted_at < p_cutoff;
$$;

/**
 * Deletes trash that is past the window, and reports what went.
 *
 * Counts rather than ids: the caller is a scheduled job writing a log line, and
 * the ids belong to rows that no longer exist by the time it could use them.
 *
 * A trip is deleted outright rather than having its children deleted first —
 * every table that hangs off `trips` carries `on delete cascade`, which the
 * pgTAP suite asserts here and again for account deletion.
 */
create or replace function public.purge_expired_trash(p_cutoff timestamptz)
returns table (trips_purged integer, posts_purged integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trips integer;
  v_posts integer;
begin
  with gone as (
    delete from public.trips
    where deleted_at is not null and deleted_at < p_cutoff
    returning 1
  )
  select count(*)::integer into v_trips from gone;

  with gone as (
    delete from public.blog_posts
    where deleted_at is not null and deleted_at < p_cutoff
    returning 1
  )
  select count(*)::integer into v_posts from gone;

  return query select v_trips, v_posts;
end;
$$;

-- Neither of these is for a browser. `service_role` bypasses RLS and already
-- holds every privilege in this schema, so the grants below are subtractive:
-- functions are executable by PUBLIC unless told otherwise, and a purge anyone
-- can call with a cutoff of `now() + 1 year` is a delete-everything button.
revoke all on function public.expired_trash_media(timestamptz) from public, anon, authenticated;
revoke all on function public.purge_expired_trash(timestamptz) from public, anon, authenticated;
