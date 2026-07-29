import { AdminCancelBookingButton } from '@/components/admin/AdminCancelBookingButton'
import {
  TABLE,
  TABLE_CELL,
  TABLE_CELL_NUMERIC,
  TABLE_CELL_PRIMARY,
  TABLE_HEAD_CELL,
  TABLE_SCROLL,
} from '@/components/admin/adminTableStyles'
import { Pill } from '@/components/ui/Pill'
import { cn, formatDateRange, formatPrice } from '@/lib/utils'
import type { AdminBooking } from '@/lib/queries/admin'

type Props = { bookings: AdminBooking[] }

/**
 * Every reservation, with cancel on the ones still confirmed.
 *
 * **No hard delete, and that is the build plan's rule rather than a limitation.**
 * `0006` revokes DELETE on `bookings` from `authenticated` outright, so an admin
 * has no delete path anyway — cancelling is the whole moderation vocabulary here,
 * and it leaves the guest a row that explains itself.
 *
 * The **guest's** total is shown, not the host's earnings: this is a moderation
 * surface, so the number that matters is what was actually charged. F14 splits
 * the two on `/host/reservations` because printing the guest's total on a *host*
 * surface reads as a payout; here there is no such confusion.
 */
export function AdminBookingsTable({ bookings }: Props) {
  return (
    <div className={TABLE_SCROLL}>
      <table className={TABLE}>
        <caption className="sr-only">
          All reservations, with controls to cancel the confirmed ones
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Listing
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Guest
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Dates
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Guests
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Total
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const dates =
              formatDateRange(booking.checkIn, booking.checkOut) ?? booking.checkIn

            return (
              <tr key={booking.id}>
                <th scope="row" className={cn(TABLE_CELL, TABLE_CELL_PRIMARY)}>
                  <span className="flex flex-wrap items-center gap-2">
                    {booking.listingTitle}
                    {booking.status === 'cancelled' && <Pill>Cancelled</Pill>}
                  </span>
                </th>
                <td className={TABLE_CELL}>{booking.guestName}</td>
                <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>{dates}</td>
                <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>
                  {booking.guestsCount}
                </td>
                <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>
                  {formatPrice(booking.total)}
                </td>
                <td className={TABLE_CELL}>
                  {booking.canCancel ? (
                    <AdminCancelBookingButton
                      bookingId={booking.id}
                      // Names the row rather than the id: one control per row, so
                      // a bare "Cancel" would match N times and be a strict-mode
                      // violation for any spec locating it (F10's rule).
                      bookingLabel={`${booking.listingTitle}, ${dates}`}
                    />
                  ) : (
                    <span className="text-sm text-muted">Already cancelled</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
