import Image from 'next/image'
import Link from 'next/link'
import { House, Star } from 'lucide-react'

import { SaveButton } from '@/components/listings/SaveButton'
import { formatPrice } from '@/lib/utils'
import type { ListingCardData } from '@/lib/queries/listings'

type Props = {
  listing: ListingCardData
  isSignedIn: boolean
  /**
   * Set on the cards in the first row so their covers are preloaded rather than
   * lazy-loaded. One of them is the LCP element, and Next warns when it is not
   * prioritized.
   */
  priority?: boolean
}

/**
 * DESIGN.md `property-card`: a photo-first card — square cover with rounded-md
 * clipping, then title, location, rating and price, with the saved heart
 * floating top-right of the photo.
 *
 * **The card is deliberately not one big `<Link>` any more.** A `<button>` (or
 * the signed-out sign-in `<form>`) nested inside an `<a>` is invalid HTML, and
 * in practice clicking the heart would also navigate to the listing. The link is
 * now scoped to the title and stretched over the whole card with
 * `after:absolute after:inset-0`; the heart sits above that overlay on `z-10`,
 * so each control does exactly one thing.
 *
 * Seed photos are external Unsplash URLs (`public_id = null`), so they render
 * through `next/image`; the Cloudinary `CldImage` path arrives in F09 with the
 * first real upload.
 */
export function ListingCard({ listing, isSignedIn, priority = false }: Props) {
  return (
    <div className="group relative">
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

        {/* z-10 clears the stretched link overlay below, which sits at z-auto. */}
        <div className="absolute right-2 top-2 z-10">
          <SaveButton
            listingId={listing.id}
            isFavorited={listing.isFavorited}
            isSignedIn={isSignedIn}
            label={listing.title}
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-ink">
            <Link
              href={`/listings/${listing.id}`}
              // Stretches the hit area over the whole card without wrapping the
              // heart in an anchor.
              className="after:absolute after:inset-0 after:content-['']"
            >
              {listing.title}
            </Link>
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
    </div>
  )
}
