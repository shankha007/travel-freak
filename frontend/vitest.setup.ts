import '@testing-library/jest-dom/vitest'

/**
 * The two env vars `publicEnv()` treats as required.
 *
 * Set here rather than per test file because a unit test that happens to reach a
 * module reading env should not have to know that it does — and because the
 * alternative, a `.env.test` committed to the repo, would be a second set of
 * values to keep in step with `.env.local.example`.
 *
 * Deliberately only the required pair: every optional var stays unset, so a test
 * asserting the unconfigured behaviour of one — the CSP allowing no analytics
 * origin, the maps drawing their own basemap — is asserting the default rather
 * than something arranged here. A test that wants one set does it itself.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
