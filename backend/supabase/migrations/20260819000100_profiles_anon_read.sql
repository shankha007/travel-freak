-- ---------------------------------------------------------------------------
-- Signed-out visitors can read a public profile again.
--
-- `20260815000200` added `profiles_select_trip_mates`, a permissive SELECT
-- policy calling `shares_a_trip_with(id)`, and — correctly, by its own
-- reasoning — revoked EXECUTE on that function from `anon`.
--
-- Those two lines cannot both hold. Postgres evaluates **every** permissive
-- policy on a table for whichever role is asking, and stops at the first error
-- rather than skipping a policy it cannot run. So an anonymous `select` on
-- `profiles` reached a function it had no rights to and failed outright:
--
--     42501: permission denied for function shares_a_trip_with
--
-- Not "no rows" — an error, which takes the whole read with it, including the
-- rows `profiles_select_public` was meant to return. Every signed-out surface
-- built on a profile went with it: the public profile page (screen 36) rendered
-- its not-found state for a profile that exists and is public, `sitemap.xml`
-- silently listed no profiles at all, the author's byline vanished from the
-- public blog index, and the profile OG card fell back to the site card. None of
-- them error visibly, which is why this survived: each one is written to treat a
-- missing profile as a private profile, and that is exactly what it looked like.
--
-- The fix is to scope the policy to the role it was always about. The function
-- begins `auth.uid() is not null`, so for an anonymous caller it could only ever
-- have returned false — the policy had nothing to contribute to an anonymous
-- read and should never have been consulted for one. `TO authenticated` says so,
-- and the grant stays revoked, so the narrowness the original migration wanted is
-- preserved rather than traded away.
--
-- Granting EXECUTE to `anon` would also have made the error go away. It is the
-- worse fix: it would leave a signed-out visitor able to call a function about
-- other people's collaborations, to be told false every time, for no reason
-- beyond making a policy evaluable that does not apply to them.
-- ---------------------------------------------------------------------------

alter policy profiles_select_trip_mates on public.profiles to authenticated;

comment on policy profiles_select_trip_mates on public.profiles is
  'Lets collaborators see each other''s profiles. Scoped TO authenticated: the '
  'function behind it derives the caller from auth.uid() and is revoked from '
  'anon, so evaluating it for a signed-out reader errored the whole table read.';
