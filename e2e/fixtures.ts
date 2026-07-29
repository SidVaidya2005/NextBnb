import { createClient } from '@supabase/supabase-js'

import { SECOND_USER, TEST_USER } from './constants'
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

/**
 * The seed's availability state, as an independent expectation for `search.spec.ts`.
 *
 * **Fixture-hosted listings are excluded, for the reason `loadPublishedListings`
 * gives.** `min_nights: 30` already keeps a published fixture out of both sides of
 * the exact-count comparison, but one spec picks its subject with
 * `listings.find((l) => l.minNights > 1)` — and a 30-night fixture is a candidate
 * for that. It would then assert against a row another spec is about to delete.
 * Scoping this to the seed makes it impossible rather than unlikely.
 */
export async function loadSeedSnapshot(): Promise<SeedSnapshot> {
  const supabase = serviceClient()
  const fixtureHosts = await fixtureUserIds()

  const [listings, bookings, blocks] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, min_nights')
      .eq('is_published', true)
      .not('host_id', 'in', `(${fixtureHosts.join(',')})`),
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
 * The seeded unpublished listings, found rather than hard-coded — these are the
 * only ids that prove the 404 branch, and a hard-coded one would quietly stop
 * testing anything if the seed changed.
 *
 * Scoped away from the fixture user for the same reason as
 * `loadPublishedListings`: the host specs create and delete drafts constantly,
 * and a spec that picked one up could find it gone mid-assertion.
 */
export async function loadDraftListings(): Promise<
  { id: string; title: string }[]
> {
  const supabase = serviceClient()
  const hostIds = await fixtureUserIds()

  const { data, error } = await supabase
    .from('listings')
    .select('id, title')
    .eq('is_published', false)
    .not('host_id', 'in', `(${hostIds.join(',')})`)

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
//
// **The exception is `second-user.spec.ts`**, which owns the second account
// outright and runs `mode: 'serial'` so nothing races it. That is what finally
// makes "the favorites page is empty" assertable — the rule above is about the
// *shared* account, not about the assertion being wrong in principle.
// -----------------------------------------------------------------------------

/** A seeded guest, for proving one user cannot see another's favorites. */
export const OTHER_USER_ID = '00000000-0000-4000-b000-000000000003'

const cachedUserIds = new Map<string, string>()

/** Resolves a fixture account's id from the auth admin API, once per run. */
async function userIdByEmail(email: string): Promise<string> {
  const cached = cachedUserIds.get(email)
  if (cached) return cached

  const supabase = serviceClient()
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  if (error) {
    throw new Error(`[e2e/fixtures] could not list users: ${error.message}`)
  }

  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) {
    throw new Error(
      `[e2e/fixtures] the test user ${email} does not exist. auth.setup.ts provisions it — run the setup project first.`,
    )
  }

  cachedUserIds.set(email, user.id)
  return user.id
}

/** The primary Playwright fixture user's id. */
export function testUserId(): Promise<string> {
  return userIdByEmail(TEST_USER.email)
}

/** The second fixture user's id — a different principal, so RLS answers differently. */
export function secondUserId(): Promise<string> {
  return userIdByEmail(SECOND_USER.email)
}

/** Both fixture accounts, for cleanup passes that must not miss one. */
export function fixtureUserIds(): Promise<string[]> {
  return Promise.all([testUserId(), secondUserId()])
}

/**
 * Flips `profiles.is_admin` for a fixture account.
 *
 * Deliberately a *temporary* state rather than a standing admin fixture: the
 * account's password is committed to this repo, so a permanently-admin test user
 * would be a real privilege path into whatever project the suite points at — and
 * F17's admin moderation includes a hard delete. Callers turn it on for one
 * assertion and off in a `finally`; `global-teardown.ts` is the backstop for the
 * run that is killed before that `finally` executes.
 */
export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId)

  if (error) {
    throw new Error(`[e2e/fixtures] could not set is_admin: ${error.message}`)
  }
}

/** Which fixture accounts currently hold `is_admin` — the teardown's oracle. */
export async function fixtureAdmins(): Promise<string[]> {
  const supabase = serviceClient()
  const ids = await fixtureUserIds()

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', ids)
    .eq('is_admin', true)

  if (error) {
    throw new Error(`[e2e/fixtures] could not read admin flags: ${error.message}`)
  }

  return (data ?? []).map((row) => row.id)
}

