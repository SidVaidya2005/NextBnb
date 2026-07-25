import { createClient } from '@supabase/supabase-js'

import { TEST_USER } from './constants'
import type { Database } from '@/types/database.types'

/**
 * A read-only snapshot of the seeded catalogue, used to compute what search
 * *should* return.
 *
 * Deliberately built from the raw tables rather than from the
 * `unavailable_listing_ids` RPC: asserting the app against the same function it
 * queries would only prove the app calls it. The overlap maths below is an
 * independent second implementation, so a mistake in either one shows up as a
 * disagreement.
 *
 * It needs the service-role key because RLS hides `bookings` from anon — the
 * very constraint that forced the RPC to exist.
 */
export type SeedSnapshot = {
  listings: { id: string; title: string; minNights: number }[]
  /** Confirmed only — cancelled bookings free their dates. */
  bookings: { listingId: string; checkIn: string; checkOut: string }[]
  blocks: { listingId: string; start: string; end: string }[]
}

/**
 * A service-role client. Bypasses RLS, so it can see drafts and bookings — both
 * of which the app deliberately hides, and both of which the expectations here
 * need in order to be an independent check rather than an echo.
 */
function serviceClient() {
  process.loadEnvFile('.env.local')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      '[e2e/fixtures] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.',
    )
  }

  if (serviceKey.startsWith('sb_publishable_')) {
    throw new Error(
      '[e2e/fixtures] SUPABASE_SERVICE_ROLE_KEY holds a PUBLISHABLE key. It obeys RLS, so bookings would come back empty ' +
        'and every availability expectation would be silently wrong.',
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function loadSeedSnapshot(): Promise<SeedSnapshot> {
  const supabase = serviceClient()

  const [listings, bookings, blocks] = await Promise.all([
    supabase.from('listings').select('id, title, min_nights').eq('is_published', true),
    supabase.from('bookings').select('listing_id, check_in, check_out').eq('status', 'confirmed'),
    supabase.from('blocked_dates').select('listing_id, start_date, end_date'),
  ])

  const failure = listings.error ?? bookings.error ?? blocks.error
  if (failure) {
    throw new Error(`[e2e/fixtures] could not load the seed snapshot: ${failure.message}`)
  }

  // A publishable key returns [] here rather than erroring — catch that outright
  // instead of letting it read as "nothing is booked".
  if ((bookings.data ?? []).length === 0) {
    throw new Error(
      '[e2e/fixtures] read zero confirmed bookings. Either the seed is missing or the key is not privileged.',
    )
  }

  return {
    listings: (listings.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      minNights: row.min_nights,
    })),
    bookings: (bookings.data ?? []).map((row) => ({
      listingId: row.listing_id,
      checkIn: row.check_in,
      checkOut: row.check_out,
    })),
    blocks: (blocks.data ?? []).map((row) => ({
      listingId: row.listing_id,
      start: row.start_date,
      end: row.end_date,
    })),
  }
}

/**
 * What a listing's detail page should show, read straight from the tables.
 *
 * The rating is averaged here rather than taken from the app, so a mistake in
 * `averageRating` shows up as a disagreement instead of agreeing with itself.
 */
export type ListingDetailFixture = {
  id: string
  title: string
  /** The location line, nulls dropped — 12 of 24 published listings have no state. */
  location: string
  isPublished: boolean
  photoCount: number
  amenityCount: number
  reviewCount: number
  /** Mean rating to one decimal as the page prints it, or null when unreviewed. */
  rating: string | null
  cleaningFeeCents: number
  hasHouseRules: boolean
  hostName: string | null
  /** Reviewers who have no avatar_url — they must fall back to the icon. */
  reviewersWithoutAvatar: string[]
}

export async function loadListingDetail(
  id: string,
): Promise<ListingDetailFixture> {
  const supabase = serviceClient()

  const [listing, photos, reviews] = await Promise.all([
    supabase
      .from('listings')
      .select(
        'id, title, neighborhood, city, state, country, is_published, amenities, cleaning_fee, house_rules, profiles!listings_host_id_fkey(full_name)',
      )
      .eq('id', id)
      .single(),
    supabase.from('listing_photos').select('id').eq('listing_id', id),
    supabase
      .from('reviews')
      .select('rating, profiles!reviews_reviewer_id_fkey(full_name, avatar_url)')
      .eq('listing_id', id),
  ])

  const failure = listing.error ?? photos.error ?? reviews.error
  if (failure) {
    throw new Error(
      `[e2e/fixtures] could not load listing ${id}: ${failure.message}`,
    )
  }

  const row = listing.data
  // Narrowing on `error` alone does not narrow `data`; and a missing fixture
  // row should fail loudly here rather than as a confusing assertion later.
  if (!row) {
    throw new Error(`[e2e/fixtures] listing ${id} is not in the database.`)
  }
  const ratings = (reviews.data ?? []).map((review) => review.rating)
  const mean =
    ratings.length === 0
      ? null
      : ratings.reduce((sum, value) => sum + value, 0) / ratings.length

  return {
    id: row.id,
    title: row.title,
    location: [row.neighborhood, row.city, row.state, row.country]
      .filter(Boolean)
      .join(', '),
    isPublished: row.is_published,
    photoCount: (photos.data ?? []).length,
    amenityCount: row.amenities.length,
    reviewCount: ratings.length,
    rating: mean === null ? null : mean.toFixed(1),
    cleaningFeeCents: row.cleaning_fee,
    hasHouseRules: row.house_rules !== null,
    hostName: row.profiles?.full_name ?? null,
    reviewersWithoutAvatar: (reviews.data ?? [])
      .filter((review) => !review.profiles?.avatar_url)
      .map((review) => review.profiles?.full_name ?? '')
      .filter(Boolean),
  }
}

