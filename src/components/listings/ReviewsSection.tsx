import { Star } from 'lucide-react'

import { Avatar } from '@/components/ui/Avatar'
import { StarRating } from '@/components/ui/StarRating'
import { formatMonthYear } from '@/lib/utils'
import type { ListingReview } from '@/lib/queries/listings'

type Props = {
  rating: number | null
  reviewCount: number
  reviews: ListingReview[]
}

/**
 * Reviews, plus DESIGN.md's `rating-display-card` — the 64px/700 number that is
 * the single typographically loud moment in the whole system.
 *
 * It renders **only** when the listing has reviews. 20 of the 24 published
 * listings have none, so the empty state is the common case, not the edge, and a
 * 64px "New" would be shouting about the absence of information.
 *
 * Stars are ink, never gold — DESIGN.md's `star-rating` token is `#222222`, a
 * deliberate brand choice, and `ListingCard` already renders them the same way.
 */
export function ReviewsSection({ rating, reviewCount, reviews }: Props) {
  if (rating === null || reviews.length === 0) {
    return (
      <section aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-xl font-semibold text-ink">
          Reviews
        </h2>
        <p className="mt-2 text-base text-body">
          No reviews yet — this stay hasn&apos;t been reviewed by a guest.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="sr-only">
        Reviews
      </h2>

      <div className="flex items-center gap-3">
        <Star className="size-7 fill-current text-ink" aria-hidden />
        <p className="text-[64px] font-bold leading-[1.1] tracking-[-1px] text-ink">
          {rating.toFixed(1)}
        </p>
      </div>
      <p className="mt-1 text-base text-body">
        {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
      </p>

      <ul className="mt-8 grid grid-cols-1 gap-x-12 gap-y-8 tablet:grid-cols-2">
        {reviews.map((review) => (
          <li key={review.id}>
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewCard({ review }: { review: ListingReview }) {
  const name = review.author.fullName ?? 'A NextBnb guest'
  const when = formatMonthYear(review.createdAt)

  return (
    <article>
      <div className="flex items-center gap-3">
        <Avatar avatarUrl={review.author.avatarUrl} name={name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-ink">{name}</p>
          {when && <p className="text-sm text-muted">{when}</p>}
        </div>
      </div>

      <StarRating rating={review.rating} className="mt-3" />

      {review.comment && (
        <p className="mt-2 text-base leading-relaxed text-body">{review.comment}</p>
      )}
    </article>
  )
}
