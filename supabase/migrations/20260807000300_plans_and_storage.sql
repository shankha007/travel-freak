-- Plan catalogue and storage buckets.
--
-- `limits` is the single source of truth for quotas. The pricing page renders
-- from it and src/lib/entitlements.ts enforces from it, so the marketing copy
-- and the actual behaviour cannot drift apart.
--
-- Money is stored in MINOR units (paise, cents) to avoid float rounding.
--
-- Convention inside `limits`: null means unlimited, 0 means not available.
-- Every "unlimited" is still bounded by storage_bytes, which is the real cap.

insert into public.plans
  (code, name, sort_order, price_inr, price_usd, price_inr_yearly, price_usd_yearly, limits)
values
  (
    'explorer',
    'Explorer',
    1,
    0, 0, 0, 0,
    jsonb_build_object(
      'trips', 15,
      'photos_per_trip', 5,
      'videos_per_trip', 0,
      'audios_per_trip', 0,
      'storage_bytes', 1073741824,          -- 1 GB
      'max_image_dimension', 1600,          -- downscaled on ingest
      'video_max_duration_s', 0,
      'audio_max_duration_s', 0,
      'blogs', null,                        -- text costs us nothing; public blogs are inbound SEO
      'globe_3d', true,                     -- country level, free: this is the growth loop
      'globe_region_detail', false,         -- state/province highlighting is the paid upgrade
      'globe_themes', 1,
      'globe_timeline_playback', false,
      'globe_city_pins_routes', false,
      'india_state_map', true,
      'planned_trips', 2,
      'itinerary_full', false,
      'budget_full', false,
      'checklists', 3,
      'collaborators_per_trip', 0,
      'albums', false,
      'analytics_advanced', false,
      'wrapped_advanced', false,
      'export_json', true,
      'export_pdf', false,
      'export_media_archive', false,
      'branding_badge', true,               -- the no-ads growth channel
      'custom_domain', false,
      'ai_generations_per_month', 5,
      'support', 'community'
    )
  ),
  (
    'voyager',
    'Voyager',
    2,
    39900, 500, 349900, 4400,
    jsonb_build_object(
      'trips', null,
      'photos_per_trip', 200,
      'videos_per_trip', 0,
      'audios_per_trip', 0,
      'storage_bytes', 32212254720,         -- 30 GB
      'max_image_dimension', null,          -- originals retained
      'video_max_duration_s', 0,
      'audio_max_duration_s', 0,
      'blogs', null,
      'globe_3d', true,
      'globe_region_detail', true,
      'globe_themes', 6,
      'globe_timeline_playback', false,
      'globe_city_pins_routes', false,
      'india_state_map', true,
      'planned_trips', null,
      'itinerary_full', true,
      'budget_full', true,
      'checklists', null,
      'collaborators_per_trip', 3,
      'albums', true,
      'analytics_advanced', true,
      'wrapped_advanced', false,
      'export_json', true,
      'export_pdf', true,
      'export_media_archive', false,
      'branding_badge', false,
      'custom_domain', false,
      'ai_generations_per_month', 50,
      'support', 'email'
    )
  ),
  (
    'nomad',
    'Nomad',
    3,
    79900, 900, 699900, 7900,
    jsonb_build_object(
      'trips', null,
      'photos_per_trip', 500,
      'videos_per_trip', 50,
      'audios_per_trip', 50,
      'storage_bytes', 107374182400,        -- 100 GB, the binding constraint
      'max_image_dimension', null,
      'video_max_duration_s', 600,
      'audio_max_duration_s', 900,
      'blogs', null,
      'globe_3d', true,
      'globe_region_detail', true,
      'globe_themes', null,
      'globe_timeline_playback', true,
      'globe_city_pins_routes', true,
      'india_state_map', true,
      'planned_trips', null,
      'itinerary_full', true,
      'budget_full', true,
      'checklists', null,
      'collaborators_per_trip', null,
      'albums', true,
      'analytics_advanced', true,
      'wrapped_advanced', true,
      'export_json', true,
      'export_pdf', true,
      'export_media_archive', true,
      'branding_badge', false,
      'custom_domain', true,
      'ai_generations_per_month', 200,
      'support', 'priority'
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Private. Owners read their own objects directly; viewers of a public trip get
-- short-lived signed URLs issued server-side after a can_read_trip() check.
-- Keeping this private is also what lets us serve EXIF-stripped derivatives to
-- the public while the original keeps its GPS metadata for the owner.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Object keys are `<user_id>/<trip_id>/<media_id>.<ext>`, so the first path
-- segment is the ownership check.
create policy media_objects_select_own on storage.objects
  for select using (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy media_objects_insert_own on storage.objects
  for insert with check (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy media_objects_update_own on storage.objects
  for update using (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy media_objects_delete_own on storage.objects
  for delete using (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatar_objects_read_all on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatar_objects_write_own on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatar_objects_update_own on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatar_objects_delete_own on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
