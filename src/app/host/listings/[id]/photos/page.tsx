import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PhotoManager } from '@/components/host/PhotoManager'
import { getOwnListing } from '@/lib/queries/listings'
import { listingIdSchema } from '@/lib/validations/listings'

type Props = { params: Promise<{ id: string }> }

/**
 * Step 2 of two: add photos, then publish.
 *
 * **No `loading.tsx` for this route** — F07's finding. A route `loading.tsx`
 * wraps the page in an implicit `<Suspense>`, so the response streams and the
 * HTTP status commits to 200 *before* `notFound()` runs. This route 404s for
 * anyone who is not the host, and that has to be a real 404.
 *
 * `getOwnListing` filters on `host_id`, so a signed-in non-owner — including an
 * admin, who RLS would happily show the draft to — gets `null` and lands here as
 * a 404 rather than on an editor whose writes would be rejected.
 */
export default async function ListingPhotosPage({ params }: Props) {
  const { id } = await params

  // Validated before the query: `id` is a uuid column, so a hand-edited link
  // would otherwise raise Postgres 22P02 and log a database error for what is
  // only a bad URL.
  if (!listingIdSchema.safeParse(id).success) notFound()

  const listing = await getOwnListing(id)
  if (!listing) notFound()

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 tablet:px-10 tablet:py-16">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/host/listings"
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← Your listings
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        {listing.title}
      </h1>
      <p className="mt-3 max-w-xl text-base text-body">
        Add photos of your place. The first one is the cover guests see in
        search.
      </p>

      <div className="mt-10">
        <PhotoManager
          listingId={listing.id}
          listingTitle={listing.title}
          photos={listing.photos}
          isPublished={listing.isPublished}
        />
      </div>

      <p className="mt-10 text-sm text-muted">
        <Link
          href={`/listings/${listing.id}`}
          className="underline underline-offset-4 hover:text-ink"
        >
          Preview how guests will see it
        </Link>
      </p>
    </div>
  )
}
