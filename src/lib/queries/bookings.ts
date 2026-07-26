import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canCancelBooking, coverPhotoOf, hostEarnings, tripSection } from '@/lib/utils'
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

/** The listing a reservation is on, from the host's side. Never null — see below. */
export type ReservationListing = {
  id: string
  title: string
  city: string
  country: string
  coverUrl: string | null
  /** Cloudinary id of the cover, or null for an external (seed) photo. */
  coverPublicId: string | null
  /**
   * A host may unpublish a listing that already has reservations, and those
   * reservations stand. The row says so rather than hiding it: the `bookings`
   * SELECT policy's host branch carries no `is_published` condition, so these are
   * exactly as readable as any other — and a stay the host still owes is the last
   * thing to drop off their screen.
   */
  isPublished: boolean
}

/** Who booked, as a host sees them. */
export type ReservationGuest = {
  /** Falls back to a neutral label rather than rendering an empty line. */
  name: string
  avatarUrl: string | null
}

/** One reservation as `/host/reservations` renders it. */
export type HostReservationData = {
  id: string
  checkIn: string
  checkOut: string
  guestsCount: number
  nights: number
  /** Integer **cents** — what the guest paid, snapshot at booking time. */
  total: number
  /** Integer **cents** — the platform's cut, deducted from `total`. */
  serviceFee: number
  /** Integer **cents** — `total - serviceFee`; what this stay earns the host. */
  earnings: number
  status: BookingStatus
  listing: ReservationListing
  guest: ReservationGuest
}

export type HostReservations = {
  /** Confirmed and not yet finished, soonest first. */
  upcoming: HostReservationData[]
  /** Everything else — finished stays and every cancellation — most recent first. */
  past: HostReservationData[]
  /**
   * True when this user hosts no listings at all, as opposed to hosting listings
   * that simply have no bookings yet. Both render empty, and they are not the same
   * problem — one wants "list your place", the other wants "nothing booked yet".
   */
  hostsNothing: boolean
}

// A defensive ceiling, not pagination — the same posture as `MAX_TRIPS`.
// TODO: paginate host reservations once a single host can plausibly exceed this.
const MAX_RESERVATIONS = 200

const NO_RESERVATIONS: HostReservations = { upcoming: [], past: [], hostsNothing: true }

/**
 * Every reservation across the listings the current user **hosts**.
 *
 * **The `listing_id` scoping is load-bearing, and deleting it does not fail
 * closed.** The `bookings` SELECT policy is
 *
 *     guest_id = auth.uid() OR <the listing's host> OR is_admin()
 *
 * so an unscoped read here returns this user's own *trips* as well — F13's leak
 * arriving from the other direction — plus the entire table for an admin. Nothing
 * errors; the page just answers a different question. `getGuestBookings` filters
 * `guest_id` for the mirror-image reason, and the two filters together are what
 * keep F13's screen and this one distinct. RLS is the backstop underneath both.
 *
 * **Two queries, deliberately.** The scope is "bookings whose *listing* I host",
 * which is a condition on the joined table. Reading own listing ids first and
 * filtering `.in('listing_id', …)` expresses that with the ordinary filters used
 * everywhere else in this module, rather than PostgREST embedded-column filtering
 * (`listings!inner(...)` + `.eq('listings.host_id', …)`) that appears nowhere else
 * in the project. The id read is deliberately **unlimited**: it defines the scope,
 * so a ceiling there would silently drop whole listings' reservations rather than
 * merely truncating a list.
 *
 * Cancelled reservations are **not** filtered out — a host needs the record that
 * explains why dates freed, and `tripSection` files them under past regardless of
 * their dates.
 */
