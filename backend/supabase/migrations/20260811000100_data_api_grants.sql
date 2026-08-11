-- Data API grants.
--
-- RLS policies decide which ROWS a role may see. Table-level GRANTs decide
-- whether the role may touch the table at all. Supabase no longer auto-grants
-- new tables to the Data API roles (see `auto_expose_new_tables` in
-- config.toml, which defaults to off and is removed on 2026-10-30), so without
-- this migration PostgREST rejects every request with
-- `42501 permission denied` before any policy is evaluated.
--
-- Grants here are deliberately wide; the policies in 20260807000100_init.sql
-- are what actually constrain access. A table with no policy for a given
-- operation stays closed even though the GRANT exists.

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reads
--
-- `anon` needs read access wherever a policy exposes something to signed-out
-- visitors: the plan catalogue, public profiles, public trips and blog posts,
-- and the public globe aggregate.
-- ---------------------------------------------------------------------------

grant select on table
  public.profiles,
  public.plans,
  public.trips,
  public.trip_places,
  public.blog_posts,
  public.visited_regions,
  public.media,
  public.albums,
  public.memories
to anon, authenticated;

-- Owner-scoped tables: no policy grants anon anything, so keep it off the list.
grant select on table
  public.trip_collaborators,
  public.share_links,
  public.wishlist_items,
  public.subscriptions,
  public.usage_counters
to authenticated;

-- ---------------------------------------------------------------------------
-- Writes
--
-- Signed-in users only. Every one of these tables has a policy keyed on
-- auth.uid(), so the GRANT cannot be used to write another user's rows.
-- ---------------------------------------------------------------------------

grant insert, update on table public.profiles to authenticated;

grant insert, update, delete on table
  public.trips,
  public.trip_collaborators,
  public.share_links,
  public.trip_places,
  public.albums,
  public.media,
  public.memories,
  public.blog_posts,
  public.wishlist_items
to authenticated;

-- ---------------------------------------------------------------------------
-- Deliberately NOT granted
--
--   webhook_events   service role only; it has no policies at all
--   plans            writes are service-role only (read granted above)
--   subscriptions    written by billing webhooks, never by the client
--   usage_counters   maintained by triggers
--   visited_regions  derived by refresh_visited_regions(); writing it directly
--                    would create the second source of truth the aggregate
--                    exists to prevent
-- ---------------------------------------------------------------------------

-- Future tables in this schema still need explicit grants. Nothing here sets a
-- default privilege, because silently exposing a new table is exactly the
-- failure mode the Supabase default now guards against.
