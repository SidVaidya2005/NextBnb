import 'server-only'

import { AMENITIES, type Amenity } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { averageRating, coverPhotoOf, orderedPhotos } from '@/lib/utils'
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
  /** Whether the *current viewer* has saved it. Always false when signed out. */
  isFavorited: boolean
}

/** The columns a card needs, however the listing was reached. */
type ListingCardRow = Pick<
  Listing,
  'id' | 'title' | 'city' | 'country' | 'price_per_night'
> & {
  listing_photos: { url: string; is_cover: boolean; position: number }[]
  reviews: { rating: number }[]
}

/**
 * One row → one card. Shared by the home grid and `/favorites` so the two
 * surfaces cannot drift on what a card shows.
 */
export function toListingCard(
  listing: ListingCardRow,
  isFavorited: boolean,
): ListingCardData {
  return {
    id: listing.id,
    title: listing.title,
    city: listing.city,
    country: listing.country,
    pricePerNight: listing.price_per_night,
    coverUrl: coverPhotoOf(listing.listing_photos)?.url ?? null,
    rating: averageRating(listing.reviews.map((review) => review.rating)),
    reviewCount: listing.reviews.length,
    isFavorited,
  }
}

export type ListingPhoto = {
  url: string
  /** Null for seed/Unsplash rows; set once F09 uploads to Cloudinary. */
  publicId: string | null
}

export type ListingHost = {
  id: string
  fullName: string | null
  avatarUrl: string | null
  /** `profiles.created_at` — rendered as "Member since March 2025". */
  memberSince: string
}

export type ListingReview = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  author: { fullName: string | null; avatarUrl: string | null }
}

/**
 * A listing with everything its detail page renders.
 *
 * `amenities` narrows the row's `string[]` to `Amenity[]` here — the DB check
 * constraint already restricts the values, and narrowing at this boundary is
 * what lets the icon map be total instead of defensive.
 */
export type ListingDetailData = Omit<Listing, 'amenities'> & {
  amenities: Amenity[]
  /** Gallery order: cover first, then ascending position. */
  photos: ListingPhoto[]
  host: ListingHost | null
  /** Newest first. */
  reviews: ListingReview[]
  rating: number | null
  reviewCount: number
  /** Whether the *current viewer* has saved it. Always false when signed out. */
  isFavorited: boolean
  /**
   * True when the viewer is looking at an unpublished listing — which, because
   * RLS returned it at all, means they are its host or an admin.
   */
  isOwnerView: boolean
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
      'id, title, city, country, price_per_night, created_at, listing_photos(url, is_cover, position), reviews(rating), favorites(user_id)',
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

  // `favorites` is RLS-scoped to `user_id = auth.uid()`, so these rows are the
  // viewer's own and a signed-out visitor gets none. Reading fewer rows is the
  // right answer here — unlike the availability filter above, where it would
  // have meant "everything is free". Absence infers a restriction, not a
  // permission, which is what makes the nested select safe.
  return (data ?? []).map((listing) =>
    toListingCard(listing, listing.favorites.length > 0),
  )
}

/**
 * One listing with its photos, host and reviews, or `null` when the viewer may
 * not see it. The caller turns `null` into a 404.
 *
 * **There is deliberately no `is_published` filter.** The `listings` SELECT
 * policy is the gate: it returns a draft to its host and to admins, and nothing
 * to anyone else. Filtering here as well would break the host's own preview —
 * and would be enforcing in application code something the database already
 * enforces better.
 *
 * Availability is **not** read here, and must not be added: `bookings` has no
 * `anon` policy at all, so a signed-out visitor reads zero booking rows and any
 * app-side date check would report every night as free. F12 adds a
 * `security definer` function for it, the way F06 did for search.
 */
export async function getListingById(
  id: string,
): Promise<ListingDetailData | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('listings')
    .select(
      '*, listing_photos(url, public_id, is_cover, position), host:profiles!listings_host_id_fkey(id, full_name, avatar_url, created_at), reviews(id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url)), favorites(user_id)',
    )
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 is "no rows": the listing does not exist, or RLS hid it. That is
    // an ordinary 404 on a public URL, not a fault — logging it would turn every
    // stale link into noise. Anything else is a real failure.
    if (error.code !== 'PGRST116') {
      console.error('[queries/listings] getListingById failed:', error.message)
    }
    return null
  }

  const { listing_photos, host, reviews, amenities, favorites, ...listing } =
    data

  return {
    ...listing,
    amenities: amenities.filter(isKnownAmenity),
    photos: orderedPhotos(listing_photos).map((photo) => ({
      url: photo.url,
      publicId: photo.public_id,
    })),
    host: host
      ? {
          id: host.id,
          fullName: host.full_name,
          avatarUrl: host.avatar_url,
          memberSince: host.created_at,
        }
      : null,
    reviews: reviews
      .map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at,
        author: {
          fullName: review.reviewer?.full_name ?? null,
          avatarUrl: review.reviewer?.avatar_url ?? null,
        },
      }))
      // Sorted here rather than in the query, for the same reason F05 averages
      // ratings in app code: the aggregation stays testable without a database.
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    rating: averageRating(reviews.map((review) => review.rating)),
    reviewCount: reviews.length,
    // RLS scopes this to the viewer's own rows (see getPublishedListings).
    isFavorited: favorites.length > 0,
    isOwnerView: !listing.is_published,
  }
}

function isKnownAmenity(value: string): value is Amenity {
  return (AMENITIES as readonly string[]).includes(value)
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
