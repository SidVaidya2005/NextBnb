import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { deletionImpact, formatMonthYear, type DeletionImpact } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type BookingStatus = Database['public']['Enums']['booking_status']

/** One account as the admin Users table renders it. Read-only in this build. */
export type AdminUser = {
  id: string
  name: string
  /**
   * From `admin_list_users()`, never from `profiles` — the table has no email
   * column precisely because it is publicly readable. Null when the definer read
   * failed or the account has no address on file.
   */
  email: string | null
  /** "March 2025", or null for an unparseable `created_at`. */
  joined: string | null
  listingCount: number
  bookingCount: number
}

/** One listing as the admin Listings table renders it. */
export type AdminListing = {
  id: string
  title: string
  city: string
  country: string
  hostName: string
  /** Integer **cents**. */
  pricePerNight: number
  isPublished: boolean
  /** What a hard delete would take with it — the confirm step's copy. */
  impact: DeletionImpact
}

/** One booking as the admin Bookings table renders it. */
export type AdminBooking = {
  id: string
  checkIn: string
  checkOut: string
  guestsCount: number
  /** Integer **cents** — the guest's total, snapshot at booking time. */
  total: number
  status: BookingStatus
  listingTitle: string
  guestName: string
  /**
   * Whether the **admin** may cancel this — deliberately *not* `canCancelBooking`.
   * That helper mirrors the guest branch of
   * `bookings_update_cancel_own_or_admin` (`check_in >= current_date`); the admin
   * branch of the same USING clause carries no window at all, so an admin can
   * cancel a stay already in progress and the control must render for one.
   */
  canCancel: boolean
}

/** A table plus whether we actually know it is empty. */
export type AdminSection<T> = {
  rows: T[]
  /**
   * True when the read failed. Empty-because-broken and empty-because-empty render
   * differently for F14's reason: a page that says "no listings yet" to an admin
   * whose catalogue is live is worse than one that admits it could not look.
   */
  failed: boolean
}

export type AdminOverview = {
  users: AdminSection<AdminUser>
  listings: AdminSection<AdminListing>
  bookings: AdminSection<AdminBooking>
}

// Defensive ceilings, not pagination — the posture of `MAX_TRIPS` /
// `MAX_RESERVATIONS`. Module-local rather than in `constants.ts`, which holds
// values the *database* also depends on.
// TODO: paginate the admin tables once the catalogue can plausibly exceed these.
const MAX_ADMIN_LISTINGS = 200
const MAX_ADMIN_BOOKINGS = 200

const FAILED = <T,>(): AdminSection<T> => ({ rows: [], failed: true })

/**
 * Everything `/admin` renders, in one round of parallel reads.
 *
 * **These are the queries with nothing but intent to scope them, and that is the
 * whole difficulty of this module.** F13 filtered `guest_id`, F14 filtered
 * `listing_id`, and each could point at a policy branch that answered its screen's
 * question. An admin satisfies *every* branch of *every* SELECT policy — the
 * `listings` policy ends `or public.is_admin()`, so does `bookings`', and
 * `profiles` is public to begin with. So RLS narrows nothing here and there is no
 * filter to get right: the unscoped read **is** the correct query, for the first
 * time in the project. F14's generalisation, arriving at the case it predicted:
 * *"RLS scopes to a union of principals, not to a role."*
 *
 * **The caller must still gate the page.** Nothing in this module checks
 * `is_admin` — `src/app/admin/page.tsx` does, and RLS refuses the rows to anyone
 * else regardless. A non-admin calling this gets their own listings and their own
 * bookings, which is a harmless subset rather than a leak, but it is not a
 * dashboard and the route is what says so.
 *
 * **The two count reads are separate and deliberately uncapped.** The display
 * reads carry ceilings, so counting hosts and guests from them would report "3
 * listings" for someone holding 300 the moment the catalogue outgrows the cap —
 * a wrong number that looks like a right one. F14's rule about the scope-defining
 * read applies to a *counting* read for the same reason. They select ids only.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient()

  const [emailRes, profileRes, listingCountRes, bookingCountRes, listingRes, bookingRes] =
    await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.from('profiles').select('id, full_name, created_at'),
      supabase.from('listings').select('id, host_id'),
      supabase.from('bookings').select('id, guest_id'),
      supabase
        .from('listings')
        .select(
          'id, title, city, country, price_per_night, is_published, host:profiles!listings_host_id_fkey(full_name), bookings(status, check_out), reviews(id)',
        )
        // Newest first: a moderation queue is about what just arrived, so the
        // ceiling should truncate the settled catalogue rather than the new
        // listings the admin is here to look at. F14's ordering lesson.
        .order('created_at', { ascending: false })
        .limit(MAX_ADMIN_LISTINGS),
      supabase
        .from('bookings')
        .select(
          'id, check_in, check_out, guests_count, total, status, listings(title), guest:profiles!bookings_guest_id_fkey(full_name)',
        )
        .order('check_in', { ascending: false })
        .limit(MAX_ADMIN_BOOKINGS),
    ])

  return {
    users: toUsers(emailRes, profileRes, listingCountRes, bookingCountRes),
    listings: toListings(listingRes),
    bookings: toBookings(bookingRes),
  }
}

/** The four reads behind the Users table, reconciled in memory. */
function toUsers(
  emailRes: { data: { id: string; email: string }[] | null; error: { message: string } | null },
  profileRes: {
    data: { id: string; full_name: string | null; created_at: string }[] | null
    error: { message: string } | null
  },
  listingCountRes: {
    data: { id: string; host_id: string }[] | null
    error: { message: string } | null
  },
  bookingCountRes: {
    data: { id: string; guest_id: string }[] | null
    error: { message: string } | null
  },
): AdminSection<AdminUser> {
  if (profileRes.error) {
    console.error('[queries/admin] getAdminOverview profiles failed:', profileRes.error.message)
    return FAILED()
  }

  // `admin_list_users()` raises 42501 for a non-admin rather than returning
  // nothing, so an error here is either "not an admin" (the route already
  // redirected, so: a forged call) or a genuine fault. Either way the rest of the
  // table is still true, so the emails degrade to null instead of failing the
  // whole section — this is the one column RLS cannot reach, not the point of it.
  if (emailRes.error) {
    console.error('[queries/admin] admin_list_users failed:', emailRes.error.message)
  }

  const emails = new Map((emailRes.data ?? []).map((row) => [row.id, row.email]))

  const listingCounts = countBy(listingCountRes, 'host_id', 'listings')
  const bookingCounts = countBy(bookingCountRes, 'guest_id', 'bookings')

  const rows = (profileRes.data ?? []).map((profile) => ({
    id: profile.id,
    // Same fallback as `toReservation`: a missing name loses the label, not the row.
    name: profile.full_name?.trim() || 'Unnamed user',
    email: emails.get(profile.id) ?? null,
    joined: formatMonthYear(profile.created_at),
    listingCount: listingCounts.get(profile.id) ?? 0,
    bookingCount: bookingCounts.get(profile.id) ?? 0,
  }))

  // Newest account first — the same "what just arrived" ordering the other two
  // tables use. `admin_list_users()` returns oldest-first, but the join happens
  // here, so its order never reaches the page.
  rows.sort((a, b) => b.id.localeCompare(a.id))

  return { rows, failed: false }
}

