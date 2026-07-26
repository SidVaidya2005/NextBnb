'use server'

import { parseISO } from 'date-fns'
import { revalidatePath } from 'next/cache'

import { getListingOccupiedRanges } from '@/lib/queries/listings'
import { createClient } from '@/lib/supabase/server'
import {
  bookedNightsRange,
  nightsBetween,
  priceBreakdown,
  rangesOverlap,
  todayISO,
} from '@/lib/utils'
import { createBookingSchema } from '@/lib/validations/bookings'
import type { ActionResult } from '@/lib/utils'

/** The listing fields a reservation is priced and validated against. */
type BookableListing = {
  id: string
  hostId: string
  isPublished: boolean
  /** Integer cents. */
  pricePerNight: number
  /** Integer cents. */
  cleaningFee: number
  minNights: number
  maxGuests: number
}

/**
 * Reserve a listing — Instant Book, so the row is `confirmed` on creation and
 * those nights are immediately gone for everyone else.
 *
 * **Read the enforcement split before changing anything here.** The database
 * independently guarantees three of these rules and *none* of the other four:
 *
 * | Rule | Enforced by |
 * | ---- | ----------- |
 * | Guest is not the host; listing is published | `bookings_insert_own_not_own_listing` |
 * | No two confirmed stays overlap | `bookings_no_overlap` (btree_gist, half-open) |
 * | `guests_count` 1–16, `check_out > check_in` | table check constraints |
 * | **`min_nights`** | this action only |
 * | **`guests_count <= listing.max_guests`** | this action only |
 * | **not in the past** | this action only |
 * | **no overlap with a host's `blocked_dates`** | this action only |
 *
 * That last one is the notable gap: no constraint can span two tables, so a guest
 * booking in the same instant a host blocks the same nights can still land under
 * the block. The race is accepted and benign — it is F11's accepted race seen from
 * the other side, and `unavailable_listing_ids` unions both halves, so search
 * excludes the listing either way and nobody's stay is erased.
 *
 * **The availability re-check goes through the RPC, not through `bookings`.** This
 * action runs as the *guest*, and the `bookings` SELECT policy admits only the
 * guest, the listing's host and admins — so reading the table here returns zero
 * rows for someone else's listing and would conclude every night is free. That is
 * F06's finding arriving inside the write path. It reuses the query module's
 * `getListingOccupiedRanges` rather than repeating the `.rpc()` call, which is a
 * first for an action in this project and deliberate: it is the identical question
 * the listing page asks, and a second call site is how the calendar a guest reads
 * and the rule that refuses them drift apart.
 */
