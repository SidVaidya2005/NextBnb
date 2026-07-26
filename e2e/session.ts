import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { Cookie } from '@playwright/test'

import { TEST_USER } from './constants'

type FixtureUser = { email: string; password: string; fullName: string }

/**
 * Mints a NEW Supabase session for a fixture user and returns it as Playwright
 * cookies. Defaults to the primary account; pass `SECOND_USER` for the second.
 *
 * Every call creates an independent session (a fresh `session_id`), which
 * matters: signing out deletes the session row server-side, so any spec that
 * signs out must own its session rather than share the suite's storageState —
 * otherwise it logs out every spec running in parallel beside it.
 *
 * Google consent cannot be driven by Playwright, so the session comes from the
 * email/password provider. The app never surfaces that path, but Supabase Auth
 * issues identical cookies either way, so the proxy refresh, `getUser()` and
 * RLS all behave exactly as they would after a real Google sign-in. **This is
 * also why a Google account added by hand cannot serve as a fixture user** — the
 * suite has no way to complete a consent screen.
 */
export async function mintSessionCookies(
  user: FixtureUser = TEST_USER,
): Promise<Cookie[]> {
  process.loadEnvFile('.env.local')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      '[e2e/session] NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local.',
    )
  }

  // A publishable key in this slot fails later with an opaque "requires a valid
  // Bearer token" and — worse — silently obeys RLS as if it were privileged.
  if (serviceKey.startsWith('sb_publishable_')) {
    throw new Error(
      '[e2e/session] SUPABASE_SERVICE_ROLE_KEY holds a PUBLISHABLE key (sb_publishable_...), not a secret one. ' +
        'Copy the secret key from the Supabase dashboard: Project Settings -> API Keys -> secret (sb_secret_...).',
    )
  }

  const signInClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const signIn = () =>
    signInClient.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    })

  // 1. Try signing in first. On every run after the very first the user already
  //    exists, so this keeps the admin API — and the service-role key — off the
  //    common path entirely.
  let { data, error: signInError } = await signIn()

  // 2. Only provision when the account genuinely is not there yet.
  if (signInError && /invalid login credentials/i.test(signInError.message)) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: createError } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    })

    // "already registered" means a parallel worker won the race — fine.
    if (createError && !/already|exists|registered/i.test(createError.message)) {
      throw new Error(
        `[e2e/session] could not create ${user.email}: ${createError.message}`,
      )
    }

    ;({ data, error: signInError } = await signIn())
  }

  if (signInError || !data.session) {
    throw new Error(
      `[e2e/session] could not sign in ${user.email}: ${signInError?.message ?? 'no session returned'}. ` +
        'If the Supabase email provider has been disabled, re-enable it — this fixture depends on it.',
    )
  }

  // 3. Let @supabase/ssr encode the session into cookies itself. Hand-rolling
  //    the `sb-<ref>-auth-token` format (base64 prefix, chunk splitting) would
  //    drift the moment the library changes it, so drive the real writer with an
  //    in-memory jar and keep whatever it produces.
  const jar: { name: string; value: string }[] = []
  const cookieWriter = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar,
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          const existing = jar.findIndex((c) => c.name === name)
          if (existing >= 0) jar[existing] = { name, value }
          else jar.push({ name, value })
        }
      },
    },
  })

  await cookieWriter.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })

  if (jar.length === 0) {
    throw new Error(
      '[e2e/session] @supabase/ssr wrote no auth cookies — the cookie format may have changed.',
    )
  }

  return jar.map((cookie) => ({
    ...cookie,
    domain: 'localhost',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }))
}
