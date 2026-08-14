import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

/**
 * Photos are served from Supabase Storage over signed URLs, so `next/image`
 * needs the storage host allow-listed. The pattern is derived from
 * NEXT_PUBLIC_SUPABASE_URL rather than hardcoded, so the local stack
 * (127.0.0.1:54321) and a hosted project both work without editing this file.
 *
 * `loadEnvConfig` is not optional here: `.env.local` is loaded for the app, but
 * not before this config is evaluated, so without it the URL is undefined, the
 * pattern list comes out empty, and every image 400s with "url parameter is not
 * allowed" — which reads like a broken upload rather than a config gap.
 */
loadEnvConfig(process.cwd())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabase = supabaseUrl ? new URL(supabaseUrl) : null

/**
 * Next 16 refuses to let the image optimizer fetch from a private or loopback
 * address, which is an SSRF guard worth keeping. The local Supabase stack is
 * exactly such an address, so the guard is lifted only when this app is
 * pointed at a local stack — a hosted project is a public https host and never
 * takes this branch.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1']
const usingLocalSupabase = supabase !== null && LOCAL_HOSTS.includes(supabase.hostname)

const nextConfig: NextConfig = {
  /**
   * Every screen behind the login is `force-dynamic`, and the client cache does
   * not retain a dynamic segment at all by default. That makes returning to a
   * page a full server round trip even when you left it four seconds ago —
   * stepping back from a trip to the trip list re-runs the list's queries, and
   * the back button costs as much as the first visit did.
   *
   * Thirty seconds is Next's own pre-15 default and is short enough that the
   * app never feels like it is showing yesterday's data. It is also not the
   * only thing keeping the cache honest: every mutation in `server/actions`
   * calls `revalidatePath`, which drops the affected entries immediately, so an
   * edit is reflected on the next navigation rather than up to 30s later. The
   * window that remains is a change made in another tab or by another device.
   */
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
  images: {
    dangerouslyAllowLocalIP: usingLocalSupabase,
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(':', '') as 'http' | 'https',
            hostname: supabase.hostname,
            port: supabase.port,
            // Signed object URLs only — not the whole storage API surface.
            pathname: '/storage/v1/object/**',
          },
        ]
      : [],
  },
}

export default nextConfig
