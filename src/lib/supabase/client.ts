import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Supabase client for Client Components.
 *
 * Uses the anon key and always operates as the signed-in user, so every query
 * is subject to Row Level Security. This is the only Supabase client that may
 * appear in a browser bundle.
 */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
