import Image from 'next/image'
import Link from 'next/link'
import { House, Star } from 'lucide-react'

import { formatPrice } from '@/lib/utils'
import type { ListingCardData } from '@/lib/queries/listings'

type Props = {
  listing: ListingCardData
  /**
   * Set on the cards in the first row so their covers are preloaded rather than
   * lazy-loaded. One of them is the LCP element, and Next warns when it is not
   * prioritized.
   */
  priority?: boolean
}

/**
 * DESIGN.md `property-card`: a photo-first card — square cover with rounded-md
 * clipping, then title, location, rating and price.
 *
 * Seed photos are external Unsplash URLs (`public_id = null`), so they render
 * through `next/image`; the Cloudinary `CldImage` path arrives in F09 with the
 * first real upload. The saved heart is F08 — a card that cannot save anything
 * should not show the control.
 */
export function ListingCard({ listing, priority = false }: Props) {
  return (
    <Link href={`/listings/${listing.id}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md bg-surface-soft">
        {listing.coverUrl ? (
          <Image
            src={listing.coverUrl}
            alt={listing.title}
            fill
            // Matches the grid below: 1-up on mobile, 2-up on tablet, 4-up from
            // desktop — so the optimizer never ships a 4-up-sized file to a phone.
            sizes="(max-width: 744px) 100vw, (max-width: 1128px) 50vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-soft">
            <House className="size-8" aria-hidden />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-ink">
            {listing.title}
          </h3>
          {/* Stars render in ink, never gold — a deliberate DESIGN.md choice. */}
          {listing.rating === null ? (
            <span className="shrink-0 text-sm text-muted">New</span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-sm text-ink">
              <Star className="size-3.5 fill-current" aria-hidden />
              <span>{listing.rating.toFixed(1)}</span>
              <span className="sr-only">
                out of 5, {listing.reviewCount}{' '}
                {listing.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-sm text-muted">
          {listing.city}, {listing.country}
        </p>

        <p className="mt-1.5 text-sm text-ink">
          <span className="font-semibold">
            {formatPrice(listing.pricePerNight)}
          </span>{' '}
          night
        </p>
      </div>
    </Link>
  )
}
