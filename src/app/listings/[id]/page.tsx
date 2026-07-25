import { notFound } from 'next/navigation'
import { Star } from 'lucide-react'

import { AmenityList } from '@/components/listings/AmenityList'
import { DraftNotice } from '@/components/listings/DraftNotice'
import { HostCard } from '@/components/listings/HostCard'
import { PhotoGallery } from '@/components/listings/PhotoGallery'
import { ReservationCard } from '@/components/listings/ReservationCard'
import { ReviewsSection } from '@/components/listings/ReviewsSection'
import { SaveButton } from '@/components/listings/SaveButton'
import { getListingById } from '@/lib/queries/listings'
import { isSignedIn } from '@/lib/queries/profiles'
import { formatCapacity, formatTimeOfDay, humanizeToken } from '@/lib/utils'
import { listingIdSchema } from '@/lib/validations/listings'

// Next 16: params is async and must be awaited.
type Props = {
  params: Promise<{ id: string }>
}

/**
 * The listing a guest inspects before booking.
 *
 * The page awaits its queries rather than streaming behind `<Suspense>` the way
 * `/` does: there is no useful shell to paint first here — the heading *is* the
 * data — and they run in parallel, so a boundary would gate nothing.
 *
 * **There is deliberately no `loading.tsx`** (F07). That file wraps the page in
 * an implicit `<Suspense>`, so the response streams and the HTTP status commits
 * to 200 *before* `notFound()` runs — every draft listing would then be a
 * 200-OK, indexable page. See `code-standards.md`; the 404 specs gate against
 * restoring it.
 *
 * A listing the viewer may not see is a 404, and that decision is the database's:
 * `getListingById` applies no `is_published` filter, so the `listings` SELECT
 * policy is what returns a draft to its host and nothing to anyone else.
 */
export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params

  // Rejected before the query, so a bad link costs a 404 rather than a logged
  // Postgres `22P02`.
  if (!listingIdSchema.safeParse(id).success) notFound()

  // In parallel — the auth check is its own round trip and the listing query
  // does not depend on it.
  const [listing, signedIn] = await Promise.all([getListingById(id), isSignedIn()])
  if (!listing) notFound()

  // Nulls are dropped rather than rendered — 12 of the 24 published listings
  // have no `state`, and a naive join would leave a stray comma on each.
  const location = [
    listing.neighborhood,
    listing.city,
    listing.state,
    listing.country,
  ]
    .filter(Boolean)
    .join(', ')

  const checkIn = formatTimeOfDay(listing.check_in_time)
  const checkOut = formatTimeOfDay(listing.check_out_time)

  return (
    // pb-28 keeps the last section clear of the fixed reservation bar, which
    // only exists below `tablet:`.
    <div className="mx-auto max-w-listing px-6 pb-28 pt-6 tablet:px-10 tablet:pb-16">
      {listing.isOwnerView && <DraftNotice />}

      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        {listing.title}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-body">
        {listing.rating === null ? (
          <span className="text-muted">New</span>
        ) : (
          <span className="flex items-center gap-1 text-ink">
            <Star className="size-3.5 fill-current" aria-hidden />
            <span>{listing.rating.toFixed(1)}</span>
            <span className="text-muted">
              ({listing.reviewCount}{' '}
              {listing.reviewCount === 1 ? 'review' : 'reviews'})
            </span>
          </span>
        )}
        <span aria-hidden>·</span>
        <span>{location}</span>
      </div>

      <div className="mt-6">
        <PhotoGallery
          photos={listing.photos}
          title={listing.title}
          action={
            <SaveButton
              listingId={listing.id}
              isFavorited={listing.isFavorited}
              isSignedIn={signedIn}
              label={listing.title}
            />
          }
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 tablet:grid-cols-[1fr_300px] desktop:grid-cols-[1fr_340px] desktop:gap-16">
        <div className="min-w-0">
          <section>
            <h2 className="text-xl font-semibold text-ink">
              {humanizeToken(listing.property_type)} in{' '}
              {listing.neighborhood ?? listing.city}
            </h2>
            <p className="mt-1 text-base text-body">
              {formatCapacity({
                maxGuests: listing.max_guests,
                bedrooms: listing.bedrooms,
                beds: listing.beds,
                bathrooms: listing.bathrooms,
              })}
            </p>
          </section>

          {listing.description && (
            <>
              <Divider />
              <section aria-labelledby="about-heading">
                <h2 id="about-heading" className="sr-only">
                  About this stay
                </h2>
                <p className="whitespace-pre-line text-base leading-relaxed text-body">
                  {listing.description}
                </p>
              </section>
            </>
          )}

          <Divider />
          <section aria-labelledby="amenities-heading">
            <h2 id="amenities-heading" className="text-xl font-semibold text-ink">
              What this place offers
            </h2>
            <div className="mt-2">
              <AmenityList amenities={listing.amenities} />
            </div>
          </section>

          {(checkIn || checkOut || listing.house_rules) && (
            <>
              <Divider />
              <section aria-labelledby="things-to-know-heading">
                <h2
                  id="things-to-know-heading"
                  className="text-xl font-semibold text-ink"
                >
                  Things to know
                </h2>
                <dl className="mt-3 space-y-2 text-base text-body">
                  {checkIn && (
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink">Check-in:</dt>
                      <dd>After {checkIn}</dd>
                    </div>
                  )}
                  {checkOut && (
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink">Checkout:</dt>
                      <dd>Before {checkOut}</dd>
                    </div>
                  )}
                </dl>
                {listing.house_rules && (
                  <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-body">
                    {listing.house_rules}
                  </p>
                )}
              </section>
            </>
          )}

          {listing.host && (
            <>
              <Divider />
              <HostCard host={listing.host} />
            </>
          )}
        </div>

        <ReservationCard
          pricePerNight={listing.price_per_night}
          cleaningFee={listing.cleaning_fee}
          minNights={listing.min_nights}
          maxGuests={listing.max_guests}
        />
      </div>

      <Divider />
      <ReviewsSection
        rating={listing.rating}
        reviewCount={listing.reviewCount}
        reviews={listing.reviews}
      />
    </div>
  )
}

function Divider() {
  return <hr className="my-8 border-hairline" />
}
