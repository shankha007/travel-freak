-- Share links for unlisted posts.
--
-- `share_links` has been trip-shaped since the first migration: one `trip_id`
-- column, nullable but with nothing else it could point at. So a post set to
-- `unlisted` was readable by exactly one person — its author — which is not what
-- "anyone with the link" means, and the Blog Studio had to say so in a tooltip.
--
-- Widening the table rather than giving posts their own is the smaller change:
-- the token generation, the revocation semantics and the "rows are never
-- deleted" rule are all already here and all apply identically. What a link
-- points at becomes a choice between two columns, with a constraint making sure
-- it is exactly one.

alter table public.share_links
  add column post_id uuid references public.blog_posts (id) on delete cascade;

-- Exactly one target. A row with neither is a token that resolves to nothing;
-- a row with both is two capabilities wearing one token, and revoking it would
-- revoke access to something the user was not thinking about.
alter table public.share_links
  add constraint share_links_one_target
  check (num_nonnulls(trip_id, post_id) = 1);

create index share_links_post_idx on public.share_links (post_id);

comment on column public.share_links.post_id is
  'The post this token opens, when it is a post link. Mutually exclusive with '
  'trip_id — see share_links_one_target.';

/**
 * Trades a share token for the post it points at.
 *
 * The trip-shaped twin of `resolve_share_link()`, and deliberately a separate
 * function rather than one returning a (kind, id) pair: each caller knows which
 * kind it is resolving, and a function that could return either would make every
 * caller check something it already knows.
 *
 * Returns null for a token that is unknown, revoked, expired, points at a
 * deleted post, or at one whose visibility has gone back to private. Same answer
 * in every case, so it cannot be used to tell a revoked link from one that never
 * existed — and so pulling a post back to private cannot be undone by a link
 * handed out last month.
 */
create or replace function public.resolve_post_share_link(p_token text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select sl.post_id
  from public.share_links sl
  join public.blog_posts p on p.id = sl.post_id
  where sl.token = p_token
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and p.deleted_at is null
    -- Unlisted is a visibility the author chose, not something a link confers.
    and p.visibility in ('unlisted', 'public')
    -- An unpublished draft stays private even with a link: publishing is the act
    -- that says the text is ready to be read by someone else.
    and p.published_at is not null;
$$;

revoke all on function public.resolve_post_share_link(text) from public;
grant execute on function public.resolve_post_share_link(text) to anon, authenticated;

/**
 * Whether a post's page should carry the "Made with" badge.
 *
 * `shows_branding_badge()` asks about a profile and requires it to be public
 * before answering, which is wrong for a post: a post can be published while its
 * author's profile is private, and in that case the profile-shaped question
 * returns the free-plan default and would badge a paying customer's page. The
 * trip page already needed its own version of this; so does the reader.
 *
 * Answers one yes-or-no question, never reveals the plan, and defaults to
 * showing the badge when it cannot tell.
 */
create or replace function public.post_shows_branding_badge(p_post_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (
      select (pl.limits ->> 'branding_badge')::boolean
      from public.blog_posts p
      join public.subscriptions s on s.user_id = p.user_id
      join public.plans pl on pl.code = s.plan_code
      where p.id = p_post_id
        and p.deleted_at is null
        and p.visibility in ('public', 'unlisted')
        and s.status in ('trialing', 'active')
    ),
    true
  );
$$;

revoke all on function public.post_shows_branding_badge(uuid) from public;
grant execute on function public.post_shows_branding_badge(uuid) to anon, authenticated;