/**
 * Published **seed** listings ordered by id, so a spec can claim `[n]` and be
 * certain no other spec claimed the same one. Derived from the database rather
 * than hard-coded: a hard-coded title quietly stops testing anything if the seed
 * changes.
 *
 * **Listings hosted by the fixture user are excluded, and that is load-bearing.**
 * Ids are `gen_random_uuid()`, so a listing F09 publishes sorts to an arbitrary
 * point in this array and shifts every claim after it — while a sibling worker
 * is mid-assertion on index `[n]`. Scoping to the seed makes the ordering stable
 * no matter what the host specs create.
 */
export async function loadPublishedListings(): Promise<
  { id: string; title: string }[]
> {
  const supabase = serviceClient()
  const hostIds = await fixtureUserIds()

  const { data, error } = await supabase
    .from('listings')
    .select('id, title')
    .eq('is_published', true)
    .not('host_id', 'in', `(${hostIds.join(',')})`)
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

/**
 * Shift a `YYYY-MM-DD` label by whole calendar days.
 *
 * **The UTC basis is deliberate and it is not a mismatch with `todayISO()`'s
 * local one — checked, not assumed.** F18 flagged the pairing as a suspected
 * off-by-one (`todayISO()` reads local `getFullYear/getMonth/getDate`; this
 * parses `T00:00:00Z`), on the theory that `addDay(todayISO(), n)` could drift a
 * day in some timezones. It cannot: this function *parses and formats* in UTC,
 * so it is a pure string→string calendar-date shift and the round trip is exact
 * whatever the host offset. Verified against an independent local-time oracle at
 * offsets +14 through −11 (Kiritimati, Midway, Kolkata, Los Angeles, UTC) across
 * n = −20…300 — all agreed.
 *
 * UTC is also the *safer* basis, which is the reason not to "simplify" this to
 * local arithmetic later: midnight UTC never falls inside a DST transition, so
 * no offset can make a day-shift land on a repeated or skipped local hour.
 *
 * The genuine date hazard in this suite is a different one and lives elsewhere:
 * a spec computing `today + n` and locating the cell with a bare `dayCell`
 * rather than `revealDay`, which breaks only when `n` crosses into a month the
 * calendar is not currently showing (see `calendar.ts` → `revealDay`).
 */
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

// -----------------------------------------------------------------------------
// Host listings (F09)
//
// Specs create DRAFTS by default: a draft is invisible to search and to
// `loadPublishedListings`, so it cannot perturb a parallel worker. The one spec
// that publishes deletes the row inside its own body rather than in afterEach.
//
// Cloudinary is never called from the suite (`code-standards.md`: "mock
// Cloudinary — never call real external services in CI"), so photo rows are
// inserted directly with a public_id shaped exactly like a real upload's.
// -----------------------------------------------------------------------------

/** A city no seed listing uses, so a host fixture can never be mistaken for one. */
export const FIXTURE_CITY = 'Testerton'

export type DraftListingInput = {
  title?: string
  city?: string
  isPublished?: boolean
  /**
   * Raise this before publishing a fixture listing. `search.spec.ts` asserts an
   * **exact** count for a 5-night availability window, and any published
   * listing inflates the app's side of it — `loadSeedSnapshot` reads whatever
   * is published, so the expectation and the page disagree by one and the spec
   * fails in a parallel worker for reasons nothing in it explains. A minimum
   * stay longer than any window a spec queries keeps a published fixture out of
   * both sides of that comparison.
   */
  minNights?: number
  /**
   * Host it as a specific fixture account. Defaults to the primary user.
   * `secondUserId()` is what lets a spec put the *host* and the *viewer* in
   * different accounts, which is the only way to reach a null `listings` embed.
   */
  hostId?: string
}

/**
 * A listing owned by the Playwright fixture user.
 *
 * Values are deliberately unremarkable — `other` type, no amenities, 4 guests —
 * so that if one ever escapes cleanup while published it cannot move a count any
 * search spec compares.
 */
export async function createDraftListing(
  input: DraftListingInput = {},
): Promise<{ id: string; title: string }> {
  const supabase = serviceClient()
  const hostId = input.hostId ?? (await testUserId())

  const title = input.title ?? `E2E draft ${crypto.randomUUID().slice(0, 8)}`

  const { data, error } = await supabase
    .from('listings')
    .insert({
      host_id: hostId,
      title,
      property_type: 'other',
      city: input.city ?? FIXTURE_CITY,
      country: 'Testland',
      max_guests: 4,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      price_per_night: 12_300,
      cleaning_fee: 0,
      amenities: [],
      min_nights: input.minNights ?? 1,
      is_published: input.isPublished ?? false,
    })
    .select('id, title')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not create a draft listing: ${error?.message}`)
  }

  return data
}

/** A photo row shaped like a real Cloudinary upload, without calling Cloudinary. */
export async function addListingPhotoRow(
  listingId: string,
  options: { position?: number; isCover?: boolean; publicId?: string } = {},
): Promise<{ id: string }> {
  const supabase = serviceClient()

  const publicId =
    options.publicId ?? `nextbnb/listings/${listingId}/${crypto.randomUUID().slice(0, 8)}`

  const { data, error } = await supabase
    .from('listing_photos')
    .insert({
      listing_id: listingId,
      // A real Unsplash URL, so next/image can actually fetch it in a browser.
      url: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200',
      public_id: publicId,
      position: options.position ?? 0,
      is_cover: options.isCover ?? false,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not add a photo row: ${error?.message}`)
  }

  return data
}

