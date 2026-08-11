/**
 * Placeholder until the schema migrations are applied.
 *
 * Regenerate with `npm run db:types` (requires `npm run db:start` first).
 * Do not edit by hand — the generated file overwrites this entirely.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
