import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next 16 renamed the `middleware` file convention to `proxy`, and the export
// with it. The proxy runtime is Node-only — which is what the Supabase client
// wants anyway, so nothing else had to change.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Run on every path except static assets and image files.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
