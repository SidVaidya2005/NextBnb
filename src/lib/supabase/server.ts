import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

// Supabase client for Server Components, server actions, and route handlers.
// Reads/writes session cookies via next/headers. This is one of the ONLY two
// places a Supabase client is constructed (see src/lib/supabase/client.ts).
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // createServerClient has two cookie overloads (getAll/setAll vs the
        // deprecated get/set/remove); strict TS can't infer this param across
        // them, so annotate it from the library's own SetAllCookies type.
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // The middleware refresh handles writing them; safe to ignore.
          }
        },
      },
    },
  )
}
