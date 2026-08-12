-- Data API grants, part two: the service role.
--
-- `20260811000100` granted `anon` and `authenticated` what they need, because
-- Supabase no longer auto-grants new tables to the Data API roles. It did not
-- grant `service_role`, and nothing since has — so on a database built purely
-- from these migrations, every elevated read fails with 42501:
--
--   * `getSharedTrip()` — an unlisted trip opened with a share token
--   * `getSharedBlogPost()` — the same for a post
--   * `ensurePublicDerivative()` — reading `media` to build a public photo, and
--     writing `public_path` back
--
-- All three use the service role precisely because RLS cannot see a token, and
-- all three were broken the moment they shipped. It went unnoticed because the
-- local stack was several migrations behind, so those code paths had never run
-- against a database that had them.
--
-- Granting broadly here rather than table by table, which is the opposite of the
-- decision `20260811000100` made for `anon`. The reasoning differs because the
-- role differs: `service_role` already carries `rolbypassrls`, so anything
-- holding that key can read every row of every table it can touch. A short grant
-- list would not contain it — it would only guarantee that the next elevated read
-- someone adds fails in production with a permission error that looks like a bug
-- in RLS. This is also what Supabase's own bootstrap does for this role.
--
-- The key never reaches a browser: `server/env.ts` is `server-only` and the
-- client that uses it is built exclusively in Server Actions and Route Handlers.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Future tables too, so a new table cannot reintroduce the same 42501. Set for
-- objects created by `postgres`, which is the role migrations run as.
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant all on functions to service_role;
