import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AdminBookingsTable } from '@/components/admin/AdminBookingsTable'
import { AdminListingsTable } from '@/components/admin/AdminListingsTable'
import { AdminUsersTable } from '@/components/admin/AdminUsersTable'
import { getAdminOverview } from '@/lib/queries/admin'
import { getCurrentProfile } from '@/lib/queries/profiles'

export const metadata: Metadata = {
  title: 'Admin · NextBnb',
}

/**
 * Moderation for users, listings and bookings.
 *
 * The proxy only guarantees a signed-in user on /admin — the admin check has to
 * live here, because doing it in the proxy would put a database round trip in
 * front of every request in the app. RLS (`is_admin()`) remains the real backstop
 * for the data itself; this is the route-level gate, pulled forward to F04 and
 * inherited unchanged.
 *
 * **The gate is also what makes `getAdminOverview` legible.** Its reads are
 * unscoped — an admin satisfies every branch of every SELECT policy, so there is
 * no filter that would narrow them and the unscoped read *is* the correct query
 * (F14's generalisation, arriving at the case it predicted). For a non-admin the
 * same query returns their own listings and their own bookings: harmless, but not
 * a dashboard. This redirect is what says so.
 *
 * Three sections on one route rather than `/admin/users|listings|bookings`, so
 * the build holds at 16 routes and one gate check covers all three. The page
 * awaits its queries directly: no `<Suspense>` (there is no shell worth painting
 * before a moderation table) and **no `loading.tsx`** — this is the first route
 * where F07's rule meets a *redirect* rather than a `notFound()`, and streaming
 * would commit the response before the redirect ran.
 */
export default async function AdminPage() {
  const profile = await getCurrentProfile()
  if (!profile?.is_admin) redirect('/')

  const { users, listings, bookings } = await getAdminOverview()

  return (
    <div className="mx-auto max-w-wide px-6 py-10 tablet:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink tablet:text-[28px]">
        Admin
      </h1>
      <p className="mt-2 text-base text-body">
        Moderation for users, listings and bookings. Prefer unpublishing a listing
        to deleting it — a delete erases its reservations rather than cancelling
        them.
      </p>

      <div className="mt-8 space-y-12">
        <AdminSection
          heading="Users"
          count={users.rows.length}
          failed={users.failed}
          empty="No accounts yet."
        >
          <AdminUsersTable users={users.rows} />
        </AdminSection>

        <AdminSection
          heading="Listings"
          count={listings.rows.length}
          failed={listings.failed}
          empty="No listings yet — published or draft."
        >
          <AdminListingsTable listings={listings.rows} />
        </AdminSection>

        <AdminSection
          heading="Bookings"
          count={bookings.rows.length}
          failed={bookings.failed}
          empty="Nobody has booked anything yet."
        >
          <AdminBookingsTable bookings={bookings.rows} />
        </AdminSection>
      </div>
    </div>
  )
}

type SectionProps = {
  heading: string
  count: number
  failed: boolean
  empty: string
  children: React.ReactNode
}

/**
 * One table with its heading, count and two different nothings.
 *
 * **A failed read and an empty table are not the same event**, and on a
 * moderation surface the difference matters more than it did on F14's host page:
 * "no listings yet" to an admin whose catalogue is live would invite them to
 * conclude the platform is empty. `getAdminOverview` reports them separately and
 * this states whichever it is. All three sections always render, so a broken one
 * shows as a broken section rather than as a page that lost a table.
 */
function AdminSection({ heading, count, failed, empty, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-ink">
        {heading}{' '}
        {!failed && <span className="text-base font-normal text-muted">({count})</span>}
      </h2>

      {failed ? (
        <p role="alert" className="mt-3 text-sm text-error">
          This table could not be loaded. Reload the page — if it keeps failing,
          the {heading.toLowerCase()} query is the place to look.
        </p>
      ) : count === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  )
}
