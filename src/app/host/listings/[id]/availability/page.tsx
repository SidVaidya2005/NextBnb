import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvailabilityManager } from '@/components/host/AvailabilityManager'
import { getOwnListingAvailability } from '@/lib/queries/listings'
import { listingIdSchema } from '@/lib/validations/listings'

type Props = { params: Promise<{ id: string }> }

/**
 * Host-managed availability: block dates the place is not free.
 *
 * A third sibling to `/edit` and `/photos` rather than a section on the editor,
 * which is where `build-plan.md` originally put it. `/edit` is one large
 * react-hook-form with the hydration window F10 documented; a second set of
 * mutations hanging off it would re-render the whole editor on every block.
 *
 * **No `loading.tsx` for this route** — F07's finding. A route `loading.tsx`
 * wraps the page in an implicit `<Suspense>`, so the response streams and the
 * HTTP status commits to 200 *before* `notFound()` runs. This route 404s for
 * anyone who is not the host, and that has to be a real 404.
 *
 * `getOwnListingAvailability` filters on `host_id`, so a signed-in non-owner —
 * an admin included, whom RLS would happily show a draft to — gets `null` and
 * lands here as a 404 rather than on a calendar whose writes would be rejected.
 */
export default async function ListingAvailabilityPage({ params }: Props) {
  const { id } = await params

  // Validated before the query: `id` is a uuid column, so a hand-edited link
  // would otherwise raise Postgres 22P02 and log a database error for what is
  // only a bad URL.
  if (!listingIdSchema.safeParse(id).success) notFound()

  const listing = await getOwnListingAvailability(id)
  if (!listing) notFound()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 tablet:px-10 tablet:py-16">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/host/listings"
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← Your listings
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        Availability for {listing.title}
      </h1>
      <p className="mt-3 max-w-xl text-base text-body">
        {listing.isPublished
          ? 'Blocked dates disappear from search straight away.'
          : 'This listing is a draft. Blocked dates apply as soon as you publish it.'}
      </p>

      <p className="mt-3 text-sm text-muted">
        <Link
          href={`/host/listings/${listing.id}/edit`}
          className="underline underline-offset-4 hover:text-ink"
        >
          Edit listing details
        </Link>
      </p>

      <div className="mt-10">
        <AvailabilityManager
          listingId={listing.id}
          blocks={listing.blocks}
          bookedRanges={listing.bookedRanges}
        />
      </div>
    </div>
  )
}
