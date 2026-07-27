import { z } from 'zod'

// -----------------------------------------------------------------------------
// Feature 15 — Reviews & ratings
//
// The unit of a review is the BOOKING, not the listing: `reviews.booking_id` is
// unique, so one stay earns exactly one review, and two stays at the same place
// earn two. That is why nothing here names a listing — `createReview` derives
// `listing_id` from the booking rather than accepting it from the client, both
// because `reviews_insert_own_completed_booking` requires the two to agree and
// because a client-supplied listing id would be a value to forge for no reason.
//
// Reviews are IMMUTABLE (migration `0006` revokes UPDATE outright, and no policy
// grants it), so there is no update schema here and there never should be. To
// change a review, delete it and post again.
// -----------------------------------------------------------------------------

/**
 * The comment cap. Local to this module rather than `constants.ts`, following
 * `MAX_BLOCK_DAYS` and the `MAX_TITLE` family: `constants.ts` holds values the
 * *database* also depends on (property types, amenities, the fee rate), while a
 * text length is this schema's own business.
 *
 * Exported because `TripReview` sets the textarea's `maxLength` from it. That
 * form has no Zod resolver, so the attribute is what stops a client producing
 * input this schema would reject — one number, both places.
 */
export const MAX_REVIEW_COMMENT = 1_000

/**
 * A review as the trip card posts it and `createReview` re-validates it.
 *
 * **`.nullish()` and the transform are what make this schema idempotent**, which
 * is F09's finding and the reason a blank comment is spelled out rather than
 * left to `.optional()`: the value goes `'' → null` on the way through, and the
 * action validates the *result* of that. Without `null` in the accepted input
 * set, every star-only review would parse once and fail the second time with a
 * message naming no field. `validations/listings.ts` → `optionalText` carries
 * the same shape for the same reason; the unit tests assert
 * `parse(parse(x)) === parse(x)` rather than trusting it stays true.
 *
 * `rating` is bounded 1–5 to match the table's `check (rating between 1 and 5)`.
 * That is the one rule here the database also enforces; the cap above is the one
 * rule only this schema enforces.
 */
export const createReviewSchema = z.object({
  bookingId: z.uuid(),
  rating: z
    .number({ message: 'Choose a rating.' })
    .int('Use a whole number of stars.')
    .min(1, 'Choose at least one star.')
    .max(5, 'Five stars is the most you can give.'),
  comment: z
    .string()
    .trim()
    .max(
      MAX_REVIEW_COMMENT,
      `Keep your review under ${MAX_REVIEW_COMMENT} characters.`,
    )
    .nullish()
    .transform((value) =>
      value === undefined || value === null || value === '' ? null : value,
    ),
})

export type CreateReviewInput = z.output<typeof createReviewSchema>

/**
 * Identifies one review to remove. **Deliberately just the id.**
 *
 * Ownership is `reviews_delete_own_or_admin`'s (`reviewer_id = auth.uid() or
 * is_admin()`), and a schema holding an id cannot see who wrote the row anyway.
 * What `deleteReview` alone can do is notice the delete matched **zero rows** —
 * see that action. Same emptiness, and the same reasoning, as
 * `cancelBookingSchema`.
 */
export const deleteReviewSchema = z.object({
  reviewId: z.uuid(),
})

export type DeleteReviewInput = z.output<typeof deleteReviewSchema>