export type ListingRow = {
  id: string
  title: string
  hostId: string
  isPublished: boolean
  city: string
  country: string
  propertyType: string
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: number
  pricePerNightCents: number
  cleaningFeeCents: number
  minNights: number
  amenities: string[]
  description: string | null
  state: string | null
  neighborhood: string | null
  houseRules: string | null
  checkInTime: string | null
  checkOutTime: string | null
}

/**
 * A listing read straight from the table.
 *
 * The oracle is the database, never the page that rendered it — asserting the
 * form's output against the page it produced would only prove self-consistency.
 */
export async function readListing(id: string): Promise<ListingRow | null> {
  const supabase = serviceClient()

  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (!data) return null

  return {
    id: data.id,
    title: data.title,
    hostId: data.host_id,
    isPublished: data.is_published,
    city: data.city,
    country: data.country,
    propertyType: data.property_type,
    maxGuests: data.max_guests,
    bedrooms: data.bedrooms,
    beds: data.beds,
    bathrooms: Number(data.bathrooms),
    pricePerNightCents: data.price_per_night,
    cleaningFeeCents: data.cleaning_fee,
    minNights: data.min_nights,
    amenities: data.amenities,
    description: data.description,
    state: data.state,
    neighborhood: data.neighborhood,
    houseRules: data.house_rules,
    checkInTime: data.check_in_time,
    checkOutTime: data.check_out_time,
  }
}

