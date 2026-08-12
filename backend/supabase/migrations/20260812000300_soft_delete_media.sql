-- soft_delete_media / restore_media
--
-- Same trap as trips, same fix. `media_select_own` reads
--
--     user_id = auth.uid() and deleted_at is null
--
-- and on UPDATE Postgres requires the *new* row to still satisfy the SELECT
-- policies, so setting deleted_at fails with 42501 for the owner of the photo.
-- See 20260812000200 for the longer explanation.
--
-- Deleting a photo also has to give the bytes back: `bytes` is zeroed here so
-- the storage pool releases immediately, which matters because storage is the
-- thing the plan actually charges for. The row itself stays for the 30-day
-- restore window, and the trigger on `media` recomputes the trip counters and
-- the account pool from the change.
--
-- The stored object is removed by the caller through the Storage API — SQL
-- cannot delete it, and storage.objects rejects direct deletes by design.

create or replace function public.soft_delete_media(p_media_id uuid)
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
  update public.media
     set deleted_at = now(),
         bytes = 0,
         is_featured = false
   where id = p_media_id
     and user_id = auth.uid()
     and deleted_at is null;

  get diagnostics affected = row_count;

  -- A deleted photo must not stay on as a trip's cover, or the trip page and
  -- the globe would both point at something the user believes is gone.
  if affected > 0 then
    update public.trips
       set cover_media_id = null
     where cover_media_id = p_media_id
       and user_id = auth.uid();
  end if;

  return affected > 0;
end;
$$;

revoke all on function public.soft_delete_media(uuid) from public, anon;
grant execute on function public.soft_delete_media(uuid) to authenticated;
