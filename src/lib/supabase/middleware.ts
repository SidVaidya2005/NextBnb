import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/trips', '/favorites', '/messages', '/host', '/admin']

/**
 * Refreshes the auth session cookie on every request and redirects
 * unauthenticated users away from protected routes. The returned response
 * carries the refreshed cookies — the caller (src/proxy.ts) MUST return it
 * as-is so they are preserved.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Feature 01 skipped the refresh when credentials were absent so the app could
  // boot on placeholder env. Now that this function is the only thing standing
  // between a signed-out visitor and every protected route, that silence would
  // disable route protection on a typo'd env var. Fail loud instead.
  if (!isConfigured(url) || !isConfigured(anonKey)) {
    const missing = [
      !isConfigured(url) && 'NEXT_PUBLIC_SUPABASE_URL',
      !isConfigured(anonKey) && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(', ')

    throw new Error(
      `[supabase/middleware] Missing ${missing}. Route protection cannot run — set it in .env.local (see .env.example).`,
    )
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      // See server.ts — annotate from the library type; strict TS can't infer
      // this callback param across createServerClient's two cookie overloads.
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANT: getUser() must be called to refresh the token. Do not add logic
  // between client creation and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.searchParams.set('signin', 'required')
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

// True only when the env value is present and non-empty (placeholder/omitted
// values from .env.example resolve to '' or undefined).
function isConfigured(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
