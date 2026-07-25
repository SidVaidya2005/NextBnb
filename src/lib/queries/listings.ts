import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { averageRating, coverPhotoOf } from '@/lib/utils'
import type { ListingFilters, Stay } from '@/lib/validations/listings'
import type { Database } from '@/types/database.types'

type Listing = Database['public']['Tables']['listings']['Row']

/**
 * A listing reduced to what a card renders. Not a table row — the photos and
 * reviews are collapsed here (cover photo, average rating) so the component
 * stays presentational and the aggregation stays unit-testable.
 */
export type ListingCardData = Pick<Listing, 'id' | 'title' | 'city' | 'country'> & {
  /** Integer **cents**, like every money value in the app. */
  pricePerNight: number
  coverUrl: string | null
  /** Mean review rating, or null when the listing has no reviews yet ("New"). */
  rating: number | null
  reviewCount: number
}

// A defensive ceiling, not pagination: the catalogue is 24 listings and the
// filters narrow it further. Revisit when the seed stops being the whole database.
const MAX_LISTINGS = 48

/**
 * Published listings matching `filters`, newest first, shaped for the home grid.
 *
 * `filters` is required rather than optional-with-a-default: an unfiltered read
 * passes `NO_FILTERS` explicitly, so there is no silent branch that nobody tests.
 *
 * `is_published` is filtered here for the feature, not for security — the
 * `listings` SELECT policy already hides other people's drafts.
 */
export async function getPublishedListings(
  filters: ListingFilters,
): Promise<ListingCardData[]> {
  const supabase = await createClient()

  let query = supabase
    .from('listings')
    .select(
      'id, title, city, country, price_per_night, created_at, listing_photos(url, is_cover, position), reviews(rating)',
    )
    .eq('is_published', true)

  if (filters.city) {
    query = query.ilike('city', `%${likeTerm(filters.city)}%`)
  }
  if (filters.guests !== undefined) {
    query = query.gte('max_guests', filters.guests)
  }
  if (filters.minPriceCents !== undefined) {
    query = query.gte('price_per_night', filters.minPriceCents)
  }
  if (filters.maxPriceCents !== undefined) {
    query = query.lte('price_per_night', filters.maxPriceCents)
  }
  if (filters.propertyType) {
    query = query.eq('property_type', filters.propertyType)
  }
  if (filters.amenities.length > 0) {
    // `contains` is AND: the listing must offer every amenity asked for.
    query = query.contains('amenities', filters.amenities)
  }

  if (filters.stay) {
    const unavailable = await unavailableListingIds(supabase, filters.stay)

    // A failed availability check returns no results rather than unfiltered
    // ones. Showing listings whose availability was never verified would be a
    // worse failure than showing none — the guest would click through to a
    // booking F12 must then reject.
    if (unavailable === null) return []

    if (unavailable.length > 0) {
      // Ids come from our own database, not from the user.
      query = query.not('id', 'in', `(${unavailable.join(',')})`)
    }

    // A stay shorter than the listing's minimum is not bookable, so it has no
    // business appearing in results for those dates.
    query = query.lte('min_nights', filters.stay.nights)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(MAX_LISTINGS)

  if (error) {
    console.error(
      '[queries/listings] getPublishedListings failed:',
      error.message,
    )
    return []
  }

  return (data ?? []).map((listing) => ({
    id: listing.id,
    title: listing.title,
    city: listing.city,
    country: listing.country,
    pricePerNight: listing.price_per_night,
    coverUrl: coverPhotoOf(listing.listing_photos)?.url ?? null,
    rating: averageRating(listing.reviews.map((review) => review.rating)),
    reviewCount: listing.reviews.length,
  }))
}

/**
 * Listing ids that are booked or blocked across the stay, via the
 * `unavailable_listing_ids` RPC. Returns `null` when the check itself failed —
 * distinct from `[]`, which means "everything is free".
 *
 * This has to be an RPC: RLS scopes `bookings` to the guest, the host and
 * admins, so an anonymous visitor reads zero booking rows and any client-side
 * availability check would conclude the whole catalogue is available.
 */
async function unavailableListingIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stay: Stay,
): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('unavailable_listing_ids', {
    p_check_in: stay.checkIn,
    p_check_out: stay.checkOut,
  })

  if (error) {
    console.error(
      '[queries/listings] unavailable_listing_ids failed:',
      error.message,
    )
    return null
  }

  return data ?? []
}

/**
 * Strip LIKE/PostgREST wildcards so a destination matches literally.
 *
 * PostgREST treats both `*` and `%` as wildcards in `ilike`, and `_` is a
 * single-character wildcard in SQL. Left in, `?city=%` would quietly match
 * every listing and look like the filter had been ignored. No real city name
 * contains these, so removing them costs nothing.
 */
function likeTerm(value: string): string {
  return value.replace(/[%_*\\]/g, '')
}
