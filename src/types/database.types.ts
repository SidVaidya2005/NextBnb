// ============================================================================
// PLACEHOLDER — regenerated wholesale in Feature 02 via the Supabase MCP
// `generate_typescript_types` once the real schema + RLS exist.
//
// Until then this holds the MINIMUM shape needed for the Supabase clients and
// the /api/sign-cloudinary ownership check (`listings.id` / `listings.host_id`)
// to typecheck. Do not build on this — it is intentionally incomplete and will
// be overwritten. Row shapes are always generated, never hand-maintained.
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      listings: {
        Row: {
          id: string
          host_id: string
        }
        Insert: {
          id?: string
          host_id: string
        }
        Update: {
          id?: string
          host_id?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
