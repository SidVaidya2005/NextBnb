'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/utils'

/**
 * Starts the Google OAuth (PKCE) flow and sends the browser to Google.
 *
 * Unlike every other action in this project these two do NOT return an
 * ActionResult: their only outcome is navigation, and `redirect()` signals by
 * throwing NEXT_REDIRECT, so nothing after it runs. Failures redirect with a
 * flag the UI renders rather than returning a message string.
 *
 * Running server-side means the PKCE code verifier cookie is written by the
 * same client that reads it back in /auth/callback.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get('next')?.toString())
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      // We redirect from the server; the SDK must not try to navigate itself.
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    console.error(
      '[actions/auth] signInWithGoogle failed:',
      error?.message ?? 'no authorization URL returned',
    )
    redirect('/?signin=error')
  }

  // Outside the error branch on purpose — redirect() throws, so wrapping it in
  // a try/catch would swallow the navigation.
  redirect(data.url)
}

/**
 * Clears the session cookies and returns the user to the public home page.
 *
 * `scope: 'local'` signs out THIS browser only. The Supabase default ('global')
 * revokes every refresh token the user holds, which would sign them out of
 * their phone because they signed out on a laptop — surprising behaviour for a
 * marketplace. It also keeps parallel E2E workers isolated: sharing one session
 * across specs means a global revocation invalidates the others mid-run.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    console.error('[actions/auth] signOut failed:', error.message)
  }

  // The nav is rendered in the root layout, so the whole layout must re-render
  // to drop the signed-in account menu.
  revalidatePath('/', 'layout')
  redirect('/')
}
