import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListingForm } from '@/components/host/ListingForm'
import { getOwnListingForEdit } from '@/lib/queries/listings'
import { listingIdSchema } from '@/lib/validations/listings'

type Props = { params: Promise<{ id: string }> }

/**
 * Edit an existing listing's details. Photos stay on `/photos` — that surface is
 * verified end to end against the live Cloudinary account and has no business
 * being rebuilt here — and availability stays on `/availability`, which owns its
 * own calendar and mutations rather than re-rendering this form on every write.
 *
 * **No `loading.tsx` for this route** — F07's finding. A route `loading.tsx`
 * wraps the page in an implicit `<Suspense>`, so the response streams and the
 * HTTP status commits to 200 *before* `notFound()` runs. This route 404s for
 * anyone who is not the host, and that has to be a real 404.
 *
 * `getOwnListingForEdit` filters on `host_id`, so a signed-in non-owner — an
 * admin included, whom RLS would happily show the draft to — gets `null` and
 * lands here as a 404 rather than on an editor whose save would be rejected.
 */
export default async function EditListingPage({ params }: Props) {
  const { id } = await params

  // Validated before the query: `id` is a uuid column, so a hand-edited link
  // would otherwise raise Postgres 22P02 and log a database error for what is
  // only a bad URL.
  if (!listingIdSchema.safeParse(id).success) notFound()

  const listing = await getOwnListingForEdit(id)
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
        Edit {listing.title}
      </h1>
      <p className="mt-3 max-w-xl text-base text-body">
        {listing.isPublished
          ? 'This listing is live. Changes appear to guests as soon as you save.'
          : 'This listing is a draft. Only you can see it until you publish.'}
      </p>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <Link
          href={`/host/listings/${listing.id}/photos`}
          className="underline underline-offset-4 hover:text-ink"
        >
          Manage photos
        </Link>
        <Link
          href={`/host/listings/${listing.id}/availability`}
          className="underline underline-offset-4 hover:text-ink"
        >
          Manage availability
        </Link>
      </p>

      <div className="mt-10">
        <ListingForm
          mode="edit"
          listingId={listing.id}
          defaultValues={listing.values}
        />
      </div>
    </div>
  )
}
