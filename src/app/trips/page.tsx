import Link from 'next/link'

import { TripCard } from '@/components/trips/TripCard'
import { getGuestBookings } from '@/lib/queries/bookings'
import type { TripData } from '@/lib/queries/bookings'

/**
 * The signed-in user's reservations as a guest.
 *
 * `src/proxy.ts` guards the route, so anyone reaching this component has a
 * session — and `getGuestBookings` scopes to `guest_id` regardless, because the
 * `bookings` SELECT policy also admits hosts and admins.
 *
 * The page awaits its one query directly: no `<Suspense>` (there is no shell
 * worth painting before a personal list) and no `loading.tsx` (`/favorites`'
 * precedent — this route cannot 404, so F07's rule does not forbid one, but it
 * gains nothing from it either).
 */
export default async function TripsPage() {
  const { upcoming, past } = await getGuestBookings()
  const total = upcoming.length + past.length

  return (
    <div className="mx-auto max-w-wide px-6 py-10 tablet:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink tablet:text-[28px]">
        Trips
      </h1>

      {total === 0 ? (
        <NoTrips />
      ) : (
        <div className="mt-8 space-y-12">
          <TripSection
            heading="Upcoming"
            trips={upcoming}
            section="upcoming"
            empty="No upcoming stays. When you book one, it will show up here."
          />
          <TripSection
            heading="Past"
            trips={past}
            section="past"
            empty="Nothing here yet — past and cancelled stays collect in this section."
          />
        </div>
      )}
    </div>
  )
}

type SectionProps = {
  heading: string
  trips: TripData[]
  section: 'upcoming' | 'past'
  empty: string
}

/**
 * One half of the page. Both sections always render once the guest has any
 * trip at all: an empty "Upcoming" beneath a full "Past" is information — it
 * says nothing is booked — whereas hiding it reads as a page that lost a section.
 */
function TripSection({ heading, trips, section, empty }: SectionProps) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-ink">
        {heading}{' '}
        <span className="text-base font-normal text-muted">({trips.length})</span>
      </h2>

      {trips.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul aria-label={`${heading} trips`} className="mt-4 space-y-4">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} section={section} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Also the failed-read state: getGuestBookings logs and returns empty sections. */
function NoTrips() {
  return (
    <div className="mt-8 rounded-md border border-hairline px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">No trips yet</p>
      <p className="mt-2 text-sm text-muted">
        Once you book a stay, you will find it here — with the option to cancel
        before it starts.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary hover:bg-primary-active"
      >
        Browse stays
      </Link>
    </div>
  )
}
