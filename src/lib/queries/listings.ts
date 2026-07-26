import 'server-only'

import { AMENITIES, type Amenity } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import {
  averageRating,
  blocksListingDeletion,
  bookedNightsRange,
  coverPhotoOf,
  orderedPhotos,
  todayISO,
} from '@/lib/utils'
import { toListingFormValues } from '@/lib/validations/listings'
import type { InclusiveRange } from '@/lib/utils'
import type {
  ListingFilters,
  ListingFormValues,
  Stay,
} from '@/lib/validations/listings'
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
  /** Cloudinary id of the cover, or null for an external (seed) photo. */
  coverPublicId: string | null
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
  listing_photos: {
    url: string
    public_id: string | null
    is_cover: boolean
    position: number
  }[]
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
  const cover = coverPhotoOf(listing.listing_photos)

  return {
    id: listing.id,
    title: listing.title,
    city: listing.city,
    country: listing.country,
    pricePerNight: listing.price_per_night,
    coverUrl: cover?.url ?? null,
    coverPublicId: cover?.public_id ?? null,
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
      'id, title, city, country, price_per_night, created_at, listing_photos(url, public_id, is_cover, position), reviews(rating), favorites(user_id)',
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
 * app-side date check would report every night as free. It is read separately,
 * through `getListingOccupiedRanges` below, which goes via the `0008`
 * `security definer` function — the way F06 did for search.
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

/**
 * The nights a published listing is already taken — inclusive spans, in the model
 * a calendar renders — or `null` when the check itself could not be made.
 *
 * **This has to be an RPC, and the reason is sharper than F06's.** There, the
 * problem was anonymous visitors. Here it is *everyone who might book*: the
 * `bookings` SELECT policy admits the guest, the listing's host and admins, so a
 * signed-in guest looking at someone else's listing reads **zero** booking rows
 * too. A nested select would return `[]` for both of them and the calendar would
 * offer nights that are already sold — silently, and with no error to notice.
 * `listing_occupied_ranges` (migration `0008`) is the bypass.
 *
 * **`null` is not `[]`, and the distinction is load-bearing.** An empty array
 * means "verified: every night is free"; `null` means "the availability check
 * failed". Collapsing them would render a calendar that invites a guest to book
 * dates nobody checked — F06's rule, that showing unverified availability is
 * worse than showing none. Callers fail closed on `null`.
 *
 * The half-open → inclusive conversion happens in SQL (`check_out - 1`), so both
 * halves of the union arrive in one range model. See the migration's header.
 */
export async function getListingOccupiedRanges(
  listingId: string,
): Promise<InclusiveRange[] | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('listing_occupied_ranges', {
    p_listing_id: listingId,
  })

  if (error) {
    console.error(
      '[queries/listings] listing_occupied_ranges failed:',
      error.message,
    )
    return null
  }

  return (data ?? []).map((range) => ({
    start: range.start_date,
    end: range.end_date,
  }))
}

/** A photo as the host's editor renders it — ordered, and identifiable. */
export type OwnListingPhoto = {
  id: string
  url: string
  publicId: string | null
  position: number
  isCover: boolean
}

export type OwnListingData = {
  id: string
  title: string
  isPublished: boolean
  /** Gallery order: cover first, then ascending position. */
  photos: OwnListingPhoto[]
}

/**
 * A listing the current user **hosts**, with its photos — or `null`, which the
 * caller turns into a 404.
 *
 * Deliberately *not* `getListingById`. That one leans on the SELECT policy,
 * which also returns a draft to any **admin**, and its `isOwnerView` flag is
 * really "this listing is unpublished". The photo editor writes, so it has to
 * ask the narrower question — is this listing mine? — and `host_id` is the only
 * thing that answers it. The write policies would reject an admin's edit anyway;
 * this is what stops the page rendering an editor that cannot save.
 */
export async function getOwnListing(id: string): Promise<OwnListingData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, title, is_published, listing_photos(id, url, public_id, position, is_cover)',
    )
    .eq('id', id)
    .eq('host_id', user.id)
    .single()

  if (error) {
    // PGRST116 is "no rows" — someone else's listing, or none. An ordinary 404.
    if (error.code !== 'PGRST116') {
      console.error('[queries/listings] getOwnListing failed:', error.message)
    }
    return null
  }

  return {
    id: data.id,
    title: data.title,
    isPublished: data.is_published,
    photos: orderedPhotos(data.listing_photos).map((photo) => ({
      id: photo.id,
      url: photo.url,
      publicId: photo.public_id,
      position: photo.position,
      isCover: photo.is_cover,
    })),
  }
}

/** One row of the host's own listings screen. */
export type HostListingData = {
  id: string
  title: string
  city: string
  country: string
  /** Integer **cents**, like every money value in the app. */
  pricePerNight: number
  coverUrl: string | null
  coverPublicId: string | null
  isPublished: boolean
  photoCount: number
  /**
   * False while a confirmed stay has yet to finish. Deleting the listing would
   * not cancel that booking — the FK cascade would erase it — so the control is
   * disabled and the reason stated. `deleteListing` re-checks the same rule;
   * this is what lets the page say so before the host clicks.
   */
  canDelete: boolean
}

