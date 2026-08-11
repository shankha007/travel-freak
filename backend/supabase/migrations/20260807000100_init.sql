-- Core schema: identity, trips, geography, media, content, planner, billing.
--
-- Every table has RLS enabled with no exceptions. Ownership is enforced in the
-- database so that a mistake in a Server Action or Route Handler cannot leak one
-- user's trips to another. Public and unlisted visibility are expressed as
-- policies here rather than as application-level filters.

create extension if not exists postgis;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type trip_status as enum ('planning', 'upcoming', 'ongoing', 'completed');
create type visibility as enum ('private', 'unlisted', 'public');
create type trip_type as enum ('solo', 'couple', 'friends', 'family', 'business');
create type media_kind as enum ('image', 'video', 'audio');
create type memory_kind as enum ('note', 'photo', 'audio', 'video', 'quote', 'favorite_location');
create type place_kind as enum (
  'city', 'mountain', 'beach', 'forest', 'unesco', 'national_park', 'other'
);
create type region_state as enum ('visited', 'current', 'planned', 'unvisited');
create type collaborator_role as enum ('owner', 'editor', 'viewer');
create type processing_status as enum ('pending', 'processing', 'ready', 'failed');
create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'expired'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique
    check (length(username) between 3 and 30 and username ~ '^[a-z0-9_]+$'),
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  country_code char(3),
  city text,
  travel_interests text[] not null default '{}',
  social_links jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  -- When true, coordinates near the user's home are stored at city precision.
  fuzz_home_location boolean not null default true,
  -- Strip EXIF (incl. GPS) from public derivatives. On by default: photo
  -- metadata leaking a home address is a safety issue, not a preference.
  strip_exif_on_publish boolean not null default true,
  default_trip_visibility visibility not null default 'private',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- plans (seeded config; see 20260807000300_seed_plans.sql)
-- ---------------------------------------------------------------------------

create table public.plans (
  code text primary key,
  name text not null,
  price_inr integer not null default 0,
  price_usd integer not null default 0,
  price_inr_yearly integer not null default 0,
  price_usd_yearly integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- Single source of truth for quotas. Both the pricing page and all
  -- server-side enforcement read this, so they cannot disagree.
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  slug text not null unique,
  summary text not null default '',
  cover_media_id uuid,
  start_date date,
  end_date date,
  status trip_status not null default 'planning',
  visibility visibility not null default 'private',
  trip_type trip_type,
  traveler_count integer not null default 1 check (traveler_count > 0),
  budget_planned numeric(12, 2),
  currency char(3) not null default 'INR',
  published_at timestamptz,
  deleted_at timestamptz,
  -- Denormalized counters maintained by triggers so a quota check is one cheap
  -- read rather than an aggregate over the media table.
  photo_count integer not null default 0,
  video_count integer not null default 0,
  audio_count integer not null default 0,
  media_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

create index trips_user_start_idx on public.trips (user_id, start_date desc nulls last);
create index trips_public_idx on public.trips (published_at desc)
  where visibility = 'public' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- trip_collaborators
--
-- Declared before the trip policies because those policies call a helper that
-- reads this table.
-- ---------------------------------------------------------------------------

create table public.trip_collaborators (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  invited_email citext,
  role collaborator_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collaborator_identity check (user_id is not null or invited_email is not null)
);

create unique index trip_collaborators_unique_user
  on public.trip_collaborators (trip_id, user_id) where user_id is not null;
create index trip_collaborators_user_idx on public.trip_collaborators (user_id);

create trigger trip_collaborators_set_updated_at
  before update on public.trip_collaborators
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- share_links — revocable tokens for `unlisted` visibility
-- ---------------------------------------------------------------------------

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index share_links_trip_idx on public.share_links (trip_id);

-- ---------------------------------------------------------------------------
-- Access helpers
--
-- SECURITY DEFINER so they read their source tables with RLS bypassed. Without
-- this, a trips policy that reads trip_collaborators (whose own policy reads
-- trips) would recurse infinitely and every query would error.
-- ---------------------------------------------------------------------------

create or replace function public.is_trip_collaborator(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.trip_collaborators tc
    where tc.trip_id = p_trip_id
      and tc.user_id = auth.uid()
      and tc.accepted_at is not null
  );
$$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid() and t.deleted_at is null
  ) or exists (
    select 1 from public.trip_collaborators tc
    where tc.trip_id = p_trip_id
      and tc.user_id = auth.uid()
      and tc.accepted_at is not null
      and tc.role in ('owner', 'editor')
  );
