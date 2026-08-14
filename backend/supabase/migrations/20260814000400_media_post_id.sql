-- media.post_id: give a post's images a way back to the post.
--
-- An image placed inside a blog post has always been a `media` row with
-- `trip_id` null and nothing else tying it to anything. The post's HTML holds a
-- URL, and the object key encodes the post id — `<user>/posts/<post>/<media>` —
-- but neither of those is a relationship the database can follow. So the purge
-- that empties expired trash could delete a post and had no way to find the
-- pictures that had been inside it. They survived the post, unreachable from
-- anywhere in the product and still occupying storage the owner is charged for.
--
-- The column is what closes it. With `on delete cascade`, deleting a post takes
-- its media rows, and `expired_trash_media()` below can now name the files to
-- remove before that happens.
--
-- The path encoding stays as it is. It is how the backfill works, and an object
-- key that says who and what it belongs to is worth having when the only thing
-- you have is a bucket listing.

alter table public.media
  add column post_id uuid references public.blog_posts (id) on delete cascade;

comment on column public.media.post_id is
  'The post this image was placed in, for images uploaded through the editor. '
  'Null for trip media. Cascades, so purging a post reclaims its pictures.';

-- One owner or the other, never both. A row belonging to a trip *and* a post
-- would be deleted twice over by the purge and listed twice by
-- `expired_trash_media`, and there is no feature that would produce one.
alter table public.media
  add constraint media_one_parent check (not (trip_id is not null and post_id is not null));

-- The purge's lookup, and the only query that reads this column so far.
create index media_post_idx on public.media (post_id) where post_id is not null;

-- ---------------------------------------------------------------------------
-- Backfill
--
-- Every post image already carries its post id in the middle of its object key.
-- `regexp_match` pulls it back out, and the `exists` guard drops the ones whose
-- post has since been deleted outright — those are already orphaned, and the
-- foreign key would refuse them anyway.
-- ---------------------------------------------------------------------------

update public.media m
   set post_id = extracted.post_id
  from (
    select
      id,
      (regexp_match(storage_path, '/posts/([0-9a-fA-F-]{36})/'))[1]::uuid as post_id
    from public.media
    where trip_id is null
      and storage_path like '%/posts/%'
  ) as extracted
 where m.id = extracted.id
   and extracted.post_id is not null
   and exists (select 1 from public.blog_posts p where p.id = extracted.post_id);

-- ---------------------------------------------------------------------------
-- The purge learns about them
-- ---------------------------------------------------------------------------

/**
 * Objects belonging to trash that is past the window — now both kinds.
 *
 * `union all` rather than `union`: the check constraint above makes a row
 * belonging to both parents impossible, so there are no duplicates to collapse
 * and no reason to pay for the sort that would find none.
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
    and t.deleted_at < p_cutoff

  union all

  select m.storage_path, m.public_path
  from public.media m
  join public.blog_posts p on p.id = m.post_id
  where p.deleted_at is not null
    and p.deleted_at < p_cutoff;
$$;

revoke all on function public.expired_trash_media(timestamptz) from public, anon, authenticated;
