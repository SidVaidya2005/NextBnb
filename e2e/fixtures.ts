import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

/**
 * A read-only snapshot of the seeded catalogue, used to compute what search
 * *should* return.
 *
 * Deliberately built from the raw tables rather than from the
 * `unavailable_listing_ids` RPC: asserting the app against the same function it
 * queries would only prove the app calls it. The overlap maths below is an
 * independent second implementation, so a mistake in either one shows up as a
 * disagreement.
 *
 * It needs the service-role key because RLS hides `bookings` from anon — the
 * very constraint that forced the RPC to exist.
 */
export type SeedSnapshot = {
  listings: { id: string; title: string; minNights: number }[]
  /** Confirmed only — cancelled bookings free their dates. */
  bookings: { listingId: string; checkIn: string; checkOut: string }[]
  blocks: { listingId: string; start: string; end: string }[]
}

export async function loadSeedSnapshot(): Promise<SeedSnapshot> {
  process.loadEnvFile('.env.local')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      '[e2e/fixtures] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.',
    )
  }

  if (serviceKey.startsWith('sb_publishable_')) {
    throw new Error(
      '[e2e/fixtures] SUPABASE_SERVICE_ROLE_KEY holds a PUBLISHABLE key. It obeys RLS, so bookings would come back empty ' +
        'and every availability expectation would be silently wrong.',
    )
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const [listings, bookings, blocks] = await Promise.all([
    supabase.from('listings').select('id, title, min_nights').eq('is_published', true),
    supabase.from('bookings').select('listing_id, check_in, check_out').eq('status', 'confirmed'),
    supabase.from('blocked_dates').select('listing_id, start_date, end_date'),
  ])

  const failure = listings.error ?? bookings.error ?? blocks.error
  if (failure) {
    throw new Error(`[e2e/fixtures] could not load the seed snapshot: ${failure.message}`)
  }

  // A publishable key returns [] here rather than erroring — catch that outright
  // instead of letting it read as "nothing is booked".
  if ((bookings.data ?? []).length === 0) {
    throw new Error(
      '[e2e/fixtures] read zero confirmed bookings. Either the seed is missing or the key is not privileged.',
    )
  }

  return {
    listings: (listings.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      minNights: row.min_nights,
    })),
    bookings: (bookings.data ?? []).map((row) => ({
      listingId: row.listing_id,
      checkIn: row.check_in,
      checkOut: row.check_out,
    })),
    blocks: (blocks.data ?? []).map((row) => ({
      listingId: row.listing_id,
      start: row.start_date,
      end: row.end_date,
    })),
  }
}

/**
 * Titles search should return for a stay, by the rules in architecture.md:
 * bookings are half-open `[checkIn, checkOut)`, blocks are inclusive
 * `[start, end]`, and a stay shorter than `min_nights` is not bookable.
 *
 * All dates are `YYYY-MM-DD`, where string comparison is date comparison.
 */
export function expectedAvailableTitles(
  snapshot: SeedSnapshot,
  checkIn: string,
  checkOut: string,
): string[] {
  const nights = nightsBetween(checkIn, checkOut)

  return snapshot.listings
    .filter((listing) => {
      if (listing.minNights > nights) return false

      const booked = snapshot.bookings.some(
        (booking) =>
          booking.listingId === listing.id &&
          overlaps(checkIn, checkOut, booking.checkIn, booking.checkOut),
      )
      if (booked) return false

      return !snapshot.blocks.some(
        (block) =>
          block.listingId === listing.id &&
          // Inclusive [start, end] becomes half-open [start, end+1).
          overlaps(checkIn, checkOut, block.start, addDay(block.end)),
      )
    })
    .map((listing) => listing.title)
}

/** Half-open overlap: touching ends do not overlap, so turnover days are free. */
function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function addDay(iso: string, days = 1): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime()
  const end = new Date(`${checkOut}T00:00:00Z`).getTime()
  return Math.round((end - start) / 86_400_000)
}

/** Today as YYYY-MM-DD, for building forward-looking ranges. */
export function todayISO(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}