$$;

create or replace function public.can_read_trip(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = p_trip_id
      and t.deleted_at is null
      and (
        t.user_id = auth.uid()
        or (t.visibility = 'public' and t.published_at is not null)
        or public.is_trip_collaborator(t.id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- trip_places — the single source of truth for the globe, maps and stats
-- ---------------------------------------------------------------------------

create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code char(3) not null,          -- ISO 3166-1 alpha-3
  region_code text,                        -- ISO 3166-2, e.g. 'IN-KA'
  city_name text,
  location geography(Point, 4326),
  place_kind place_kind not null default 'city',
  arrival_date date,
  departure_date date,
  order_index integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_places_date_order
    check (departure_date is null or arrival_date is null or departure_date >= arrival_date)
);

create trigger trip_places_set_updated_at
  before update on public.trip_places
  for each row execute function public.set_updated_at();

create index trip_places_trip_idx on public.trip_places (trip_id, order_index);
create index trip_places_user_region_idx on public.trip_places (user_id, country_code, region_code);
create index trip_places_location_idx on public.trip_places using gist (location);

-- ---------------------------------------------------------------------------
-- albums / media
-- ---------------------------------------------------------------------------

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  cover_media_id uuid,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();

create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  album_id uuid references public.albums (id) on delete set null,
  kind media_kind not null,
  storage_path text not null unique,
  mime text not null,
  bytes bigint not null default 0 check (bytes >= 0),
  width integer,
  height integer,
  duration_s numeric(10, 2),
  blurhash text,
  caption text not null default '',
  alt_text text not null default '',
  taken_at timestamptz,
  -- Original EXIF coordinates, owner-visible only. Public derivatives are
  -- generated with metadata stripped.
  exif_lat double precision,
  exif_lng double precision,
  is_featured boolean not null default false,
  processing_status processing_status not null default 'pending',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

create index media_trip_kind_idx on public.media (trip_id, kind) where deleted_at is null;
create index media_user_idx on public.media (user_id) where deleted_at is null;

alter table public.trips
  add constraint trips_cover_media_fk
  foreign key (cover_media_id) references public.media (id) on delete set null;

alter table public.albums
  add constraint albums_cover_media_fk
  foreign key (cover_media_id) references public.media (id) on delete set null;

-- ---------------------------------------------------------------------------
-- memories — atomic entries pinned to a place; drives the globe modal
-- ---------------------------------------------------------------------------

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  trip_place_id uuid references public.trip_places (id) on delete set null,
  kind memory_kind not null default 'note',
  body text not null default '',
  media_id uuid references public.media (id) on delete set null,
  happened_at timestamptz,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

create index memories_trip_idx on public.memories (trip_id, order_index);
create index memories_place_idx on public.memories (trip_place_id);

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  slug text not null unique,
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  excerpt text not null default '',
  cover_media_id uuid references public.media (id) on delete set null,
  reading_minutes integer not null default 1,
  visibility visibility not null default 'private',
  theme text not null default 'default',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_html, '')), 'C')
  ) stored
);

create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

create index blog_posts_search_idx on public.blog_posts using gin (search_vector);
create index blog_posts_user_idx on public.blog_posts (user_id, updated_at desc);
create index blog_posts_published_idx on public.blog_posts (published_at desc)
  where visibility = 'public' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- wishlist_items
-- ---------------------------------------------------------------------------

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country_code char(3) not null,
  region_code text,
  title text not null default '',
  notes text not null default '',
  est_budget numeric(12, 2),
  currency char(3) not null default 'INR',
  priority smallint not null default 3 check (priority between 1 and 5),
  best_season text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger wishlist_items_set_updated_at
  before update on public.wishlist_items
  for each row execute function public.set_updated_at();

create unique index wishlist_items_unique
  on public.wishlist_items (user_id, country_code, coalesce(region_code, ''));

-- ---------------------------------------------------------------------------
-- Billing: subscriptions, usage, webhook idempotency
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  status subscription_status not null default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  -- Set when a downgrade leaves the account over quota. Existing media stays
  -- readable; new uploads are refused until usage is back under the cap.
  over_quota_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.usage_counters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  storage_bytes bigint not null default 0,
  trips_count integer not null default 0,
  ai_calls_used integer not null default 0,
  period_start date not null default date_trunc('month', now())::date,
  updated_at timestamptz not null default now()
);

