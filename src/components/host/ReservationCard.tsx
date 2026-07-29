import Link from 'next/link'

import { Avatar } from '@/components/ui/Avatar'
import { ListingImage } from '@/components/ui/ListingImage'
import { Pill } from '@/components/ui/Pill'
import { formatDateRange, formatPrice } from '@/lib/utils'
import type { HostReservationData } from '@/lib/queries/bookings'

type Props = { reservation: HostReservationData }

/**
 * One booking on a listing this user hosts.
 *
 * The host-side twin of `TripCard`, and deliberately a separate component rather
 * than a `role` prop on that one. The two answer different questions from the same
 * row: a trip leads with the place and carries the cancel control, a reservation
 * leads with the guest and carries none. What they share is the shell and
 * `ListingImage`, the same arrangement `HostListingCard` and `ListingCard` settled
 * into in F10.
 *
 * A Server Component, and the whole page keeps that property: nothing here mutates,
 * because a host cannot write to `bookings` at all —
 * `bookings_update_cancel_own_or_admin` admits only the guest or an admin, so a
 * host cancel would need a migration, not a button.
 */
export function ReservationCard({ reservation }: Props) {
  const { listing, guest } = reservation
  const dates = formatDateRange(reservation.checkIn, reservation.checkOut) ?? ''
  const isCancelled = reservation.status === 'cancelled'

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
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            No photo
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          {/* The guest leads: on a host surface the question is who is arriving,
              and the listing is the qualifier. The inverse of `TripCard`. */}
          <div className="flex items-center gap-2">
            <Avatar avatarUrl={guest.avatarUrl} name={guest.name} size={32} />
            <h3 className="min-w-0 truncate text-base font-semibold text-ink">{guest.name}</h3>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-body">
            <Link href={`/listings/${listing.id}`} className="underline-offset-4 hover:underline">
              {listing.title}
            </Link>
            {isCancelled && <Pill>Cancelled</Pill>}
            {/* A host can unpublish a listing that already has stays on it, and
                those stays remain owed. Marked rather than merely present, so the
                row is not read as evidence the listing is still bookable. */}
            {!listing.isPublished && <Pill>Unpublished</Pill>}
          </p>

          <p className="mt-1 text-sm text-muted">
            {listing.city}, {listing.country}
          </p>

          <p className="mt-1 text-sm text-body">
            {dates} · {reservation.nights === 1 ? '1 night' : `${reservation.nights} nights`} ·{' '}
            {reservation.guestsCount === 1 ? '1 guest' : `${reservation.guestsCount} guests`}
          </p>
        </div>

        <Money reservation={reservation} isCancelled={isCancelled} />
      </div>
    </li>
  )
}

/**
 * What the guest paid, and what the host keeps of it.
 *
 * The stored `total` is the **guest's** number — it includes the platform service
 * fee. Printing it alone on a host screen would read as a payout, so both figures
 * render with the deduction between them.
 *
 * A cancelled stay earns nothing, so it shows only what had been paid: the earnings
 * line under a "Cancelled" pill would be a figure the host is never going to see.
 */
function Money({
  reservation,
  isCancelled,
}: {
  reservation: HostReservationData
  isCancelled: boolean
}) {
  if (isCancelled) {
    return (
      <p className="text-sm text-muted">
        {formatPrice(reservation.total)} paid by guest · cancelled, so nothing earned
      </p>
    )
  }

  return (
    // A description list, not a table: three label/value pairs, and `<dl>` keeps
    // them associated for a screen reader without inventing rows and columns.
    <dl className="max-w-xs space-y-1 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Guest paid</dt>
        <dd className="text-body">{formatPrice(reservation.total)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Service fee</dt>
        <dd className="text-body">−{formatPrice(reservation.serviceFee)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-hairline pt-1">
        <dt className="font-medium text-ink">Your earnings</dt>
        <dd className="font-medium text-ink">{formatPrice(reservation.earnings)}</dd>
      </div>
    </dl>
  )
}
