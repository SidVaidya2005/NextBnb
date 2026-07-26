import { differenceInCalendarDays, parseISO } from 'date-fns'
import { z } from 'zod'

import { MAX_GUESTS } from '@/lib/constants'

// -----------------------------------------------------------------------------
// Feature 12 — Instant Book
//
// A stay is HALF-OPEN [checkIn, checkOut): the guest leaves on the checkout day
// and another may arrive that morning. That is why `checkOut > checkIn` here
// while `addBlockSchema`, whose ranges are inclusive, accepts `end === start`.
// See `architecture.md` → Availability Rules.
//
// Field names are camelCase, matching every other schema in this project.
// `architecture.md`'s illustrative snippet uses column names (`listing_id`,
// `check_in`); the action maps to columns at the insert, which is the same
// boundary `SearchBar` maps `checkIn` to `start` at.
// -----------------------------------------------------------------------------

/**
 * A sanity bound on a hostile or fat-fingered payload, not a product rule — the
 * same kind of local ceiling as `MAX_BLOCK_DAYS` in `validations/blockedDates.ts`.
 * `nights` is `check (nights > 0)` in the DB and nothing caps it there.
 */
const MAX_STAY_NIGHTS = 365

/**
 * A requested reservation, as both the booking widget and `createBooking` see it.
 *
 * **This schema is deliberately incomplete, and the gap is not an oversight.**
 * Three of F12's rules cannot live here because they need something the schema
 * cannot see:
 *
 * - **`min_nights` and the listing's own `max_guests`** are per-listing values;
 *   the schema knows only the listing's *id*. `guests` is capped at `MAX_GUESTS`
 *   (16) because that is the DB's flat `guests_count between 1 and 16` check —
 *   the narrower per-listing cap is `createBooking`'s to enforce, and it is the
 *   only thing enforcing it, since no constraint expresses it.
 * - **"not in the past"** would satisfy F09's accept-its-own-output rule in shape
 *   while failing in *time*: the client validates with this schema and posts the
 *   result to an action that validates again, and `todayISO()` is evaluated once
 *   in the browser and once on the server. A stay submitted at 23:59:59 would be
 *   refused at 00:00:01 naming a date the guest picked correctly. The calendar
 *   offers today onward and `createBooking` owns the floor — `addBlockSchema`
 *   made the same call for the same reason.
 *
 * What this *does* guarantee is `parse(parse(x)) === parse(x)`: there is no
 * transform here, so input and output are the same shape, and the unit tests
 * assert it rather than trusting that it stays that way.
 */
export const createBookingSchema = z
  .object({
    listingId: z.uuid(),
    // Zod 4: `z.iso.date()`, not v3's `z.string().date()`. It is a calendar
    // check, not a format regex — it rejects 2026-02-31.
    checkIn: z.iso.date(),
    checkOut: z.iso.date(),
    guests: z
      .number({ message: 'How many guests are coming?' })
      .int('Use a whole number of guests.')
      .min(1, 'At least one guest.')
      .max(MAX_GUESTS, `At most ${MAX_GUESTS} guests.`),
  })
  .refine((stay) => stay.checkOut > stay.checkIn, {
    // Half-open: same-day checkout is zero nights, which `nights > 0` refuses.
    message: 'Checkout has to be after check-in.',
    path: ['checkOut'],
  })
  .refine(
    (stay) =>
      differenceInCalendarDays(parseISO(stay.checkOut), parseISO(stay.checkIn)) <=
      MAX_STAY_NIGHTS,
    {
      message: `A stay can be at most ${MAX_STAY_NIGHTS} nights.`,
      path: ['checkOut'],
    },
  )

export type CreateBookingInput = z.output<typeof createBookingSchema>

// -----------------------------------------------------------------------------
// Feature 13 — Trips
// -----------------------------------------------------------------------------

/**
 * A cancellation request. **Deliberately just the id**, and the emptiness is the
 * design rather than an omission.
 *
 * Everything a cancellation has to be true about — the booking is this user's,
 * it is still `confirmed`, and its check-in has not passed — lives in
 * `bookings_update_cancel_own_or_admin`'s USING clause, and the column grant
 * (`status`, `cancelled_at` only) covers the rest. A schema cannot see any of
 * it: it holds an id, not a row, so it cannot know the status or the dates.
 *
 * Restating the window here would also be `createBookingSchema`'s past-date trap
 * a second time — a rule evaluated in the browser at 23:59:59 and on the server
 * at 00:00:01 refuses a cancellation the guest asked for correctly. The one
 * check that genuinely belongs to `cancelBooking` is that the update **changed a
 * row**; see that action.
 */
export const cancelBookingSchema = z.object({
  bookingId: z.uuid(),
})

export type CancelBookingInput = z.output<typeof cancelBookingSchema>
