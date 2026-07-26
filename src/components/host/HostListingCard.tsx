import Link from 'next/link'

import {
  HOST_CONTROL,
  HOST_CONTROL_DEFAULT,
} from '@/components/host/hostControlStyles'
import { ListingActions } from '@/components/host/ListingActions'
import { ListingImage } from '@/components/ui/ListingImage'
import { cn, formatPrice } from '@/lib/utils'
import type { HostListingData } from '@/lib/queries/listings'

type Props = { listing: HostListingData }

/**
 * One row of the host's own listings.
 *
 * Deliberately **not** `ListingCard`. That one is a guest-facing card: it links
 * the whole tile to the public page, carries a `SaveButton`, and renders a
 * rating — none of which belong on a management surface, and the heart would
 * pull a client component into it for nothing. What the two genuinely share is
 * the photo, and that is `ListingImage`, which both use.
 *
 * A Server Component: only the two mutating controls need the client, and they
 * live at the leaf in `ListingActions`.
 */
export function HostListingCard({ listing }: Props) {
  return (
    <li className="flex flex-col gap-4 rounded-md border border-hairline p-4 tablet:flex-row tablet:items-start">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-surface-soft tablet:w-56">
        {listing.coverUrl ? (
          <ListingImage
            publicId={listing.coverPublicId}
            url={listing.coverUrl}
            alt={listing.title}
            sizes="(max-width: 744px) 100vw, 224px"
            className="object-cover"
          />
        ) : (
          // A draft can legitimately have no photo — that is exactly the state
          // publishing refuses, so the row has to render it rather than assume
          // a cover exists.
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            No photo yet
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">
              <Link
                href={`/listings/${listing.id}`}
                className="underline-offset-4 hover:underline"
              >
                {listing.title}
              </Link>
            </h2>
            {!listing.isPublished && (
              <span className="rounded-full bg-surface-strong px-2.5 py-1 text-[11px] font-semibold text-ink">
                Draft
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-muted">
            {listing.city}, {listing.country}
          </p>
          <p className="mt-1 text-sm text-body">
            {formatPrice(listing.pricePerNight)} night ·{' '}
            {listing.photoCount === 1 ? '1 photo' : `${listing.photoCount} photos`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/host/listings/${listing.id}/edit`}
            className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
            aria-label={`Edit ${listing.title}`}
          >
            Edit
          </Link>
          <Link
            href={`/host/listings/${listing.id}/photos`}
            className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
            aria-label={`Manage photos for ${listing.title}`}
          >
            Photos
          </Link>
        </div>

        <ListingActions
          listingId={listing.id}
          listingTitle={listing.title}
          isPublished={listing.isPublished}
          canDelete={listing.canDelete}
        />
      </div>
    </li>
  )
}
