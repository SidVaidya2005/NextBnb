import { describe, it, expect } from 'vitest'

import {
  createReviewSchema,
  deleteReviewSchema,
  MAX_REVIEW_COMMENT,
} from '@/lib/validations/reviews'

const BOOKING_ID = '30000000-0000-4000-b000-000000000008'

const review = (rating: number, comment?: string | null) => ({
  bookingId: BOOKING_ID,
  rating,
  ...(comment === undefined ? {} : { comment }),
})

describe('createReviewSchema', () => {
  it('accepts a rating with a comment', () => {
    const parsed = createReviewSchema.safeParse(review(5, 'Worth the stairs.'))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.comment).toBe('Worth the stairs.')
  })

  it('accepts a star-only review, with no comment field at all', () => {
    // `comment` is nullable in the table, and ReviewsSection already renders a
    // review without one. Requiring prose would quietly bias the average toward
    // guests with something to say.
    const parsed = createReviewSchema.safeParse(review(4))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.comment).toBeNull()
  })

  it('normalises a blank comment to null, not an empty string', () => {
    // The DB column is nullable; '' would be a stored empty review body that
    // `{review.comment && …}` then renders as a missing paragraph either way.
    expect(createReviewSchema.safeParse(review(3, '')).data?.comment).toBeNull()
    expect(createReviewSchema.safeParse(review(3, '   ')).data?.comment).toBeNull()
  })

  it('trims surrounding whitespace off a real comment', () => {
    expect(createReviewSchema.safeParse(review(5, '  Lovely place.  ')).data?.comment).toBe(
      'Lovely place.',
    )
  })

  it('accepts its own output — parse(parse(x)) succeeds', () => {
    // **F09's rule, and the reason `comment` is `.nullish()` rather than
    // `.optional()`.** The trip card validates nothing itself, but the action
    // parses what the client sends, and a re-post of a parsed value must not be
    // rejected. `null` has to be in the accepted *input* set, not only the
    // output set — without it every star-only review would fail on the second
    // parse with a message naming no field.
    const once = createReviewSchema.safeParse(review(4, ''))
    expect(once.success).toBe(true)
    expect(once.data?.comment).toBeNull()

    const twice = createReviewSchema.safeParse(once.data)
    expect(twice.success).toBe(true)
    expect(twice.data).toEqual(once.data)
  })

  it('rejects a rating outside the table check constraint', () => {
    expect(createReviewSchema.safeParse(review(0)).success).toBe(false)
    expect(createReviewSchema.safeParse(review(6)).success).toBe(false)
    expect(createReviewSchema.safeParse(review(-1)).success).toBe(false)
  })

  it('rejects a fractional rating', () => {
    // `rating` is `int` in the table; 4.5 would be a rounded surprise.
    expect(createReviewSchema.safeParse(review(4.5)).success).toBe(false)
  })

  it('rejects a missing rating', () => {
    expect(createReviewSchema.safeParse({ bookingId: BOOKING_ID }).success).toBe(false)
  })

  it('accepts a comment exactly at the cap and rejects one past it', () => {
    expect(
      createReviewSchema.safeParse(review(5, 'x'.repeat(MAX_REVIEW_COMMENT))).success,
    ).toBe(true)
    expect(
      createReviewSchema.safeParse(review(5, 'x'.repeat(MAX_REVIEW_COMMENT + 1))).success,
    ).toBe(false)
  })

  it('rejects a malformed booking id before it can reach Postgres', () => {
    // Otherwise this arrives as a logged 22P02 rather than a returned refusal.
    expect(createReviewSchema.safeParse({ bookingId: 'not-a-uuid', rating: 5 }).success).toBe(
      false,
    )
  })
})

describe('deleteReviewSchema', () => {
  it('accepts a review id', () => {
    expect(
      deleteReviewSchema.safeParse({ reviewId: '40000000-0000-4000-b000-000000000001' })
        .success,
    ).toBe(true)
  })

  it('rejects a malformed id', () => {
    expect(deleteReviewSchema.safeParse({ reviewId: 'nope' }).success).toBe(false)
  })
})
