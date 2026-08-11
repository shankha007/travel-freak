import 'server-only'

/**
 * Server-only environment access.
 *
 * Split out from `@/shared/env` deliberately. Anything exported here is a
 * secret that must never reach a browser bundle, so this module carries the
 * `server-only` marker — importing it from a Client Component is a build
 * error rather than a silent key leak.
 *
 * Public, browser-safe values live in `@/shared/env`.
 */

/**
 * The service-role key, which bypasses RLS.
 *
 * Throws if called anywhere a browser bundle could reach, so a bad import is a
 * build/dev-time failure instead of a silent key leak.
 */
export function serviceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error('serviceRoleKey() was called in the browser. This key must never be shipped.')
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
  return key
}
