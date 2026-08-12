-- Coordinates the Data API can actually return.
--
-- `trip_places.location` is `geography(Point, 4326)`, and PostgREST serialises it
-- as hex EWKB:
--
--   "location": "0101000020E6100000A69BC420B04E5340E9B7AF03E79C3C40"
--
-- not as GeoJSON. The app believed otherwise — `parsePoint()` was written to read
-- `{ type: 'Point', coordinates: [...] }` and to treat anything else as "no
-- coordinates" — so every pinned place read back as unpinned. Writes were fine;
-- it was the read that silently failed, which meant distance travelled, the one
-- thing pins exist for, could never be computed.
--
-- Two ways out: decode EWKB in TypeScript, or have Postgres answer in numbers.
-- This takes the second. Decoding a binary format by hand in the app would put
-- byte-order handling on the path between a photograph and a map, to work around
-- a serialisation detail of one HTTP layer; two generated columns move the
-- question to the only place that is certain of the answer.
--
-- Stored, not virtual: both expressions are immutable, the values are read on
-- every trip and resume load, and stored columns can be indexed later if
-- proximity queries ever need it. `location` remains the source of truth — these
-- are derived from it and cannot disagree.

alter table public.trip_places
  add column latitude double precision
    generated always as (st_y(location::geometry)) stored,
  add column longitude double precision
    generated always as (st_x(location::geometry)) stored;

comment on column public.trip_places.latitude is
  'Derived from location. Exists because PostgREST returns geography as hex '
  'EWKB, which the app cannot read. Never written directly.';
comment on column public.trip_places.longitude is
  'Derived from location. See latitude.';

-- Read-only for the Data API roles: they are generated, so a write would be
-- rejected anyway, but the grant should say what is true.
grant select (latitude, longitude) on public.trip_places to anon, authenticated;
