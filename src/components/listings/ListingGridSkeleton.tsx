import { LISTING_GRID_CLASSES } from '@/components/listings/ListingGrid'

// Enough to fill the tallest supported layout (4-up) a couple of rows deep
// without the fallback itself becoming a long scroll.
const PLACEHOLDER_COUNT = 8

/**
 * Suspense fallback for `ListingGrid`. It reuses the grid's own class string, so
 * the placeholder occupies the same geometry the real cards will — the point of
 * a skeleton is that nothing moves when it is replaced.
 */
export function ListingGridSkeleton() {
  return (
    <div className={LISTING_GRID_CLASSES} aria-hidden>
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-square rounded-md bg-surface-soft" />
          <div className="mt-3 h-4 w-3/4 rounded-sm bg-surface-soft" />
          <div className="mt-2 h-3 w-1/2 rounded-sm bg-surface-soft" />
          <div className="mt-2 h-3 w-1/3 rounded-sm bg-surface-soft" />
        </div>
      ))}
    </div>
  )
}
