import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

// The seed (supabase/seed.sql) publishes exactly this many listings. Every E2E
// flow from F06 onward assumes they are there, so failing here — before a
// single browser starts — turns "17 mysterious assertion failures" into one
// sentence naming the actual cause.
const EXPECTED_PUBLISHED_LISTINGS = 24

/**
 * Playwright does not read .env.local the way `next dev` does, so the suite
 * would otherwise run against undefined credentials. process.loadEnvFile is
 * stdlib (Node >=20.12) — deliberately not a `dotenv` dependency.
 *
 * This queries through the anon key on purpose: it verifies what a signed-out
 * browser can actually see, which is what the tests will be asserting against.
 */
export default async function globalSetup() {
  process.loadEnvFile('.env.local')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      '[e2e/global-setup] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from .env.local.',
    )
  }

  const supabase = createClient<Database>(url, anonKey)
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)

  if (error) {
    throw new Error(`[e2e/global-setup] could not reach Supabase: ${error.message}`)
  }

  if ((count ?? 0) < EXPECTED_PUBLISHED_LISTINGS) {
    throw new Error(
      `[e2e/global-setup] expected at least ${EXPECTED_PUBLISHED_LISTINGS} published listings but found ${count ?? 0}. ` +
        'Run supabase/seed.sql against the project, then verify with supabase/tests/seed-verification.sql.',
    )
  }

  console.log(`[e2e/global-setup] seed verified: ${count} published listings visible to anon.`)
}
