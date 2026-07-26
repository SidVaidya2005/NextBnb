import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canCancelBooking, coverPhotoOf, tripSection } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type BookingStatus = Database['public']['Enums']['booking_status']

/**
 * The listing a trip points at, or `null` when the viewer may no longer see it.
 *
 * **`null` is a state the card renders, not a row it drops.** `listing_id` is a
 * NOT NULL foreign key, so postgrest-js types this embed as always-present and
 * TypeScript will never ask about it — but RLS disagrees at runtime, exactly as
 * it does for `favorites` (see `toFavoriteCards`). A host who unpublishes a stay
 * someone has booked leaves that guest holding a booking whose `listings` embed
 * comes back null.
 *
 * `/favorites` drops those rows, and that is right for a saved listing. Here it
 * would be wrong twice over: the guest still holds the reservation, and the
 * Cancel control lives on the card that would have been dropped.
 */
export type TripListing = {
  id: string
  title: string
  city: string
  country: string
  coverUrl: string | null
  /** Cloudinary id of the cover, or null for an external (seed) photo. */
  coverPublicId: string | null
}

/** One reservation as `/trips` renders it. */
export type TripData = {
  id: string
  checkIn: string
  checkOut: string
  guestsCount: number
  nights: number
  /** Integer **cents** — the stored snapshot, never recomputed from the listing. */
  total: number
  status: BookingStatus
  /** Null when the listing is no longer visible to this guest. */
  listing: TripListing | null
  /** Whether the cancel control renders. Mirrors the UPDATE policy's window. */
  canCancel: boolean
}

export type GuestTrips = {
  /** Confirmed and not yet finished, soonest first. */
  upcoming: TripData[]
  /** Everything else — finished stays and every cancellation — most recent first. */
  past: TripData[]
}

// A defensive ceiling, not pagination — the same posture as `MAX_LISTINGS`.
// Revisit when a real guest can plausibly exceed it.
const MAX_TRIPS = 100

/**
 * The current user's reservations **as a guest**, split into upcoming and past.
 *
 * **The `guest_id` filter is load-bearing, and this is the one place in the
 * project where leaning on RLS instead would be wrong.** `getFavorites`
 * deliberately omits its `user_id` filter because the `favorites` policy is
 * `user_id = auth.uid()` and nothing else, so the policy alone already returns
 * exactly the caller's rows. The `bookings` SELECT policy is **broader**:
 *
 *     guest_id = auth.uid() OR <the listing's host> OR is_admin()
 *
 * Copying the favorites pattern here would put every reservation on a user's own
 * listings into their Trips — F14's screen, leaking into F13's — and would hand
 * an admin the entire table. Nothing would error; the page would simply answer a
 * different question. The filter is for the feature, not for security, and RLS
 * remains the backstop underneath it.
 *
 * Cancelled bookings are **not** filtered out: a guest who cancels needs to see
 * that it worked, and `tripSection` files them under past whatever their dates.
 */
export async function getGuestBookings(): Promise<GuestTrips> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  // `src/proxy.ts` guards /trips, so this is a belt-and-braces branch rather
  // than a reachable state — but a query that would otherwise return *someone*
  // else's rows must not depend on the proxy being correct.
  if (!user) return { upcoming: [], past: [] }

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, check_in, check_out, guests_count, nights, total, status, listings(id, title, city, country, listing_photos(url, public_id, is_cover, position))',
    )
    .eq('guest_id', user.id)
    .limit(MAX_TRIPS)

  if (error) {
    console.error('[queries/bookings] getGuestBookings failed:', error.message)
    return { upcoming: [], past: [] }
  }

  const upcoming: TripData[] = []
  const past: TripData[] = []

  // "Today" is decided **once, here on the server**, for the reason F11 recorded
  // on `getOwnListingAvailability`: computing it in the component would evaluate
  // it during the server render and again during hydration, which is a mismatch
  // waiting for a midnight page load.
  const today = new Date()

  for (const row of data ?? []) {
    const trip = toTrip(row, today)
    if (tripSection(row, today) === 'upcoming') {
      upcoming.push(trip)
    } else {
      past.push(trip)
    }
  }

  return {
    // Soonest stay first — the next thing the guest is doing.
    upcoming: upcoming.sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    // Most recent first — the stay they are most likely looking for, and the
    // order F15's "leave a review" prompt will want.
    past: past.sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
  }
}

/** The row shape `getGuestBookings` selects, reduced to one trip. */
type TripRow = {
  id: string
  check_in: string
  check_out: string
  guests_count: number
  nights: number
  total: number
  status: BookingStatus
  listings: {
    id: string
    title: string
    city: string
    country: string
    listing_photos: {
      url: string
      public_id: string | null
      is_cover: boolean
      position: number
    }[]
  } | null
}

/**
 * One booking row → one trip.
 *
 * Deliberately **not** `toListingCard`. That shape carries a rating and a
 * favorited flag, neither of which a reservation shows, and reusing it would
 * mean selecting `reviews` and `favorites` on every trip to fill fields nothing
 * renders.
 */
function toTrip(row: TripRow, today: Date): TripData {
  const cover = row.listings ? coverPhotoOf(row.listings.listing_photos) : null

  return {
    id: row.id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestsCount: row.guests_count,
    nights: row.nights,
    total: row.total,
    status: row.status,
    listing: row.listings
      ? {
          id: row.listings.id,
          title: row.listings.title,
          city: row.listings.city,
          country: row.listings.country,
          coverUrl: cover?.url ?? null,
          coverPublicId: cover?.public_id ?? null,
        }
      : null,
    canCancel: canCancelBooking(row, today),
  }
}