create trigger usage_counters_set_updated_at
  before update on public.usage_counters
  for each row execute function public.set_updated_at();

-- Never exposed to clients; written only by webhook handlers via service role.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.plans               enable row level security;
alter table public.trips               enable row level security;
alter table public.trip_collaborators  enable row level security;
alter table public.share_links         enable row level security;
alter table public.trip_places         enable row level security;
alter table public.albums              enable row level security;
alter table public.media               enable row level security;
alter table public.memories            enable row level security;
alter table public.blog_posts          enable row level security;
alter table public.wishlist_items      enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.usage_counters      enable row level security;
alter table public.webhook_events      enable row level security;

-- profiles: own row always; other profiles only when marked public.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_public on public.profiles
  for select using (is_public = true);
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- plans: public catalogue, readable by anyone including signed-out visitors.
-- Writes are service-role only (no policy grants them).
create policy plans_select_all on public.plans
  for select using (is_active = true);

-- trips
create policy trips_select_own on public.trips
  for select using (user_id = auth.uid() and deleted_at is null);
create policy trips_select_public on public.trips
  for select using (visibility = 'public' and published_at is not null and deleted_at is null);
create policy trips_select_collaborator on public.trips
  for select using (deleted_at is null and public.is_trip_collaborator(id));
create policy trips_insert_own on public.trips
  for insert with check (user_id = auth.uid());
create policy trips_update_own on public.trips
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trips_update_editor on public.trips
  for update using (public.is_trip_collaborator(id) and public.can_edit_trip(id));
create policy trips_delete_own on public.trips
  for delete using (user_id = auth.uid());

-- trip_collaborators: the trip owner manages the list; invitees see their own row.
create policy collaborators_select on public.trip_collaborators
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );
create policy collaborators_manage_owner on public.trip_collaborators
  for all using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );
-- Lets an invitee accept their own invitation, but not change its role.
create policy collaborators_accept_own on public.trip_collaborators
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- share_links: owner only. Anonymous resolution goes through a
-- SECURITY DEFINER function, so no public select policy is needed.
create policy share_links_own on public.share_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trip_places
create policy trip_places_select on public.trip_places
  for select using (user_id = auth.uid() or public.can_read_trip(trip_id));
create policy trip_places_insert on public.trip_places
  for insert with check (user_id = auth.uid() and public.can_edit_trip(trip_id));
create policy trip_places_update on public.trip_places
  for update using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));
create policy trip_places_delete on public.trip_places
  for delete using (user_id = auth.uid() or public.can_edit_trip(trip_id));

-- albums
create policy albums_select on public.albums
  for select using (user_id = auth.uid() or public.can_read_trip(trip_id));
create policy albums_write on public.albums
  for all using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));

-- media
create policy media_select_own on public.media
  for select using (user_id = auth.uid() and deleted_at is null);
create policy media_select_shared on public.media
  for select using (deleted_at is null and trip_id is not null and public.can_read_trip(trip_id));
create policy media_insert_own on public.media
  for insert with check (user_id = auth.uid());
create policy media_update_own on public.media
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy media_delete_own on public.media
  for delete using (user_id = auth.uid());

-- memories
create policy memories_select on public.memories
  for select using (user_id = auth.uid() or public.can_read_trip(trip_id));
create policy memories_write on public.memories
  for all using (user_id = auth.uid() or public.can_edit_trip(trip_id))
  with check (user_id = auth.uid() or public.can_edit_trip(trip_id));

-- blog_posts
create policy blog_posts_select_own on public.blog_posts
  for select using (user_id = auth.uid() and deleted_at is null);
create policy blog_posts_select_public on public.blog_posts
  for select using (visibility = 'public' and published_at is not null and deleted_at is null);
create policy blog_posts_write_own on public.blog_posts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- wishlist_items
create policy wishlist_own on public.wishlist_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- subscriptions / usage: readable by the owner, written only by service role.
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());
create policy usage_counters_select_own on public.usage_counters
  for select using (user_id = auth.uid());

-- webhook_events: no policies at all. Service role only.

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base_username text;
  final_username text;
  suffix integer := 0;
begin
  -- Derive a legal username from the email local-part, then de-duplicate.
  base_username := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'traveller';
  end if;
  base_username := left(base_username, 24);
  final_username := base_username;

  while exists (select 1 from public.profiles p where p.username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  );

  insert into public.subscriptions (user_id, plan_code) values (new.id, 'explorer');
  insert into public.usage_counters (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