export async function readListingPhotos(
  listingId: string,
): Promise<{ id: string; position: number; isCover: boolean; publicId: string | null }[]> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('listing_photos')
    .select('id, position, is_cover, public_id')
    .eq('listing_id', listingId)
    .order('position')

  if (error) {
    throw new Error(`[e2e/fixtures] could not read photos: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    position: row.position,
    isCover: row.is_cover,
    publicId: row.public_id,
  }))
}

/** Removes a listing and, by cascade, its photos. */
export async function deleteListing(id: string): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) {
    throw new Error(`[e2e/fixtures] could not delete listing ${id}: ${error.message}`)
  }
}

/**
 * Every listing hosted by **either** fixture account — the safety net that keeps
 * the seed counts honest if a spec dies before its own cleanup runs.
 *
 * Both accounts, not just the primary one: the second user hosts the listing the
 * null-embed spec unpublishes, so a listing left behind by that spec would be
 * invisible to a sweep scoped to one host.
 */
export async function listingsOwnedByFixtureUser(): Promise<string[]> {
  const supabase = serviceClient()
  const hostIds = await fixtureUserIds()

  const { data, error } = await supabase.from('listings').select('id').in('host_id', hostIds)
  if (error) {
    throw new Error(`[e2e/fixtures] could not list host listings: ${error.message}`)
  }

  return (data ?? []).map((row) => row.id)
}

// -----------------------------------------------------------------------------
// Host management (F10)
// -----------------------------------------------------------------------------

/**
 * A booking row, for proving guards that need one to already exist.
 *
 * **Two callers with different geometries, which is why `guestId` exists.**
 *
 * - **F10's delete guard** attaches a booking to a **DRAFT fixture listing**. The
 *   fixture user is the *host*, so the guest must be a seeded one — a host
 *   booking their own listing is exactly what the INSERT policy and the seed's
 *   integrity checks forbid. A published fixture listing would also move the
 *   count `home.spec.ts` asserts.
 * - **F13's trips** need the fixture user as the **guest**, so they pass
 *   `guestId: await testUserId()` against a listing hosted by the *second*
 *   fixture account — F12's arrangement, which keeps both sides of the booking on
 *   sweepable accounts without ever being a self-booking.
 *
 * `guestId` defaults to the seeded guest so F10's call sites are unchanged.
 *
 * Either way the row cascades with its listing, and `listingsOwnedByFixtureUser`
 * covers **both** fixture accounts — so `global-teardown.ts` already reaches
 * every booking either caller creates. No booking-specific sweep is needed.
 *
 * Note the service-role client bypasses RLS, so this can write states the app
 * never could — a past-dated stay, or an in-progress one. That is the point:
 * `createBooking` refuses past dates, so a seeded "you are on this stay right
 * now" row has no other way into the database.
 */
export async function createBookingRow(
  listingId: string,
  options: {
    checkIn: string
    checkOut: string
    status?: 'confirmed' | 'cancelled'
    /** Defaults to the seeded guest. Pass a fixture id for guest-side specs. */
    guestId?: string
    /**
     * Integer cents, default 0.
     *
     * **F14's host-earnings assertion is blind without a non-zero value here.**
     * Earnings are `total - service_fee`, which equals `subtotal + cleaning_fee`
     * — and at `cleaning_fee = 0` that collapses onto `nights x price_per_night`,
     * so three different wrong implementations all render the same number. Any
     * non-zero fee separates them. F12's rule: ask what the assertion would still
     * pass against before trusting it.
     */
    cleaningFee?: number
  },
): Promise<{ id: string }> {
  const supabase = serviceClient()

  const nights = nightsBetween(options.checkIn, options.checkOut)
  const pricePerNight = 12_300
  const cleaningFee = options.cleaningFee ?? 0
  const subtotal = nights * pricePerNight
  // 0.14 is SERVICE_FEE_PCT, duplicated on purpose exactly as seed.sql does:
  // a booking's prices are snapshots that must not track a later rate change.
  const serviceFee = Math.round(subtotal * 0.14)

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      listing_id: listingId,
      guest_id: options.guestId ?? OTHER_USER_ID,
      check_in: options.checkIn,
      check_out: options.checkOut,
      guests_count: 2,
      nights,
      price_per_night: pricePerNight,
      cleaning_fee: cleaningFee,
      service_fee: serviceFee,
      total: subtotal + cleaningFee + serviceFee,
      status: options.status ?? 'confirmed',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not create a booking: ${error?.message}`)
  }

  return data
}

/**
 * A listing's bookings, straight from the table — the oracle for "the guard
 * refused, and the reservation is still there".
 */
