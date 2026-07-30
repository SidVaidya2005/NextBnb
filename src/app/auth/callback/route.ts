import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/utils'

/**
 * OAuth redirect handler: exchanges the authorization code for a session and
 * returns the user to wherever they were headed before signing in.
 *
 * This is the third of the three redirect allow-lists in the OAuth hop (Google
 * -> Supabase -> here); see architecture.md for the other two.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))
  const providerError = searchParams.get('error')

  // Behind a load balancer (Render) `origin` is the internal address, so the
  // forwarded host is the only way back to the URL the user actually typed.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const base =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? origin
      : `https://${forwardedHost}`

  // Declining at the Google consent screen is a normal choice, not a failure —
  // send them home quietly rather than showing an error.
  if (providerError === 'access_denied') {
    return NextResponse.redirect(`${base}/`)
  }

  if (providerError) {
    // `error` is attacker-controlled the same way `next` is — anyone can hit this
    // route directly — so the code is stripped to the RFC 6749 shape and capped
    // before it reaches the log, rather than writing an arbitrary string there.
    const errorCode = providerError.replace(/[^a-z_]/gi, '').slice(0, 64) || 'unrecognized'
    console.error('[auth/callback] provider returned an error:', errorCode)
    return NextResponse.redirect(`${base}/?signin=error`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${base}${next}`)
    }
    console.error('[auth/callback] code exchange failed:', error.message)
  }

  return NextResponse.redirect(`${base}/?signin=error`)
}
