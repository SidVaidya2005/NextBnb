import { ListingCard } from '@/components/listings/ListingCard'
import { getPublishedListings } from '@/lib/queries/listings'

/**
 * Grid geometry, shared with `ListingGridSkeleton` so the fallback and the real
 * grid occupy identical space and nothing shifts when the data lands.
 *
 * Columns drop at each breakpoint (1 → 2 → 4) rather than reflowing, per
 * DESIGN.md; the 16px gutter is the card-grid spacing token.
 */
export const LISTING_GRID_CLASSES =
  'grid grid-cols-1 gap-x-4 gap-y-8 tablet:grid-cols-2 desktop:grid-cols-4'

/**
 * The suspending half of the home page: everything that waits on the database
 * lives here, so the page shell around it can paint immediately.
 */
export async function ListingGrid() {
  const listings = await getPublishedListings()

  // A failed read also lands here — the query logs the real error and returns []
  // so one Supabase hiccup renders an empty grid instead of crashing the page.
  if (listings.length === 0) {
    return (
      <div className="rounded-md border border-hairline px-6 py-16 text-center">
        <p className="text-base font-semibold text-ink">No stays to show yet</p>
        <p className="mt-2 text-sm text-muted">
          Once hosts publish their places, they will appear here.
        </p>
      </div>
    )
  }

  return (
    <ul aria-label="Stays" className={LISTING_GRID_CLASSES}>
      {listings.map((listing, index) => (
        <li key={listing.id}>
          {/* The widest layout is 4-up, so the first four cards are the ones
              that can be above the fold and hold the LCP image. */}
          <ListingCard listing={listing} priority={index < 4} />
        </li>
      ))}
    </ul>
  )
}
