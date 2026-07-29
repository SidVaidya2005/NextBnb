'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { RatingInput } from '@/components/ui/RatingInput'
import { StarRating } from '@/components/ui/StarRating'
import { Textarea } from '@/components/ui/Textarea'
import { createReview, deleteReview } from '@/lib/actions/reviews'
import { useFocusWhen } from '@/lib/hooks/useFocusWhen'
import { MAX_REVIEW_COMMENT } from '@/lib/validations/reviews'
import type { TripData } from '@/lib/queries/bookings'

type Props = {
  bookingId: string
  review: TripData['review']
  canReview: boolean
  /** Every control names its trip — see the note below. */
  tripLabel: string
}

/**
 * The review half of a trip card: the form for a finished stay, or the review
 * already posted for it, with the delete that is the only way to change one.
 *
 * **One component, two states, because they are the same slot.** A stay is
 * reviewable or reviewed, never both (`canReviewBooking` returns false once a
 * review exists), so splitting them into two components would put the same
 * decision in `TripCard` as well as here.
 *
 * **Reviews are immutable, so "edit" is delete-and-re-post.** Migration `0006`
 * revokes UPDATE on `reviews` outright and no policy grants it — this is not a
 * feature that was skipped, it is a shape the schema forbids. Deleting returns
 * the form, which is the whole re-post path.
 *
 * **`useState` + `useTransition`, not react-hook-form**, matching
 * `CancelTripButton` beside it and `BookingWidget`. There is nothing left for a
 * resolver to catch: a radio group cannot emit a rating outside 1–5, `maxLength`
 * caps the comment at the schema's own bound, and Post stays disabled until a
 * rating is chosen. The action still `safeParse`s what arrives.
 *
 * **Every control names its trip.** `/trips` renders one of these per booking,
 * so a bare "Post review" would match N times and any spec locating it would hit
 * a strict-mode violation — the trap F05, F07, F08, F09, F10 and F13 each met.
 * It is also the correct accessibility answer.
 *
 * **`router.refresh()` rather than local state**, as `CancelTripButton` does:
 * `createReview` revalidates `/trips`, the page being looked at, and a posted
 * review has to swap this whole slot — not something optimistic state can do.
 */
export function TripReview({ bookingId, review, canReview, tripLabel }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const confirmDeleteRef = useRef<HTMLButtonElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)

  useFocusWhen(confirmingDelete, confirmDeleteRef)
  useFocusWhen(!confirmingDelete, deleteTriggerRef)

  function onPost() {
    if (rating === null) return
    setError(null)
    startTransition(async () => {
      const result = await createReview({ bookingId, rating, comment })
      if (!result.ok) {
        // Most often "you have already reviewed this stay" (a second tab) or
        // the policy's timing refusal. Showing it beats a silent no-op.
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function onDelete() {
    if (!review) return
    setError(null)
    startTransition(async () => {
      const result = await deleteReview({ reviewId: review.id })
      if (!result.ok) {
        setError(result.error)
        setConfirmingDelete(false)
        return
      }
      router.refresh()
    })
  }

  // **`canReview` is asked first, and the order is load-bearing.** Testing
  // `review` first looks equivalent — the two are mutually exclusive, because
  // `canReviewBooking` returns false once a review exists — but it makes this
  // component enforce one-per-booking a second time, which means the rule in
  // `canReviewBooking` can be deleted with nothing failing. The gate proof found
  // exactly that. Asking `canReview` first leaves one implementation of the rule,
  // and a bug in it surfaces as a form on a reviewed stay rather than silently.
  if (!canReview && review) {
    return (
      <div className="border-t border-hairline pt-3">
        <p className="text-sm font-medium text-ink">Your review</p>
        <StarRating rating={review.rating} className="mt-1.5" starClassName="size-4" />

        {review.comment && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-body">
            {review.comment}
          </p>
        )}

        <div className="mt-3">
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                ref={confirmDeleteRef}
                variant="secondary"
                className="border-error text-error"
                disabled={pending}
                aria-label={`Confirm deleting your review of ${tripLabel}`}
                onClick={onDelete}
              >
                {pending ? 'Deleting…' : 'Confirm deletion'}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                aria-label={`Keep your review of ${tripLabel}`}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep it
              </Button>
            </div>
          ) : (
            <Button
              ref={deleteTriggerRef}
              variant="secondary"
              disabled={pending}
              aria-label={`Delete your review of ${tripLabel}`}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete review
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (!canReview) return null

  const commentId = `review-comment-${bookingId}`

  return (
    <div className="border-t border-hairline pt-3">
      <RatingInput
        name={`review-rating-${bookingId}`}
        value={rating}
        onChange={setRating}
        // "Your rating of …", not "Rate your stay at …": `tripLabel` falls back
        // to "your stay on <dates>" when the listing is gone, and only the
        // former stays grammatical in both cases.
        legend={`Your rating of ${tripLabel}`}
        disabled={pending}
      />

      <div className="mt-3">
        <label htmlFor={commentId} className="mb-1.5 block text-sm font-medium text-ink">
          Tell other guests about it{' '}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <Textarea
          id={commentId}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          // The schema's own bound, so the client cannot produce input the
          // action would reject — there is no resolver here to catch it.
          maxLength={MAX_REVIEW_COMMENT}
          disabled={pending}
          placeholder="What should the next guest know?"
        />
      </div>

      <div className="mt-3">
        <Button
          disabled={pending || rating === null}
          aria-label={`Post your review of ${tripLabel}`}
          onClick={onPost}
        >
          {pending ? 'Posting…' : 'Post review'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