/**
 * Every listing the current user hosts, drafts included, newest first.
 *
 * **Reading `bookings` here is safe, and that was checked rather than assumed.**
 * The `bookings` SELECT policy admits the listing's host, and `host_id` scopes
 * this query to listings this user hosts — so the reader is always privileged
 * for exactly the rows being counted.
 *
 * This is deliberately *not* F06's trap, and the difference is the useful part:
 * there, missing booking rows inferred a **permission** ("every listing is
 * available") and arrived as a success. Here a non-host reads no listings at
 * all, so there is no row set left to draw a wrong conclusion from.
 */
export async function getOwnListings(): Promise<HostListingData[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, title, city, country, price_per_night, is_published, created_at, listing_photos(url, public_id, is_cover, position), bookings(status, check_out)',
    )
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_LISTINGS)

  if (error) {
    console.error('[queries/listings] getOwnListings failed:', error.message)
    return []
  }

  return (data ?? []).map((listing) => {
    const cover = coverPhotoOf(listing.listing_photos)

    return {
      id: listing.id,
      title: listing.title,
      city: listing.city,
      country: listing.country,
      pricePerNight: listing.price_per_night,
      coverUrl: cover?.url ?? null,
      coverPublicId: cover?.public_id ?? null,
      isPublished: listing.is_published,
      photoCount: listing.listing_photos.length,
      canDelete: !blocksListingDeletion(listing.bookings),
    }
  })
}

/** A listing loaded back into the edit form. */
export type OwnListingEditData = {
  id: string
  title: string
  isPublished: boolean
  /** Form-ready: cents already dollars, nulls already blank strings. */
  values: ListingFormValues
}

/**
 * A listing this user **hosts**, shaped for the edit form — or `null`, which the
 * caller turns into a 404.
 *
 * Scoped on `host_id` for the same reason as `getOwnListing`: the SELECT policy
 * would also hand a draft to any admin, and the write policies would then reject
 * the save. A page that renders an editor whose submit cannot succeed is worse
 * than a 404.
 *
 * Kept separate from `getOwnListing` rather than widening it — that one feeds the
 * photo editor, which has no use for eighteen form fields, and the two callers
 * want genuinely different shapes.
 */
export async function getOwnListingForEdit(
  id: string,
): Promise<OwnListingEditData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('host_id', user.id)
    .single()

  if (error) {
    // PGRST116 is "no rows" — someone else's listing, or none. An ordinary 404.
    if (error.code !== 'PGRST116') {
      console.error('[queries/listings] getOwnListingForEdit failed:', error.message)
    }
    return null
  }

  return {
    id: data.id,
    title: data.title,
    isPublished: data.is_published,
    values: toListingFormValues(data),
  }
}

/** One `blocked_dates` row as the host's list renders it. Both ends inclusive. */
export type ListingBlock = {
  id: string
  startDate: string
  endDate: string
}

export type OwnListingAvailabilityData = {
  id: string
  title: string
  isPublished: boolean
  /** The host's own blocks, earliest first. Removable, past ones included. */
  blocks: ListingBlock[]
  /** Nights held by confirmed, not-yet-finished bookings, as inclusive ranges.
   *  Read-only here — freeing them is a cancellation, not an unblock. */
  bookedRanges: InclusiveRange[]
}

/**
 * A listing this user **hosts**, with everything its availability calendar
 * shows — or `null`, which the caller turns into a 404.
 *
 * **Reading `bookings` here is safe, and it was checked rather than assumed.**
 * The `bookings` SELECT policy admits the listing's host, and `.eq('host_id',
 * user.id)` scopes this to listings this user hosts — so the reader is always
 * privileged for exactly the rows being read.
 *
 * **This is F10's `getOwnListings` reasoning, not F06's trap**, and the
 * difference is worth restating because the two look alike: there, missing
 * booking rows inferred a *permission* ("every listing is available") and
 * arrived as a success. Here a non-host reads no listing at all, so there is no
 * row set left to draw a wrong conclusion from.
 *
 * **It also does not solve F12's problem.** A guest's calendar needs the same
 * dates for a listing they do not host, and RLS gives them nothing — that needs
 * its own `security definer` function, the way F06 needed one for search.
 *
 * A third narrow query rather than a widened `getOwnListing`, for the reason
 * F10 recorded: that one feeds the photo editor and has no use for date ranges.
 */
export async function getOwnListingAvailability(
  id: string,
): Promise<OwnListingAvailabilityData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, title, is_published, blocked_dates(id, start_date, end_date), bookings(status, check_in, check_out)',
    )
    .eq('id', id)
    .eq('host_id', user.id)
    .single()

  if (error) {
    // PGRST116 is "no rows" — someone else's listing, or none. An ordinary 404.
    if (error.code !== 'PGRST116') {
      console.error('[queries/listings] getOwnListingAvailability failed:', error.message)
    }
    return null
  }

  return {
    id: data.id,
    title: data.title,
    isPublished: data.is_published,
    blocks: data.blocked_dates
      .map((block) => ({
        id: block.id,
        startDate: block.start_date,
        endDate: block.end_date,
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    // Cancelled stays free their dates — the same rule the partial exclusion
    // constraint applies — so only confirmed ones occupy the calendar.
    //
    // Finished stays are dropped here, on the **server**, where "today" is
    // decided exactly once. Doing it in the component would compute `todayISO()`
    // during the server render and again during hydration, which is a mismatch
    // waiting for a midnight page load. Blocks are deliberately *not* filtered
    // the same way: a stale one still has to be removable.
    bookedRanges: data.bookings
      .filter((booking) => booking.status === 'confirmed')
      .map(bookedNightsRange)
      .filter((range) => range.end >= todayISO())
      .sort((a, b) => a.start.localeCompare(b.start)),
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
