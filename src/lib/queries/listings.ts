import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { averageRating, coverPhotoOf } from '@/lib/utils'
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

// A defensive ceiling, not pagination: the catalogue is 24 listings and F06
// narrows it further. Revisit when the seed stops being the whole database.
const MAX_LISTINGS = 48

/**
 * Every published listing, newest first, shaped for the home grid.
 *
 * Takes no filters — F06 adds them. Only `is_published` rows are selected, but
 * that filter is for the feature, not for security: the `listings` SELECT policy
 * already hides other people's drafts, so an anon reader cannot see them either way.
 */
export async function getPublishedListings(): Promise<ListingCardData[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, title, city, country, price_per_night, created_at, listing_photos(url, is_cover, position), reviews(rating)',
    )
    .eq('is_published', true)
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