export async function getHostReservations(): Promise<HostReservations> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  // `src/proxy.ts` guards /host/**, so this is belt-and-braces — but a query that
  // would otherwise be unscoped must not depend on the proxy being correct.
  if (!user) return NO_RESERVATIONS

  const { data: owned, error: ownedError } = await supabase
    .from('listings')
    .select('id')
    .eq('host_id', user.id)

  if (ownedError) {
    console.error('[queries/bookings] getHostReservations listings failed:', ownedError.message)
    // Not `hostsNothing` — we failed to find out. Claiming the host owns nothing
    // would invite them to list their first place while holding live bookings.
    return { upcoming: [], past: [], hostsNothing: false }
  }

  const listingIds = (owned ?? []).map((listing) => listing.id)
  // Short-circuit rather than filter on an empty set: postgrest renders
  // `.in('listing_id', [])` as `in.()`, which is a SQL syntax error — the same
  // trap `library-docs.md` records for the availability `.not(...)` call.
  if (listingIds.length === 0) return NO_RESERVATIONS

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, check_in, check_out, guests_count, nights, total, service_fee, status, listings(id, title, city, country, is_published, listing_photos(url, public_id, is_cover, position)), guest:profiles!bookings_guest_id_fkey(full_name, avatar_url)',
    )
    .in('listing_id', listingIds)
    // Newest check-in first, so `MAX_RESERVATIONS` truncates the deep past rather
    // than the future. Ordering ascending here would make the ceiling drop the
    // arrivals a host actually needs while keeping years of history.
    .order('check_in', { ascending: false })
    .limit(MAX_RESERVATIONS)

  if (error) {
    console.error('[queries/bookings] getHostReservations failed:', error.message)
    return { upcoming: [], past: [], hostsNothing: false }
  }

  const upcoming: HostReservationData[] = []
  const past: HostReservationData[] = []

  // "Today" is decided once, here on the server — F11's note on
  // `getOwnListingAvailability`, for the same hydration-mismatch reason.
  const today = new Date()

  for (const row of data ?? []) {
    const reservation = toReservation(row)
    // Unreachable: every id came from a listing this user hosts, so the embed
    // cannot be RLS-filtered. Logged rather than silently skipped, because if it
    // ever fires the scoping set and the policy have stopped agreeing.
    if (!reservation) {
      console.error('[queries/bookings] getHostReservations: booking with no readable listing')
      continue
    }

    if (tripSection(row, today) === 'upcoming') {
      upcoming.push(reservation)
    } else {
      past.push(reservation)
    }
  }

  return {
    // Soonest arrival first — the next guest through the door.
    upcoming: upcoming.sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    past: past.sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
    hostsNothing: false,
  }
}

/** The row shape `getHostReservations` selects, reduced to one reservation. */
type ReservationRow = {
  id: string
  check_in: string
  check_out: string
  guests_count: number
  nights: number
  total: number
  service_fee: number
  status: BookingStatus
  listings: {
    id: string
    title: string
    city: string
    country: string
    is_published: boolean
    listing_photos: {
      url: string
      public_id: string | null
      is_cover: boolean
      position: number
    }[]
  } | null
  /**
   * Hand-written `| null` for F08's reason — postgrest-js types a to-one embed on
   * a NOT NULL FK as never-null and TypeScript will never ask — even though this
   * one genuinely cannot be null: `profiles` is publicly readable, so no policy
   * can filter it away.
   */
  guest: { full_name: string | null; avatar_url: string | null } | null
}

/** One booking row → one reservation, or `null` if its listing is unreadable. */
function toReservation(row: ReservationRow): HostReservationData | null {
  if (!row.listings) return null

  const cover = coverPhotoOf(row.listings.listing_photos)

  return {
    id: row.id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestsCount: row.guests_count,
    nights: row.nights,
    total: row.total,
    serviceFee: row.service_fee,
    earnings: hostEarnings({ total: row.total, serviceFee: row.service_fee }),
    status: row.status,
    listing: {
      id: row.listings.id,
      title: row.listings.title,
      city: row.listings.city,
      country: row.listings.country,
      coverUrl: cover?.url ?? null,
      coverPublicId: cover?.public_id ?? null,
      isPublished: row.listings.is_published,
    },
    // A missing name loses the guest's identity, not the reservation — the stay
    // is the thing the host has to honour. F13's posture on a null listing embed,
    // applied to the other end of the row.
    guest: {
      name: row.guest?.full_name?.trim() || 'Guest',
      avatarUrl: row.guest?.avatar_url ?? null,
    },
  }
}