export async function readBookings(listingId: string): Promise<BookingRow[]> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('listing_id', listingId)

  if (error) {
    throw new Error(`[e2e/fixtures] could not read bookings: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    guestId: row.guest_id,
    status: row.status,
    cancelledAt: row.cancelled_at,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestsCount: row.guests_count,
    nights: row.nights,
    pricePerNightCents: row.price_per_night,
    cleaningFeeCents: row.cleaning_fee,
    serviceFeeCents: row.service_fee,
    totalCents: row.total,
  }))
}

/**
 * One booking straight from the table — the oracle for "the cancel landed" and,
 * more importantly, for "the cancel wrote **only** the two granted columns".
 */
export async function readBooking(bookingId: string): Promise<BookingRow | null> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    throw new Error(`[e2e/fixtures] could not read booking: ${error.message}`)
  }
  if (!data) return null

  return {
    id: data.id,
    guestId: data.guest_id,
    status: data.status,
    checkIn: data.check_in,
    checkOut: data.check_out,
    guestsCount: data.guests_count,
    nights: data.nights,
    pricePerNightCents: data.price_per_night,
    cleaningFeeCents: data.cleaning_fee,
    serviceFeeCents: data.service_fee,
    totalCents: data.total,
    cancelledAt: data.cancelled_at,
  }
}

/**
 * A booking as the table holds it — every money column included, because F12's
 * whole claim is that the five snapshot fields are written correctly in **cents**.
 * A page that renders "$420.66" can still have stored the wrong integer.
 */
export type BookingRow = {
  id: string
  guestId: string
  status: string
  checkIn: string
  checkOut: string
  guestsCount: number
  nights: number
  pricePerNightCents: number
  cleaningFeeCents: number
  serviceFeeCents: number
  totalCents: number
  /**
   * Null until cancelled. Read because `0006` grants `status` and `cancelled_at`
   * together, so a cancel that writes only the status is a half-done cancel the
   * page cannot show — F17's admin cancel asserts on both.
   */
  cancelledAt: string | null
}

/**
 * Changes a fixture listing's columns directly, mid-spec.
 *
 * Setup only, and for one spec shape: `createBooking`'s `min_nights` and
 * per-listing `max_guests` guards are unreachable through the UI, because the
 * calendar and the stepper are both built from those same numbers. Moving the
 * limit while the guest is deciding is the only honest way to reach the server
 * check — the technique F10 used for its delete guard and F11 for its overlap
 * guard, and it is also the genuine race (a host editing a listing mid-booking).
 */
export async function updateFixtureListing(
  listingId: string,
  patch: { minNights?: number; maxGuests?: number; pricePerNightCents?: number },
): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase
    .from('listings')
    .update({
      ...(patch.minNights !== undefined ? { min_nights: patch.minNights } : {}),
      ...(patch.maxGuests !== undefined ? { max_guests: patch.maxGuests } : {}),
      ...(patch.pricePerNightCents !== undefined
        ? { price_per_night: patch.pricePerNightCents }
        : {}),
    })
    .eq('id', listingId)

  if (error) {
    throw new Error(
      `[e2e/fixtures] could not update listing ${listingId}: ${error.message}`,
    )
  }
}

/**
 * Flips a fixture listing's publish state directly.
 *
 * Setup only — never an assertion. Specs that mean to test publishing drive the
 * real button; this is for the ones that need a *live* listing before they can
 * test something else.
 */
export async function publishFixtureListing(
  listingId: string,
  published: boolean,
): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase
    .from('listings')
    .update({ is_published: published })
    .eq('id', listingId)

  if (error) {
    throw new Error(
      `[e2e/fixtures] could not set publish state on ${listingId}: ${error.message}`,
    )
  }
}

// -----------------------------------------------------------------------------
// Feature 11 — host-managed availability
//
// `blocked_dates` rows are INCLUSIVE [start_date, end_date] and cascade with
// their listing, so nothing here needs a cleanup counterpart: deleting the
// fixture listing takes its blocks with it, and `global-teardown.ts` sweeps any
// listing an interrupted spec left behind.
// -----------------------------------------------------------------------------

/**
 * A block written straight to the table.
 *
 * Setup only, and for one spec shape in particular: reaching `addBlock`'s
 * conflict guard needs a row that appeared *after* the page rendered, because
 * the calendar disables every day it already knows about. Specs that mean to
 * test blocking drive the real calendar instead.
 */
export async function createBlockedDateRow(
  listingId: string,
  options: { startDate: string; endDate: string },
): Promise<{ id: string }> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({
      listing_id: listingId,
      start_date: options.startDate,
      end_date: options.endDate,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not create a blocked range: ${error?.message}`)
  }

  return data
}

/**
 * A listing's blocks, straight from the table — the oracle for every assertion
 * about what the calendar actually wrote. Earliest first.
 *
 * Reading the row rather than the page is what catches an off-by-one in the
 * inclusive/half-open crossing: a UI that renders "Aug 18 – 23" correctly can
 * still have stored `end_date = 2026-08-24`.
 */
