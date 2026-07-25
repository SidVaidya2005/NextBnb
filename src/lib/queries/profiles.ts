import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * The signed-in user as the app knows them: the auth identity joined to their
 * `profiles` row. `email` is deliberately not a profiles column (the table is
 * publicly readable), so it comes from the auth user instead.
 */
export type CurrentProfile = Pick<
  Profile,
  'id' | 'full_name' | 'avatar_url' | 'is_admin'
> & { email: string | null }

/**
 * Returns the current user's profile, or null when signed out.
 *
 * Uses getUser() rather than getSession() — every authorization decision on the
 * server revalidates with the auth server. The profiles row (not the Google
 * user_metadata) is the source of truth here because `is_admin` lives only on
 * the row, and because a custom avatar will eventually supersede the Google one.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, is_admin')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[queries/profiles] getCurrentProfile failed:', error.message)
    return null
  }

  return { ...data, email: user.email ?? null }
}

/**
 * Whether anyone is signed in — all the saved heart needs to know.
 *
 * Separate from `getCurrentProfile` so the pages that render hearts skip the
 * `profiles` round trip they have no use for. Callers should `Promise.all` this
 * alongside their real query so it costs no serial latency.
 */
export async function isSignedIn(): Promise<boolean> {
  const supabase = await createClient()

  // getUser(), not getSession() — code-standards.md, and this decides whether a
  // control mutates or sends the visitor to sign in.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user !== null
}
