-- Public trip pages: derivatives that are safe to publish, and unlisted links.
--
-- Two things stood between a trip and a public URL.
--
-- 1. Photos. Originals are stored exactly as the camera wrote them, GPS and
--    all, which is right for the owner and unpublishable for anyone else — a
--    holiday photo taken at home pins the photographer's front door. The plan
--    calls this a safety issue rather than a nicety, so a public page never
--    serves an original. It serves a derivative: re-encoded, resized, and
--    stripped of every metadata block on the way through.
--
-- 2. Unlisted trips. `share_links` has existed since the first migration with
--    nothing to resolve its tokens. Anonymous resolution cannot go through RLS
--    — the whole point is that the row is not otherwise readable — so it goes
--    through a SECURITY DEFINER function that trades a token for one trip id
--    and nothing else.

-- ---------------------------------------------------------------------------
-- Derivatives
-- ---------------------------------------------------------------------------

alter table public.media
  add column public_path text;

comment on column public.media.public_path is
  'Object key in the media-public bucket of the EXIF-stripped derivative. Null '
  'until the photo has appeared on a public page. Never the original.';

-- Public, unlike `media`: these objects are the ones meant to be handed to a
-- CDN and a stranger's browser. Nothing with metadata ever lands here.
insert into storage.buckets (id, name, public)
values ('media-public', 'media-public', true)
on conflict (id) do nothing;

-- Read is open, which is what "public bucket" means. Writes have no policy at
-- all: derivatives are generated server-side with the service role after the
-- app has checked that the trip really is public, so no client — signed in or
-- not — may put anything in here.
create policy media_public_read_all on storage.objects
  for select using (bucket_id = 'media-public');

-- ---------------------------------------------------------------------------
-- Unlisted links
-- ---------------------------------------------------------------------------

/**
 * Trades a share token for the trip it points at.
 *
 * Returns null for a token that is unknown, revoked, expired, or whose trip has
 * been deleted — the same answer in every case, so the function cannot be used
 * to tell a revoked link from one that never existed.
 *
 * It deliberately returns an id rather than the trip: the caller still has to
 * fetch the trip, and doing that with the service role keeps this function
 * small enough to read in one sitting.
 */
create or replace function public.resolve_share_link(p_token text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select sl.trip_id
  from public.share_links sl
  join public.trips t on t.id = sl.trip_id
  where sl.token = p_token
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and t.deleted_at is null
    -- A private trip is private even with a link: unlisted is a visibility the
    -- owner has to choose, not something a link confers.
    and t.visibility in ('unlisted', 'public');
$$;

revoke all on function public.resolve_share_link(text) from public;
grant execute on function public.resolve_share_link(text) to anon, authenticated;

/**
 * Whether a trip's page should carry the "Made with" badge.
 *
 * `shows_branding_badge()` answers the same question for a profile, and asks
 * the profile to be public before it answers. A trip can be public while its
 * author's profile is not, and in that case the profile-shaped question returns
 * the free-plan default — which would put the badge on a paying customer's
 * page. This asks about the trip instead.
 *
 * Same stance as the other one: it answers a yes-or-no question about branding
 * and never reveals the plan, and it defaults to showing the badge.
 */
create or replace function public.trip_shows_branding_badge(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (
      select (pl.limits ->> 'branding_badge')::boolean
      from public.trips t
      join public.subscriptions s on s.user_id = t.user_id
      join public.plans pl on pl.code = s.plan_code
      where t.id = p_trip_id
        and t.deleted_at is null
        and t.visibility in ('public', 'unlisted')
        and s.status in ('trialing', 'active')
    ),
    true
  );
$$;

revoke all on function public.trip_shows_branding_badge(uuid) from public;
grant execute on function public.trip_shows_branding_badge(uuid) to anon, authenticated;