export async function readBlockedDates(
  listingId: string,
): Promise<{ id: string; startDate: string; endDate: string }[]> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('blocked_dates')
    .select('id, start_date, end_date')
    .eq('listing_id', listingId)
    .order('start_date', { ascending: true })

  if (error) {
    throw new Error(`[e2e/fixtures] could not read blocked dates: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
  }))
}

// -----------------------------------------------------------------------------
// Reviews (F15)
// -----------------------------------------------------------------------------

/**
 * The review on one booking, straight from the table — or null.
 *
 * **The oracle for every review assertion**, because the page cannot distinguish
 * the claims that matter. Rendered stars prove a number reached a component;
 * they do not prove the row carries the right `listing_id` (which
 * `reviews_insert_own_completed_booking` requires to equal the booking's) or the
 * right `reviewer_id`. Both are read here for exactly that reason.
 *
 * **No cleanup helper accompanies this, and that was checked rather than
 * assumed** (F10's rule about reading FK actions first): `reviews.booking_id`
 * and `reviews.listing_id` are both `on delete cascade` and nothing references
 * `reviews`, so a fixture review dies with the listing that `deleteListing` and
 * `global-teardown.ts` already sweep.
 */
export async function readReviewForBooking(
  bookingId: string,
): Promise<{
  id: string
  listingId: string
  reviewerId: string
  rating: number
  comment: string | null
} | null> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('reviews')
    .select('id, listing_id, reviewer_id, rating, comment')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    throw new Error(`[e2e/fixtures] could not read a review: ${error.message}`)
  }
  if (!data) return null

  return {
    id: data.id,
    listingId: data.listing_id,
    reviewerId: data.reviewer_id,
    rating: data.rating,
    comment: data.comment,
  }
}

/**
 * A review row written out of band, skipping the action and its policy.
 *
 * Added at F17, whose delete-confirm names how many reviews a hard delete would
 * erase — an assertion that needs a *known* count, and one that differs from the
 * booking counts beside it so a wrong field cannot pass (F12's rule about asking
 * what a green assertion would still pass against).
 *
 * Service-role, so it does not need the booking to have finished the way
 * `reviews_insert_own_completed_booking` requires. That is the point: the caller
 * is setting up a listing to delete, not exercising the review path, and dating
 * a booking into the past to satisfy a policy would change the *other* counts
 * the same assertion reads.
 *
 * No cleanup helper, for the reason recorded on `readReviewForBooking`: reviews
 * cascade with their listing.
 */
export async function createReviewRow(options: {
  listingId: string
  bookingId: string
  reviewerId: string
  rating?: number
  comment?: string | null
}): Promise<{ id: string }> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      listing_id: options.listingId,
      booking_id: options.bookingId,
      reviewer_id: options.reviewerId,
      rating: options.rating ?? 5,
      comment: options.comment ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not create a review: ${error?.message}`)
  }

  return data
}

/**
 * Remove a review out of band, behind the page's back.
 *
 * Not cleanup — reviews cascade with their listing (see above). This exists to
 * make **`deleteReview`'s zero-row branch reachable**, which is the one thing
 * that action uniquely does (F13: RLS filters a DELETE rather than raising, so
 * a refused delete returns `{ error: null }` and looks identical to a
 * successful one). A page whose review was removed elsewhere — a second tab, or
 * an admin — is that branch arriving through ordinary use rather than a forged
 * request.
 */
export async function deleteReviewRow(reviewId: string): Promise<void> {
  const supabase = serviceClient()

  const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
  if (error) {
    throw new Error(`[e2e/fixtures] could not delete a review: ${error.message}`)
  }
}

// -----------------------------------------------------------------------------
// Messaging (F16)
//
// **Threads need their own cleanup, and that was checked rather than assumed**
// (F10's read-the-FK-actions rule). Every other child row in this file dies with
// its listing: photos, blocks, bookings and reviews are all `on delete cascade`.
// `message_threads` is NOT — `listing_id` is `on delete set null`, and the
// participants cascade from `profiles`, which the suite never deletes. A fixture
// thread therefore survives `deleteListing` AND `global-teardown.ts`'s listing
// sweep, and would accumulate on every run.
//
// Messages cascade from their thread, so removing the thread is enough.
// -----------------------------------------------------------------------------

/**
 * A thread written straight to the table.
 *
 * Setup only. Specs that mean to test *starting* a conversation drive the real
 * "Message host" button; this is for the ones that need a conversation to
 * already exist before they can test something else — and for the one that needs
 * a thread the fixture user is deliberately **not** in.
 */
