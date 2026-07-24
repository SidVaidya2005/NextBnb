import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

// Supabase client for Client Components ('use client') only — realtime
// subscriptions and client-side Cloudinary uploads. The other client lives in
// src/lib/supabase/server.ts; never mix them.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