export async function createBooking(
  input: unknown,
): Promise<ActionResult<{ id: string; total: number }>> {
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Please check those dates and guest count.' }
  }

  const { listingId, checkIn, checkOut, guests } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to book.' }

  const listing = await bookableListing(supabase, listingId)
  if (listing === null) {
    return { ok: false, error: 'That listing could not be found.' }
  }

  // Before the published check, because it is the more useful answer for a host
  // looking at their own draft — and it is a rule the INSERT policy also holds.
  if (listing.hostId === user.id) {
    return { ok: false, error: 'You cannot book your own listing.' }
  }

  if (!listing.isPublished) {
    return { ok: false, error: 'That listing is not accepting reservations.' }
  }

  // **Strict, deliberately inverting F10's and F11's one-day-wide cutoffs.** Those
  // widened because the harmless error was refusing; here refusing is *also* the
  // harmless direction, and strictness is what refuses. A stay accepted with a
  // past check-in can never be cancelled — `bookings_update_cancel_own_or_admin`
  // requires `check_in >= current_date` — so leniency would hand the guest a
  // reservation they cannot get out of. Re-picking costs them one click.
  if (checkIn < todayISO()) {
    return { ok: false, error: 'Those dates have already passed.' }
  }

  const nights = nightsBetween(parseISO(checkIn), parseISO(checkOut))

  if (nights < listing.minNights) {
    return {
      ok: false,
      error: `This place has a ${listing.minNights}-night minimum stay.`,
    }
  }

  // The per-listing cap. The table only checks 1–16, so this is the only thing
  // standing between an over-capacity request and a stored booking.
  if (guests > listing.maxGuests) {
    return {
      ok: false,
      error: `This place sleeps at most ${listing.maxGuests} ${
        listing.maxGuests === 1 ? 'guest' : 'guests'
      }.`,
    }
  }

  const occupied = await getListingOccupiedRanges(listingId)
  // `null` is "the check failed", not "nothing is booked" — booking on an
  // unverified calendar is the one outcome worth refusing outright.
  if (occupied === null) {
    return {
      ok: false,
      error: 'Availability could not be confirmed just now. Please try again.',
    }
  }

  // The candidate stay converted to the same inclusive model the occupancy list
  // speaks in — `bookedNightsRange`'s `- 1` is what keeps a same-day turnover
  // legal here as well as in the database.
  const requested = bookedNightsRange({ check_in: checkIn, check_out: checkOut })
  if (occupied.some((range) => rangesOverlap(requested, range))) {
    return { ok: false, error: 'Those dates are no longer available.' }
  }

  const price = priceBreakdown({
    nights,
    pricePerNight: listing.pricePerNight,
    cleaningFee: listing.cleaningFee,
  })

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      listing_id: listingId,
      guest_id: user.id,
      check_in: checkIn,
      check_out: checkOut,
      guests_count: guests,
      nights,
      // Instant Book: confirmed at creation, no pending or host-approval state.
      status: 'confirmed',
      // The snapshot. Never recomputed from the listing afterwards — the host may
      // edit the price, and this is what the guest agreed to.
      price_per_night: listing.pricePerNight,
      cleaning_fee: price.cleaningFee,
      service_fee: price.serviceFee,
      total: price.total,
    })
    .select('id, total')
    .single()

  if (error) {
    // 23P01 is the exclusion constraint: another guest's stay landed on these
    // nights between the check above and this insert. That is the race the
    // constraint exists for, and it is the same answer the check gives.
    if (error.code === '23P01') {
      return { ok: false, error: 'Those dates are no longer available.' }
    }
    // 42501 is RLS: the host unpublished the listing (or it became theirs) while
    // the guest was deciding. "Try again" would be a lie, so it says what changed.
    if (error.code === '42501') {
      return { ok: false, error: 'That listing is no longer accepting reservations.' }
    }
    console.error('[actions/bookings] createBooking failed:', error.message)
    return { ok: false, error: 'That booking could not be completed. Please try again.' }
  }

  revalidatePath('/trips')
  // Those nights are now taken, so the listing's own calendar has changed.
  revalidatePath(`/listings/${listingId}`)

  // The **stored** total goes back, not the one the widget computed. They agree
  // unless the host edited the price mid-decision, and in that case what the
  // confirmation shows should be what the row holds.
  return { ok: true, data: { id: data.id, total: data.total } }
}

/**
 * The listing a reservation is being priced against, or `null` when the caller
 * cannot see it.
 *
 * Deliberately **not** `host_id`-scoped — that is the shape every host-side action
 * uses (`ownPhotos`, `ownOccupancy`), and this is its opposite: the caller must
 * *not* be the host. The `listings` SELECT policy does the filtering, so a draft
 * comes back only to its own host (who is then refused for self-booking) and to
 * admins, and to everyone else this is simply "not found".
 */
async function bookableListing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
): Promise<BookableListing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, host_id, is_published, price_per_night, cleaning_fee, min_nights, max_guests')
    .eq('id', listingId)
    .maybeSingle()

  if (error) {
    console.error('[actions/bookings] bookableListing failed:', error.message)
    return null
  }
  if (!data) return null

  return {
    id: data.id,
    hostId: data.host_id,
    isPublished: data.is_published,
    pricePerNight: data.price_per_night,
    cleaningFee: data.cleaning_fee,
    minNights: data.min_nights,
    maxGuests: data.max_guests,
  }
}
