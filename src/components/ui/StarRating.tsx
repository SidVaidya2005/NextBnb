import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  /** 1–5, as stored. */
  rating: number
  /** Tailwind size utility for one star. Defaults to the review-list size. */
  starClassName?: string
  className?: string
}

/**
 * A read-only 1–5 star rating.
 *
 * One implementation, two callers — the listing page's review list and the trip
 * card reading a guest's own review back — so the two cannot drift on DESIGN.md's
 * deliberate choice that **stars are ink (`#222222`), never gold**, or on how an
 * unfilled star is drawn. Not a Client Component: it has no state, so it renders
 * inside `ReviewsSection` (server) and `TripReview` (client) alike.
 *
 * The whole row carries one label; the icons are decorative. Five separately
 * announced images would say nothing useful five times.
 */
export function StarRating({ rating, starClassName = 'size-3.5', className }: Props) {
  return (
    <div
      className={cn('flex items-center gap-0.5 text-ink', className)}
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            starClassName,
            index < rating ? 'fill-current' : 'text-hairline',
          )}
          aria-hidden
        />
      ))}
    </div>
  )
}