/**
 * Tally an id-only read by one of its columns.
 *
 * A failed count read yields an empty map, so every user reads 0 — wrong, but
 * *visibly* wrong beside a populated Listings table, and it is logged. The
 * alternative (failing the whole Users section) would hide the names and emails
 * over a subordinate number.
 */
function countBy<K extends string>(
  res: { data: Record<K, string>[] | null; error: { message: string } | null },
  column: K,
  label: string,
): Map<string, number> {
  if (res.error) {
    console.error(`[queries/admin] getAdminOverview ${label} count failed:`, res.error.message)
    return new Map()
  }

  const counts = new Map<string, number>()
  for (const row of res.data ?? []) {
    counts.set(row[column], (counts.get(row[column]) ?? 0) + 1)
  }
  return counts
}

/** The listings read shape. `host` is hand-typed `| null` for F08's reason. */
type AdminListingRow = {
  id: string
  title: string
  city: string
  country: string
  price_per_night: number
  is_published: boolean
  host: { full_name: string | null } | null
  bookings: { status: string; check_out: string }[]
  reviews: { id: string }[]
}

function toListings(res: {
  data: AdminListingRow[] | null
  error: { message: string } | null
}): AdminSection<AdminListing> {
  if (res.error) {
    console.error('[queries/admin] getAdminOverview listings failed:', res.error.message)
    return FAILED()
  }

  // Decided once here on the server, so every row's impact is measured against
  // the same day — F11's note on `getOwnListingAvailability`.
  const today = new Date()

  return {
    rows: (res.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      city: row.city,
      country: row.country,
      hostName: row.host?.full_name?.trim() || 'Unnamed host',
      pricePerNight: row.price_per_night,
      isPublished: row.is_published,
      impact: deletionImpact({ bookings: row.bookings, reviews: row.reviews }, today),
    })),
    failed: false,
  }
}

/** The bookings read shape. Both embeds hand-typed `| null` for F08's reason. */
type AdminBookingRow = {
  id: string
  check_in: string
  check_out: string
  guests_count: number
  total: number
  status: BookingStatus
  listings: { title: string } | null
  guest: { full_name: string | null } | null
}

function toBookings(res: {
  data: AdminBookingRow[] | null
  error: { message: string } | null
}): AdminSection<AdminBooking> {
  if (res.error) {
    console.error('[queries/admin] getAdminOverview bookings failed:', res.error.message)
    return FAILED()
  }

  return {
    rows: (res.data ?? []).map((row) => ({
      id: row.id,
      checkIn: row.check_in,
      checkOut: row.check_out,
      guestsCount: row.guests_count,
      total: row.total,
      status: row.status,
      // A booking whose listing is unreadable keeps its row — F13's posture. The
      // stay is the thing being moderated, and the cancel control lives on it.
      listingTitle: row.listings?.title?.trim() || 'Listing unavailable',
      guestName: row.guest?.full_name?.trim() || 'Guest',
      canCancel: row.status === 'confirmed',
    })),
    failed: false,
  }
}
