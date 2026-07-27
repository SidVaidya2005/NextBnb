'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createReviewSchema, deleteReviewSchema } from '@/lib/validations/reviews'
import type { ActionResult } from '@/lib/utils'

/**
 * Post a guest's review of a finished stay.
 *
 * **Read the enforcement split before changing anything here.** As with
 * `cancelBooking`, this action enforces almost none of the rules — but for the
 * opposite reason, and the difference decides how failures surface:
 *
 * | Rule | Enforced by |
 * | ---- | ----------- |
 * | The reviewer is the booking's guest | `reviews_insert_own_completed_booking` |
 * | The stay is `confirmed` and checkout has passed | same policy |
 * | The review's listing is the booking's listing | same policy |
 * | One review per booking | `reviews.booking_id` unique index |
 * | `rating` is 1–5 | table check constraint **and** the schema |
 * | **The comment length cap** | this action's schema only |
 *
 * **An INSERT that fails `WITH CHECK` raises `42501`; it does not filter.** That
 * is the whole difference from F13. `cancelBooking` needs a zero-row check
 * because a refused UPDATE returns `{ error: null }` and looks like success — a
 * refused INSERT cannot, because Postgres raises. So the work here is *mapping*
 * error codes to sentences a guest can act on, not detecting silence.
 * `deleteReview` below is the other shape again, and needs the zero-row check.
 *
 * **`listing_id` is derived from the booking, never accepted from the client.**
 * The policy requires `reviews.listing_id` to equal the booking's, so a supplied
 * one could only ever match or be refused — which makes it a value to forge for
 * no gain. Reading the booking to get it is **not F06's trap**: the `bookings`
 * SELECT policy admits the guest, the listing's host and admins, so a caller who
 * is none of those reads zero rows and is refused. Absence infers a restriction
 * here, not a permission.
 */
export async function createReview(input: unknown): Promise<ActionResult> {
  const parsed = createReviewSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Please choose a rating and keep your review shorter.' }
  }

  const { bookingId, rating, comment } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to review your stay.' }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, listing_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingError) {
    console.error('[actions/reviews] createReview booking read failed:', bookingError.message)
    return { ok: false, error: 'That review could not be posted. Please try again.' }
  }
  // No row: the booking does not exist, or RLS hid it because it is not this
  // user's to review. Which one is not the caller's business.
  if (!booking) return { ok: false, error: 'That stay could not be found.' }

  const { error } = await supabase.from('reviews').insert({
    booking_id: booking.id,
    listing_id: booking.listing_id,
    reviewer_id: user.id,
    rating,
    comment,
  })

  if (error) {
    // 23505 is the unique index on booking_id: this stay is already reviewed.
    // Reachable without a forged request — two tabs, or a stale page.
    if (error.code === '23505') {
      return { ok: false, error: 'You have already reviewed this stay.' }
    }
    // 42501 is the INSERT policy. It covers "not your booking", "not confirmed",
    // "checkout has not passed" and a listing mismatch with one sentence, which
    // is deliberate: the only one of those a legitimate guest can hit is the
    // timing, and naming the others would confirm someone else's booking exists.
    if (error.code === '42501') {
      return {
        ok: false,
        error: 'You can only review a stay after it has finished.',
      }
    }
    console.error('[actions/reviews] createReview failed:', error.message)
    return { ok: false, error: 'That review could not be posted. Please try again.' }
  }

  revalidatePath('/trips')
  // The listing's average rating and review count have both moved.
  revalidatePath(`/listings/${booking.listing_id}`)

  return { ok: true, data: undefined }
}

/**
 * Remove a review — which, because reviews are immutable, is also how one is
 * edited: delete it and post again.
 *
 * **This is the F13 shape, not the `createReview` shape above.** A DELETE that
 * no policy admits affects zero rows and returns `{ error: null }`, which is
 * indistinguishable from a successful delete. `reviews_delete_own_or_admin` is
 * `reviewer_id = auth.uid() or is_admin()`, so re-checking ownership here would
 * buy nothing the database is not already doing — what only the action can do is
 * notice the delete **matched nothing**. The `.select(...)` and the `!data`
 * branch are the entire guard.
 *
 * The admin half of that policy is what lets F17 reuse this action unchanged for
 * moderation; nothing here needs to know which branch admitted the caller.
 */
export async function deleteReview(input: unknown): Promise<ActionResult> {
  const parsed = deleteReviewSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That review could not be found.' }
  }

  const { reviewId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to manage your reviews.' }

  const { data, error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    // `listing_id` comes back from the deleted row because the revalidation
    // needs it and there is nothing left to read it from afterwards.
    .select('id, listing_id')
    .maybeSingle()

  if (error) {
    console.error('[actions/reviews] deleteReview failed:', error.message)
    return { ok: false, error: 'That review could not be removed. Please try again.' }
  }

  // Zero rows. RLS refused — the review is not this user's, or it is already
  // gone — and said so by returning success with nothing in it.
  if (!data) {
    return { ok: false, error: 'That review could not be removed.' }
  }

  revalidatePath('/trips')
  revalidatePath(`/listings/${data.listing_id}`)

  return { ok: true, data: undefined }
}