/**
 * The unpublished listings, found rather than hard-coded — these are the only
 * ids that prove the 404 branch, and a hard-coded one would quietly stop testing
 * anything if the seed changed.
 */
export async function loadDraftListings(): Promise<
  { id: string; title: string }[]
> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('listings')
    .select('id, title')
    .eq('is_published', false)

  if (error) {
    throw new Error(`[e2e/fixtures] could not load drafts: ${error.message}`)
  }
  if ((data ?? []).length === 0) {
    throw new Error(
      '[e2e/fixtures] read zero unpublished listings. The seed provides two; without them the 404 specs assert nothing.',
    )
  }

  return data ?? []
}

// -----------------------------------------------------------------------------
// Favorites (F08)
//
// Favorites are per-user global state and playwright.config.ts runs
// `fullyParallel: true` against ONE shared storageState, so specs must not
// assert on row counts or on "the favorites page is empty" — a sibling worker
// may legitimately have a row in flight. Each spec claims its own listing and
// asserts on that listing's title.
// -----------------------------------------------------------------------------

/** A seeded guest, for proving one user cannot see another's favorites. */
export const OTHER_USER_ID = '00000000-0000-4000-b000-000000000003'

let cachedTestUserId: string | null = null

/** The Playwright fixture user's id, resolved from the auth admin API. */
export async function testUserId(): Promise<string> {
  if (cachedTestUserId) return cachedTestUserId

  const supabase = serviceClient()
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  if (error) {
    throw new Error(`[e2e/fixtures] could not list users: ${error.message}`)
  }

  const user = data.users.find((candidate) => candidate.email === TEST_USER.email)
  if (!user) {
    throw new Error(
      `[e2e/fixtures] the test user ${TEST_USER.email} does not exist. auth.setup.ts provisions it — run the setup project first.`,
    )
  }

  cachedTestUserId = user.id
  return user.id
}

/**
 * Published listings ordered by id, so a spec can claim `[n]` and be certain no
 * other spec claimed the same one. Derived from the database rather than
 * hard-coded: a hard-coded title quietly stops testing anything if the seed
 * changes.
 */
export async function loadPublishedListings(): Promise<
  { id: string; title: string }[]
> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('listings')
    .select('id, title')
    .eq('is_published', true)
    .order('id')

  if (error) {
    throw new Error(`[e2e/fixtures] could not load listings: ${error.message}`)
  }
  if ((data ?? []).length < 7) {
    throw new Error(
      '[e2e/fixtures] fewer than 7 published listings. The favorites specs each claim a distinct one.',
    )
  }

  return data ?? []
}

/**
 * The listing ids a user has saved, read straight from the table.
 *
 * The oracle is the table, never the page: asserting the UI against the same
 * query the UI renders from would only prove it is self-consistent (F06's rule).
 */
export async function readFavorites(userId: string): Promise<string[]> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`[e2e/fixtures] could not read favorites: ${error.message}`)
  }

  return (data ?? []).map((row) => row.listing_id)
}

export async function addFavorite(
  userId: string,
  listingId: string,
): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase
    .from('favorites')
    .upsert(
      { user_id: userId, listing_id: listingId },
      { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
    )

  if (error) {
    throw new Error(`[e2e/fixtures] could not add a favorite: ${error.message}`)
  }
}

/**
 * Removes specific favorites. Scoped to the listings a spec claimed, never a
 * blanket wipe of the user — that would delete rows a parallel spec is asserting on.
 */
export async function clearFavorites(
  userId: string,
  listingIds: string[],
): Promise<void> {
  if (listingIds.length === 0) return

  const supabase = serviceClient()

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .in('listing_id', listingIds)

  if (error) {
    throw new Error(`[e2e/fixtures] could not clear favorites: ${error.message}`)
  }
}

/**
 * Titles search should return for a stay, by the rules in architecture.md:
 * bookings are half-open `[checkIn, checkOut)`, blocks are inclusive
 * `[start, end]`, and a stay shorter than `min_nights` is not bookable.
 *
 * All dates are `YYYY-MM-DD`, where string comparison is date comparison.
 */
export function expectedAvailableTitles(
  snapshot: SeedSnapshot,
  checkIn: string,
  checkOut: string,
): string[] {
  const nights = nightsBetween(checkIn, checkOut)

  return snapshot.listings
    .filter((listing) => {
      if (listing.minNights > nights) return false

      const booked = snapshot.bookings.some(
        (booking) =>
          booking.listingId === listing.id &&
          overlaps(checkIn, checkOut, booking.checkIn, booking.checkOut),
      )
      if (booked) return false

      return !snapshot.blocks.some(
        (block) =>
          block.listingId === listing.id &&
          // Inclusive [start, end] becomes half-open [start, end+1).
          overlaps(checkIn, checkOut, block.start, addDay(block.end)),
      )
    })
    .map((listing) => listing.title)
}

/** Half-open overlap: touching ends do not overlap, so turnover days are free. */
function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function addDay(iso: string, days = 1): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime()
  const end = new Date(`${checkOut}T00:00:00Z`).getTime()
  return Math.round((end - start) / 86_400_000)
}

/** Today as YYYY-MM-DD, for building forward-looking ranges. */
export function todayISO(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}
