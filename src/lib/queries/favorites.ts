import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { toListingCard, type ListingCardData } from '@/lib/queries/listings'
import { toFavoriteCards } from '@/lib/utils'

/**
 * The current user's saved stays, most recently saved first.
 *
 * There is **no `user_id` filter and no `is_published` filter**, and both
 * omissions are deliberate:
 *
 * - `favorites` is RLS-scoped to `user_id = auth.uid()` with no policy for
 *   `anon` at all, so the query already returns only the caller's rows. Adding
 *   the filter would re-implement the guard in application code.
 * - Visibility of the listing itself is the `listings` policy's decision, the
 *   same call `getListingById` makes. A host who saved and then unpublished
 *   their own stay still sees it here, which is correct; anyone else's
 *   unpublished stay comes back as a null embed and is dropped.
 */
export async function getFavorites(): Promise<ListingCardData[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('favorites')
    .select(
      'created_at, listings(id, title, city, country, price_per_night, listing_photos(url, public_id, is_cover, position), reviews(rating))',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[queries/favorites] getFavorites failed:', error.message)
    return []
  }

  // Every row here is by definition saved, so the flag is a constant rather
  // than another nested select.
  return toFavoriteCards(data ?? [], (listing) => toListingCard(listing, true))
}
