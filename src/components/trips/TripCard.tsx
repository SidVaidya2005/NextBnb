import Link from 'next/link'

import { CancelTripButton } from '@/components/trips/CancelTripButton'
import { TripReview } from '@/components/trips/TripReview'
import { ListingImage } from '@/components/ui/ListingImage'
import { Pill } from '@/components/ui/Pill'
import { formatDateRange, formatPrice } from '@/lib/utils'
import type { TripData } from '@/lib/queries/bookings'

type Props = {
  trip: TripData
  /** Upcoming cards explain a missing cancel control; past ones have nothing to explain. */
  section: 'upcoming' | 'past'
}

/**
 * One reservation.
 *
 * Deliberately **not** `ListingCard`. That is a discovery card — it links the
 * whole tile, carries a `SaveButton` and renders a rating, none of which belong
 * on a reservation, and the heart would pull a client component in for nothing.
 * What the two genuinely share is the photo, and that is `ListingImage`, which
 * both use. Same reasoning `HostListingCard` recorded in F10.
 *
 * A Server Component: only the cancel control needs the client, and it lives at
 * the leaf in `CancelTripButton`.
 */
export function TripCard({ trip, section }: Props) {
  const dates = formatDateRange(trip.checkIn, trip.checkOut) ?? ''
  // What every control and every landmark on this card is named after. The
  // listing may be gone, so the dates are the part that always exists.
  const tripLabel = trip.listing ? `${trip.listing.title}, ${dates}` : `your stay on ${dates}`

  return (
    <li className="flex flex-col gap-4 rounded-md border border-hairline p-4 tablet:flex-row tablet:items-start">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-surface-soft tablet:w-56">
        {trip.listing?.coverUrl ? (
          <ListingImage
            publicId={trip.listing.coverPublicId}
            url={trip.listing.coverUrl}
            alt={trip.listing.title}
            sizes="(max-width: 744px) 100vw, 224px"
            className="object-cover"
          />
        ) : (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            No photo
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">
              {trip.listing ? (
                <Link
                  href={`/listings/${trip.listing.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {trip.listing.title}
                </Link>
              ) : (
                // The booking outlives the listing's visibility — a host can
                // unpublish after someone books. The reservation is still real
                // and still cancellable, so the card renders without a link
                // rather than disappearing. See `TripListing` for why the row is
                // kept where /favorites drops its equivalent.
                'This listing is no longer available'
              )}
            </h3>
            {trip.status === 'cancelled' && <Pill>Cancelled</Pill>}
          </div>

          {trip.listing && (
            <p className="mt-1 text-sm text-muted">
              {trip.listing.city}, {trip.listing.country}
            </p>
          )}

          <p className="mt-1 text-sm text-body">
            {dates} · {trip.nights === 1 ? '1 night' : `${trip.nights} nights`} ·{' '}
            {trip.guestsCount === 1 ? '1 guest' : `${trip.guestsCount} guests`}
          </p>
          <p className="mt-1 text-sm text-body">
            {formatPrice(trip.total)} total
          </p>
        </div>

        {/* The review slot renders nothing at all on a stay that is neither
            reviewable nor reviewed, which is every upcoming card. It sits above
            the cancel control because a finished stay never has one. */}
        <TripReview
          bookingId={trip.id}
          review={trip.review}
          canReview={trip.canReview}
          tripLabel={tripLabel}
        />

        {trip.canCancel ? (
          <CancelTripButton bookingId={trip.id} tripLabel={tripLabel} />
        ) : (
          section === 'upcoming' &&
          trip.status === 'confirmed' && (
            // Stated, not merely absent. `bookings_update_cancel_own_or_admin`
            // requires `check_in >= current_date`, so a stay that has started
            // cannot be cancelled — and a control that silently is not there is
            // the thing users report as broken (F09's publish button, F10's
            // delete). This is the only way into this branch: an upcoming,
            // confirmed stay that cannot be cancelled has, by definition, begun.
            <p className="text-sm text-muted">
              Your stay has already started, so it can no longer be cancelled.
            </p>
          )
        )}
      </div>
    </li>
  )
}
