-- soft_delete_trip / restore_trip
--
-- Setting `trips.deleted_at` from the client is impossible under the current
-- policies, and the reason is subtle: on UPDATE, Postgres requires the *new*
-- row to still satisfy the table's SELECT policies. `trips_select_own` reads
--
--     user_id = auth.uid() and deleted_at is null
--
-- so the moment deleted_at is set, the resulting row is invisible to its own
-- owner and the update is rejected with 42501. A plain
-- `update trips set deleted_at = now()` therefore fails for everyone.
--
-- The fix is deliberately not "relax the SELECT policy". Keeping deleted trips
-- unreadable is exactly what the policy is for; loosening it would mean every
-- read path in the app had to remember to filter, and one that forgot would
-- resurrect deleted trips. Instead the transition runs in a SECURITY DEFINER
-- function that does its own ownership check — narrow, auditable, and the
-- natural home for the 30-day restore window.
--
-- blog_posts is unaffected: its `for all` write policy doubles as a SELECT
-- policy with no deleted_at clause, so the same update succeeds there.

create or replace function public.soft_delete_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Ownership is checked here rather than by RLS, which this function bypasses.
  -- Collaborators can edit a trip; only its owner can delete it.
  update public.trips
     set deleted_at = now()
   where id = p_trip_id
     and user_id = auth.uid()
     and deleted_at is null;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- Restores a trip inside its retention window. Nothing calls this from the UI
-- yet; it exists so the 30-day promise in the delete dialog is something the
-- database can actually keep.
create or replace function public.restore_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.trips
     set deleted_at = null
   where id = p_trip_id
     and user_id = auth.uid()
     and deleted_at is not null
     and deleted_at > now() - interval '30 days';

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- SECURITY DEFINER functions are granted explicitly: the default EXECUTE-to-
-- PUBLIC would hand anon a way to run them.
revoke all on function public.soft_delete_trip(uuid) from public, anon;
revoke all on function public.restore_trip(uuid) from public, anon;
grant execute on function public.soft_delete_trip(uuid) to authenticated;
grant execute on function public.restore_trip(uuid) to authenticated;
