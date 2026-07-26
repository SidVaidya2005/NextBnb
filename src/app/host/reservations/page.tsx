import type { Metadata } from 'next'
import Link from 'next/link'

import { ReservationCard } from '@/components/host/ReservationCard'
import { getHostReservations } from '@/lib/queries/bookings'
import type { HostReservationData } from '@/lib/queries/bookings'

export const metadata: Metadata = {
  title: 'Reservations · NextBnb',
}

/**
 * Every booking across the listings this user hosts.
 *
 * **Read-only, and that is a schema fact rather than a scope decision.** A host
 * has no write path to `bookings` at all: `bookings_update_cancel_own_or_admin`
 * admits only the guest or an admin, and the column grants in `0006` limit even
 * them to `status`/`cancelled_at`. Adding a host cancel or decline is a migration.
 *
 * One flat chronological list per section rather than a group per listing. The
 * build plan's line reads "grouped by listing (upcoming/past)", but a host holding
 * one or two stays across several places would have "what is next" scattered over
 * as many headings; the listing moves onto the row instead.
 *
 * `src/proxy.ts` guards `/host/**`, so there is no auth check here — and
 * `getHostReservations` scopes to owned listings regardless, because the
 * `bookings` SELECT policy also admits the guest and admins. The page awaits its
 * query directly: no `<Suspense>` (nothing above the list is worth painting first
 * — unlike `/host/listings`, there is no CTA) and no `loading.tsx` (this route
 * cannot 404, so F07's rule does not forbid one, but it gains nothing either).
 */
export default async function HostReservationsPage() {
  const { upcoming, past, hostsNothing } = await getHostReservations()
  const total = upcoming.length + past.length

  return (
    <div className="mx-auto max-w-wide px-6 py-10 tablet:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink tablet:text-[28px]">
        Reservations
      </h1>
      <p className="mt-2 text-base text-body">Bookings across every listing you host.</p>

      {total === 0 ? (
        <NoReservations hostsNothing={hostsNothing} />
      ) : (
        <div className="mt-8 space-y-12">
          <ReservationSection
            heading="Upcoming"
            reservations={upcoming}
            empty="No arrivals booked. When a guest reserves one of your places, it will show up here."
          />
          <ReservationSection
            heading="Past"
            reservations={past}
            empty="Nothing here yet — finished and cancelled stays collect in this section."
          />
        </div>
      )}
    </div>
  )
}

type SectionProps = {
  heading: string
  reservations: HostReservationData[]
  empty: string
}

/**
 * One half of the page. Both sections always render once the host has any
 * reservation at all — `/trips`' rule: an empty "Upcoming" beneath a full "Past"
 * says nothing is booked, where hiding it reads as a page that lost a section.
 */
function ReservationSection({ heading, reservations, empty }: SectionProps) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-ink">
        {heading}{' '}
        <span className="text-base font-normal text-muted">({reservations.length})</span>
      </h2>

      {reservations.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul aria-label={`${heading} reservations`} className="mt-4 space-y-4">
          {reservations.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Two different nothings, and they want different things said.
 *
 * A user who hosts no listings needs the first step; a host whose places simply
 * have no bookings yet needs to know the page is working. `getHostReservations`
 * distinguishes them, and its failed-read path reports `hostsNothing: false` — so
 * a query that broke says "nothing booked yet" rather than inviting a host with
 * live reservations to list their first place.
 */
function NoReservations({ hostsNothing }: { hostsNothing: boolean }) {
  if (hostsNothing) {
    return (
      <div className="mt-8 rounded-md border border-hairline px-6 py-16 text-center">
        <p className="text-base font-semibold text-ink">No reservations yet</p>
        <p className="mt-2 text-sm text-muted">
          You are not hosting anything yet. List a place and its bookings will
          appear here.
        </p>
        <Link
          href="/host/listings/new"
          className="mt-6 inline-flex h-12 items-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary hover:bg-primary-active"
        >
          List your place
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-md border border-hairline px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">No reservations yet</p>
      <p className="mt-2 text-sm text-muted">
        Nobody has booked your places yet. Publishing a listing and keeping its
        availability open is what puts it in front of guests.
      </p>
      <Link
        href="/host/listings"
        className="mt-6 inline-flex h-12 items-center rounded-sm border border-ink px-6 text-base font-medium text-ink hover:bg-surface-soft"
      >
        Your listings
      </Link>
    </div>
  )
}
