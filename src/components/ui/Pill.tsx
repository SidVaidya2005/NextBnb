import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
}

/**
 * A small status label — "Draft", "Cancelled", "Unpublished".
 *
 * Extracted at F17 because the class string was already living in three places
 * (`HostListingCard`'s Draft, `ReservationCard`'s Cancelled and Unpublished) and
 * the admin tables need three more. That is the same reasoning that pulled
 * `StarRating` out in F15: a duplicated fragment is not a problem until it is
 * several places to drift, and the drift here would be silent — a pill half a
 * shade off reads as a different kind of status rather than as a mistake.
 *
 * DESIGN.md specs no badge component, so this is the existing markup promoted
 * verbatim rather than a new visual idea: `surface-strong` fill, ink text, fully
 * pill radius, 11px semibold. Deliberately not a colour-coded variant set — the
 * palette has one accent and it is reserved for primary CTAs, the search orb and
 * the saved heart.
 */
export function Pill({ children, className }: Props) {
  return (
    <span
      className={cn(
        'rounded-full bg-surface-strong px-2.5 py-1 text-[11px] font-semibold text-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}
