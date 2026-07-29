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
 *
 * **`role="img"` is load-bearing, not decoration.** A bare `<div>` maps to
 * `role="generic"`, and ARIA *prohibits* an accessible name there — so
 * `aria-label` on one is announced by nothing. With every star `aria-hidden`,
 * that made the rating **silent** to a screen reader rather than merely
 * mislabelled, on every review and every trip card. `role="img"` is the correct
 * role for a value composed out of icons: it names the group and keeps the
 * children hidden.
 *
 * This is the same defect `BookingWidget` documents at its `<aside>` — F07 shipped
 * it latent, F12 found and fixed it there, and F15's extraction of this component
 * reintroduced it, because the rule lived in one component's comment rather than
 * anywhere a later author would look. It is now in `code-standards.md`.
 *
 * **Do not "simplify" this back to a plain div**, and note that a Playwright
 * `getByLabel()` will not catch it if you do: that matches the `aria-label`
 * attribute, not the computed accessible name, so it passes against markup no
 * screen reader can read. The specs assert `getByRole('img', { name })` instead,
 * which is the assertion that actually gates this.
 */
export function StarRating({ rating, starClassName = 'size-3.5', className }: Props) {
  return (
    <div
      role="img"
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
