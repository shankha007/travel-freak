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
