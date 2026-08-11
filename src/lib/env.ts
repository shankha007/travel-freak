import { z } from 'zod'

/**
 * Validated environment access.
 *
 * Reading env vars through these helpers means a missing or malformed value
 * fails loudly at startup with a useful message, rather than surfacing later as
 * a confusing runtime error deep inside the Supabase client.
 *
 * Note the `process.env.X` references are written out in full rather than
 * indexed dynamically — Next.js inlines public vars at build time by static
 * analysis, so `process.env[name]` would not be replaced in client bundles.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, { error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required' }),
})

let cachedPublicEnv: z.infer<typeof publicSchema> | null = null

/** Env available in both server and browser bundles. */
export function publicEnv() {
  if (cachedPublicEnv) return cachedPublicEnv

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment. Copy .env.local.example to .env.local and fill it in.\n` +
        parsed.error.issues.map((i) => `  - ${i.message}`).join('\n')
    )
  }

  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}

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
