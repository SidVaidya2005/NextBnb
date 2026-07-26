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
 * The current user's id, or null when signed out.
 *
 * Separate from `getCurrentProfile` so a caller that needs only the *identity*
 * skips the `profiles` round trip it has no use for, and distinct from
 * `isSignedIn` because a boolean cannot answer the question F12's booking widget
 * asks: is the viewer this listing's **host**? Callers should `Promise.all` this
 * alongside their real query so it costs no serial latency.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()

  // getUser(), not getSession() — code-standards.md, and this decides whether a
  // control mutates or sends the visitor to sign in.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}

/**
 * Whether anyone is signed in — all the saved heart needs to know.
 *
 * Defined in terms of `getCurrentUserId` rather than repeating the `getUser()`
 * call, so there is one place the session is read and one place to change if that
 * ever stops being the right way to ask.
 */
export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUserId()) !== null
}
