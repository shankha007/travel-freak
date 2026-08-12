import { z } from 'zod'

/**
 * Validated environment access for values that are safe in a browser bundle.
 *
 * Server-only secrets (the service-role key) live in `@/server/env`, which is
 * marked `server-only` so it cannot be imported from a Client Component.
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
  // Optional: the maps draw their own basemap from the theme when there is no
  // tile key, which is a designed map rather than an error screen.
  //
  // The unset case is not only "" — `.env.local.example` ships the line as
  // `NEXT_PUBLIC_MAPTILER_KEY=""`, and dotenv hands that through as two literal
  // quote characters. Truthy, so the app spent every map load requesting tiles
  // with a key MapTiler answers 403 to, and the fallback that exists for
  // precisely this case never ran. Anything that is not a plausible key is
  // treated as absent.
  NEXT_PUBLIC_MAPTILER_KEY: z
    .string()
    .optional()
    .transform((v) => {
      const cleaned = v?.trim().replace(/^['"]|['"]$/g, '') ?? ''
      return cleaned.length > 0 ? cleaned : undefined
    }),
})

let cachedPublicEnv: z.infer<typeof publicSchema> | null = null

/** Env available in both server and browser bundles. */
export function publicEnv() {
  if (cachedPublicEnv) return cachedPublicEnv

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_MAPTILER_KEY: process.env.NEXT_PUBLIC_MAPTILER_KEY,
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