export async function createThreadRow(options: {
  guestId: string
  hostId: string
  listingId: string
}): Promise<{ id: string }> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      guest_id: options.guestId,
      host_id: options.hostId,
      listing_id: options.listingId,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not create a thread: ${error?.message}`)
  }

  return data
}

/**
 * A message written behind the page's back.
 *
 * Two spec shapes need this and neither can use the composer: **live delivery**
 * (a message must arrive from someone who is not driving this browser) and the
 * **unread badge** (the fixture user has to receive mail they did not send).
 *
 * Deliberately does NOT bump `last_message_at` — that is `sendMessage`'s job and
 * the thing its gate proof removes. A fixture that bumped it too would hide the
 * defect the proof exists to find.
 */
export async function createMessageRow(options: {
  threadId: string
  senderId: string
  body: string
}): Promise<{ id: string }> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: options.threadId,
      sender_id: options.senderId,
      body: options.body,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[e2e/fixtures] could not create a message: ${error?.message}`)
  }

  return data
}

export type ThreadRowFixture = {
  id: string
  guestId: string
  hostId: string
  listingId: string | null
  lastMessageAt: string
}

/**
 * A thread straight from the table — the oracle for "the conversation was
 * created with the right two participants", which the page cannot show, and for
 * `last_message_at`, which nothing in the database maintains.
 */
export async function readThread(threadId: string): Promise<ThreadRowFixture | null> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('message_threads')
    .select('id, guest_id, host_id, listing_id, last_message_at')
    .eq('id', threadId)
    .maybeSingle()

  if (error) {
    throw new Error(`[e2e/fixtures] could not read a thread: ${error.message}`)
  }
  if (!data) return null

  return {
    id: data.id,
    guestId: data.guest_id,
    hostId: data.host_id,
    listingId: data.listing_id,
    lastMessageAt: data.last_message_at,
  }
}

/**
 * Every thread between a (guest, host, listing) triple — the oracle for
 * `getOrCreateThread`'s idempotency, where the claim is about the row *count*
 * and the page can only ever show one conversation either way.
 */
export async function readThreadsFor(options: {
  guestId: string
  hostId: string
  listingId: string
}): Promise<string[]> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('message_threads')
    .select('id')
    .eq('guest_id', options.guestId)
    .eq('host_id', options.hostId)
    .eq('listing_id', options.listingId)

  if (error) {
    throw new Error(`[e2e/fixtures] could not read threads: ${error.message}`)
  }

  return (data ?? []).map((row) => row.id)
}

/**
 * A thread's messages, oldest first, with every column the assertions turn on.
 *
 * **`readAt` is why this reads the table rather than the page.** The receipt rule
 * is an asymmetry — incoming messages are stamped, your own are not, because
 * `messages_update_read_receipt` requires `sender_id <> auth.uid()` — and
 * nothing rendered distinguishes the two.
 */
export async function readMessages(threadId: string): Promise<
  { id: string; senderId: string; body: string; readAt: string | null }[]
> {
  const supabase = serviceClient()

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, read_at, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`[e2e/fixtures] could not read messages: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    readAt: row.read_at,
  }))
}

/**
 * Every thread either fixture account participates in — the teardown's oracle.
 *
 * Both roles, because the accounts sit on opposite ends by design: the primary
 * user is the guest and the second hosts the listing (F12/F13's arrangement), so
 * a sweep scoped to one column would miss every thread.
 */
export async function threadsInvolvingFixtureUsers(): Promise<string[]> {
  const supabase = serviceClient()
  const ids = await fixtureUserIds()
  const list = ids.join(',')

  const { data, error } = await supabase
    .from('message_threads')
    .select('id')
    .or(`guest_id.in.(${list}),host_id.in.(${list})`)

  if (error) {
    throw new Error(`[e2e/fixtures] could not list fixture threads: ${error.message}`)
  }

  return (data ?? []).map((row) => row.id)
}

/** Removes threads and, by cascade, their messages. */
export async function deleteThreads(threadIds: string[]): Promise<void> {
  if (threadIds.length === 0) return

  const supabase = serviceClient()

  const { error } = await supabase.from('message_threads').delete().in('id', threadIds)
  if (error) {
    throw new Error(`[e2e/fixtures] could not delete threads: ${error.message}`)
  }
}
