import {
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameYear,
  parseISO,
  subDays,
} from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { SERVICE_FEE_PCT } from '@/lib/constants'

// The return-shape contract used across every server-action / boundary.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/**
 * Format an integer number of **cents** as USD. All money in NextBnb is stored
 * and computed as integer cents — this is the only place it becomes a display
 * string. e.g. formatPrice(9500) -> "$95.00".
 */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100)
}

/**
 * Nights occupied by a stay, treated as half-open `[checkIn, checkOut)` so the
 * checkout day is not counted — consistent with the DB `daterange(..., '[)')`
 * exclusion constraint. e.g. Aug 1 -> Aug 5 is 4 nights.
 */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return differenceInCalendarDays(checkOut, checkIn)
}

/** What a stay costs, every field an integer number of **cents**. */
export type PriceBreakdown = {
  /** `nights × price_per_night`. */
  subtotal: number
  /** Echoed from the listing so the four lines the guest reads are one object. */
  cleaningFee: number
  /** `round(subtotal × SERVICE_FEE_PCT)`, half-up. */
  serviceFee: number
  total: number
}

/**
 * The price of a stay, computed once for both the guest and the row.
 *
 * **One implementation, two callers** — the booking widget renders this live and
 * `createBooking` snapshots the same numbers onto the `bookings` row, so the total
 * a guest agreed to and the total stored cannot disagree. The same arrangement as
 * `findBlockConflict` and `blocksListingDeletion`, and for the same reason.
 *
 * Integer cents throughout (`architecture.md`: never arithmetic on floating-point
 * currency). `Math.round` is half-up for non-negative values, which is the rounding
 * rule `architecture.md` → Booking Rules specifies; every input here is
 * non-negative by DB check constraint, so its round-toward-`+∞` behaviour on
 * negatives never comes up. It also absorbs the float artifact in the percentage
 * multiply — `14500 * 0.14` is `2030.0000000000002` — so no decimal library is
 * needed for a single multiplication into whole cents.
 *
 * The result is a **snapshot**: once written it is never recomputed from the
 * listing, because the host may edit the price afterwards.
 */
export function priceBreakdown(stay: {
  nights: number
  /** Integer cents. */
  pricePerNight: number
  /** Integer cents; zero for the listings that charge none. */
  cleaningFee: number
}): PriceBreakdown {
  const subtotal = stay.nights * stay.pricePerNight
  const serviceFee = Math.round(subtotal * SERVICE_FEE_PCT)

  return {
    subtotal,
    cleaningFee: stay.cleaningFee,
    serviceFee,
    total: subtotal + stay.cleaningFee + serviceFee,
  }
}

/**
 * What the host keeps from a reservation: the guest's total less the service fee.
 *
 * The service fee is the **platform's** cut, not the host's, so the stored `total`
 * — which is what `/trips` shows the guest — is the wrong number to print on a host
 * surface without saying whose it is. `total - service_fee` is `subtotal +
 * cleaning_fee`, and F14 shows both figures so neither reads as the other.
 *
 * Derived from the booking's stored **snapshot**, never from the listing: a host who
 * edits their nightly price afterwards must not retroactively change what an
 * existing reservation earned. Integer cents in, integer cents out.
 *
 * This computes a **display** figure. NextBnb moves no money (`project-overview.md`
 * → out of scope), so there is no payout this is the authority for.
 */
export function hostEarnings(booking: {
  /** Integer cents — `bookings.total`. */
  total: number
  /** Integer cents — `bookings.service_fee`. */
  serviceFee: number
}): number {
  return booking.total - booking.serviceFee
}

/**
 * A calendar date as `YYYY-MM-DD`, the format every `date` column and every
 * search param uses. Lexicographic order on this format is chronological order,
 * which is why the filters compare dates as plain strings.
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Today as `YYYY-MM-DD` in the server's local zone.
 *
 * Deliberately local rather than UTC: it is compared against dates a user typed
 * into a calendar, not against a stored timestamp. Around midnight this can sit
 * one day either side of the database's `current_date`; for a search filter
 * that is a non-event, and the booking action (F12) re-checks against the DB.
 */
export function todayISO(): string {
  return toISODate(new Date())
}

/**
 * A date range rendered for the search pill — "Aug 5 – 9", collapsing the month
 * when both ends share one. Returns null when the range is incomplete, so the
 * caller can fall back to its placeholder.
 */
export function formatDateRange(
  checkIn: string | undefined,
  checkOut: string | undefined,
): string | null {
  if (!checkIn || !checkOut) return null

  const start = parseISO(checkIn)
  const end = parseISO(checkOut)
  const sameMonth = format(start, 'yyyy-MM') === format(end, 'yyyy-MM')

  return `${format(start, 'MMM d')} – ${format(end, sameMonth ? 'd' : 'MMM d')}`
}

/**
 * An inclusive span rendered for the host's availability list — "Aug 18 – 23",
 * collapsing the month when both ends share one and collapsing the range
 * entirely when it is a single day.
 *
 * Distinct from `formatDateRange`, which renders a half-open *stay*: there the
 * two ends are always different days, so "Aug 18 – 18" is unreachable. Here it
 * is the ordinary way to block one night, and it needs to read as "Aug 18".
 */
export function formatInclusiveRange(range: { start: string; end: string }): string {
  const start = parseISO(range.start)
  const end = parseISO(range.end)

  if (range.start === range.end) return format(start, 'MMM d')

  const sameMonth = format(start, 'yyyy-MM') === format(end, 'yyyy-MM')
  return `${format(start, 'MMM d')} – ${format(end, sameMonth ? 'd' : 'MMM d')}`
}

/**
 * Mean of a listing's review ratings, or `null` when it has none.
 *
 * `null` is the "New" signal the card renders — deliberately distinct from `0`,
 * which is not a possible rating (the DB checks 1–5). Rounding is left to the
 * display edge so callers can choose their precision.
 */
export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
}

/**
 * The photo a listing leads with: the one flagged `is_cover`, else the lowest
 * `position`, else nothing.
 *
 * The fallback is not defensive padding — the DB only guarantees *at most* one
 * cover (a partial unique index); it is F09's create action that guarantees at
 * least one. A listing whose cover row was deleted must still render.
 */
export function coverPhotoOf<T extends { is_cover: boolean; position: number }>(
  photos: readonly T[],
): T | null {
  if (photos.length === 0) return null
  const flagged = photos.find((photo) => photo.is_cover)
  if (flagged) return flagged
  return photos.reduce((lowest, photo) =>
    photo.position < lowest.position ? photo : lowest,
  )
}

/**
 * Every photo in gallery order: the cover first, then ascending `position`.
 *
 * The same rule `coverPhotoOf` applies, widened to the whole set — so
 * `orderedPhotos(photos)[0]` and `coverPhotoOf(photos)` always agree, including
 * when no row is flagged (see that function for why the fallback is load-bearing).
 * Sorts a copy: the caller's array is query data shared with other renders.
 */
export function orderedPhotos<T extends { is_cover: boolean; position: number }>(
  photos: readonly T[],
): T[] {
  return [...photos].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1
    return a.position - b.position
  })
}

/** The `position` a newly uploaded photo takes: the end of the strip. */
export function nextPhotoPosition(
  photos: readonly { position: number }[],
): number {
  if (photos.length === 0) return 0
  return Math.max(...photos.map((photo) => photo.position)) + 1
}

/**
 * The full set of `position` writes that moves one photo within the gallery.
 *
 * Returns every photo renumbered `0..n-1`, or `null` when the move is a no-op
 * (the photo is unknown, or already at the end it is being moved toward) so the
 * caller can skip the round trip.
 *
 * **Renumbering everything, rather than swapping two rows, is deliberate.**
 * Positions drift — a delete leaves a gap, and two rows can legitimately share a
 * position because nothing in the schema forbids it (`position int not null
 * default 0`, no unique index). A swap built on `position - 1` compounds that
 * drift; assigning the whole sequence from the order the user is actually
 * looking at heals it on every move.
 *
 * `'front'` is what "Make cover" uses. Keeping the cover at position 0 is what
 * makes this function's ordering agree with `orderedPhotos` — that sorts
 * cover-first, so a cover left in the middle would show one order in the host's
 * editor and a different one on the listing page.
 */
export function reorderedPositions<
  T extends { id: string; is_cover: boolean; position: number },
>(
  photos: readonly T[],
  photoId: string,
  move: 'earlier' | 'later' | 'front',
): { id: string; position: number }[] | null {
  const order = orderedPhotos(photos)
  const from = order.findIndex((photo) => photo.id === photoId)
  if (from === -1) return null

  const to = move === 'front' ? 0 : move === 'earlier' ? from - 1 : from + 1
  if (to === from || to < 0 || to >= order.length) return null

  const moved = [...order]
  const [photo] = moved.splice(from, 1)
  moved.splice(to, 0, photo)

  return moved.map((entry, index) => ({ id: entry.id, position: index }))
}

/**
 * Rows from `favorites` reduced to the listings a card can render, dropping any
 * whose listing came back empty.
 *
 * That null is not paranoia, and **TypeScript will not warn you about it**:
 * `listing_id` is a NOT NULL foreign key, so postgrest-js types the embed as
 * always-present. RLS disagrees at runtime — the favorite row survives
 * independently of the listing's visibility, so a host who unpublishes a stay
 * someone saved leaves that person holding a row whose `listings` embed comes
 * back null. PostgREST reports it as absent, not as an error. This filter is
 * what keeps `/favorites` from rendering a card with no title and no price, and
 * the type system would never have asked for it.
 */
export function toFavoriteCards<L, C>(
  rows: readonly { listings: L | null }[],
  toCard: (listing: L) => C,
): C[] {
  return rows
    .map((row) => row.listings)
    .filter((listing): listing is L => listing !== null)
    .map(toCard)
}

/**
 * Whether a listing still owes a guest a stay, and so must not be deleted.
 *
 * `bookings.listing_id` is `on delete cascade`, so deleting a listing does not
 * cancel its reservations — it **erases** them: no `cancelled_at`, no row, and
 * nothing left in the guest's Trips. This is the one rule that stops that, and
 * it lives here so the query that disables the button and the action that
 * refuses the write cannot drift apart.
 *
 * **The cutoff is deliberately a day wide.** The comparison happens in JS while
 * the stay is stored as a `date`, and `todayISO` can sit either side of the
 * database's `current_date` near midnight (see its own note). One of those
 * sides deletes a stay the database still considers in progress; the other
 * merely refuses a delete that could have gone ahead. Yesterday's date picks
 * the harmless one.
 *
 * A cancelled booking frees its dates and holds nobody's plans, so it does not
 * block — the same rule the exclusion constraint applies.
 */
export function blocksListingDeletion(
  bookings: readonly { status: string; check_out: string }[],
  today: Date = new Date(),
): boolean {
  const cutoff = toISODate(subDays(today, 1))
  return bookings.some(
    (booking) => booking.status === 'confirmed' && booking.check_out >= cutoff,
  )
}

/** The two sections `/trips` splits a guest's bookings into. */
export type TripSection = 'upcoming' | 'past'

/**
 * Which half of `/trips` a booking belongs in.
 *
 * **"Upcoming" means *still going to happen*, not *in the future*.** Two
 * consequences follow, and both are deliberate:
 *
 * - A stay whose check-in has passed but whose checkout has not is **upcoming**,
 *   because the guest is on it. Filing it under "Past" would tell someone their
 *   current stay is over. It is not cancellable — see `canCancelBooking` — so the
 *   card states why instead of offering a control.
 * - A **cancelled** booking is past whatever its dates say. It is not happening,
 *   and listing it beside stays that are would be the same lie in reverse.
 *
 * Compared as `YYYY-MM-DD` strings, so there is no Date here to be an hour off
 * (see `toISODate`). `check_out` is the half-open end — the day the guest
 * leaves — so a stay ending today is still upcoming for the few hours it takes
 * them to leave, which is the generous direction and costs nothing.
 */
export function tripSection(
  booking: { status: string; check_out: string },
  today: Date = new Date(),
): TripSection {
  const isActive =
    booking.status === 'confirmed' && booking.check_out >= toISODate(today)
  return isActive ? 'upcoming' : 'past'
}

/**
 * Whether a guest may still cancel this stay.
 *
 * **This mirrors `bookings_update_cancel_own_or_admin`'s USING clause exactly**
 * (`status = 'confirmed' and check_in >= current_date`) and is the only place
 * that rule is written in TypeScript. It decides whether the control renders;
 * the policy decides whether the write lands, and `cancelBooking`'s zero-row
 * check is what notices when the two disagree.
 *
 * **The cutoff is deliberately *not* widened, inverting F10 and F11.** Both
 * pushed their cutoffs out by a day because refusing was the harmless error.
 * Here the two sides fail differently: `todayISO()` can sit either side of the
 * database's `current_date` near midnight, and offering a Cancel the server then
 * refuses produces an honest sentence, while hiding one the server would have
 * accepted silently takes the option away. Matching the policy is what keeps the
 * disagreement recoverable.
 */
export function canCancelBooking(
  booking: { status: string; check_in: string },
  today: Date = new Date(),
): boolean {
  return booking.status === 'confirmed' && booking.check_in >= toISODate(today)
}

/**
 * Whether this guest may still review this stay.
 *
 * **This restates `reviews_insert_own_completed_booking`'s window verbatim**
 * (`b.status = 'confirmed' and b.check_out < current_date`), plus the
 * one-per-booking rule the `reviews.booking_id` unique index owns. It decides
 * whether the form renders; the policy and the index decide whether the write
 * lands. Same division of labour as `canCancelBooking`.
 *
 * **The cutoff is deliberately not widened, and the reason differs from
 * `canCancelBooking`'s.** There, both directions were survivable. Here the
 * asymmetry is structural: a failed INSERT `WITH CHECK` **raises** `42501` — it
 * does not filter the way a refused UPDATE does — so a form offered a minute
 * early produces an honest, retryable sentence, while hiding one the database
 * would have accepted takes the option away with nothing said. F10 and F11
 * widened their cutoffs because refusing was the harmless error; here refusing
 * is *also* the harmless error, so matching the policy exactly is what refuses.
 *
 * **`status` is load-bearing beyond "is it finished".** A cancelled stay is Past
 * by `tripSection` however its dates read, and it is never reviewable — nobody
 * stayed. The two functions agree on every confirmed booking (`check_out <
 * today` is exactly the negation of `tripSection`'s `check_out >= today`), so a
 * reviewable stay is always in the Past section and the form can never appear
 * under Upcoming. The unit tests assert that rather than trusting it.
 */
export function canReviewBooking(
  booking: { status: string; check_out: string },
  hasReview: boolean,
  today: Date = new Date(),
): boolean {
  if (hasReview) return false
  return booking.status === 'confirmed' && booking.check_out < toISODate(today)
}

/**
 * How many messages in a thread the viewer has not read.
 *
 * **Both conditions are load-bearing, and only one of them is the database's.**
 * `read_at is null` is the obvious half. `sender_id !== viewerId` is the half
 * nothing below this function enforces for *counting*: the
 * `messages_update_read_receipt` policy stops a user **stamping** their own
 * message read, which means a sent message's `read_at` stays null until the
 * other person opens the thread — so counting naively would show every message
 * you send as unread mail to yourself, growing as you talk. The policy causes
 * the problem; it cannot fix it, because it governs writes and this is a read.
 *
 * Deliberately a count rather than a boolean: the inbox renders the number, and
 * `> 0` is a cheaper question any caller can ask of the result.
 */
export function unreadCount(
  messages: readonly { sender_id: string; read_at: string | null }[],
  viewerId: string,
): number {
  return messages.filter(
    (message) => message.sender_id !== viewerId && message.read_at === null,
  ).length
}

/**
 * The other person in a thread — whose name and avatar the inbox shows.
 *
 * `guest` and `host` are roles **on the thread**, not on the person: the same
 * user is the guest in a conversation about someone else's place and the host in
 * one about their own. So neither field can be assumed to be "them", and every
 * surface that names a participant has to ask this question.
 *
 * A viewer who is neither participant is unreachable — `message_threads_select_participant`
 * is `guest_id = uid or host_id = uid`, so a thread only reaches this function
 * once RLS has already established the viewer is in it.
 */
export function threadPartner<P extends { id: string }>(
  thread: { guest: P; host: P },
  viewerId: string,
): P {
  return thread.guest.id === viewerId ? thread.host : thread.guest
}

/**
 * A message timestamp as the inbox and thread print it: the time for today, the
 * date within this year, the month and year before that.
 *
 * The rule is "show the smallest unit that still disambiguates" — a time alone
 * is useless on a message from March, and a year is noise on one from an hour
 * ago. `now` is injected so the three branches are testable without freezing the
 * clock.
 *
 * Returns null on an unparseable value rather than throwing, following
 * `formatMonthYear`: `format` throws on an invalid Date, and a bad timestamp
 * should cost the line, not the page.
 */
export function formatThreadTimestamp(
  iso: string,
  now: Date = new Date(),
): string | null {
  const at = parseISO(iso)
  if (Number.isNaN(at.getTime())) return null

  if (isSameDay(at, now)) return format(at, 'h:mm a')
  if (isSameYear(at, now)) return format(at, 'MMM d')
  return format(at, 'MMM yyyy')
}

/**
 * A span of occupied calendar days, **both ends inclusive** — the shape
 * `blocked_dates` already stores and the shape a calendar renders.
 *
 * Bookings are the other model (half-open `[check_in, check_out)`), so they are
 * converted by `bookedNightsRange` before they meet anything here. Keeping one
 * model on this side of the boundary is what stops the two drifting: every
 * function below may assume both ends are occupied.
 */
export type InclusiveRange = { start: string; end: string }

/**
 * The nights a booking actually occupies, as an inclusive range.
 *
 * **The `- 1` is the whole point.** A stay is half-open `[check_in, check_out)`:
 * the guest leaves on the checkout day and another guest may arrive that same
 * morning, which is precisely what the `btree_gist` exclusion constraint permits
 * and what `unavailable_listing_ids` reproduces with `'[)'`. Passing `check_out`
 * through unchanged would paint one extra night as occupied on every calendar in
 * the app and refuse a legal same-day turnover — a wrong answer that looks
 * entirely reasonable on screen.
 *
 * `check_out > check_in` is a table check constraint, so the result always has
 * `end >= start`; a one-night stay collapses to a single day.
 */
export function bookedNightsRange(booking: {
  check_in: string
  check_out: string
}): InclusiveRange {
  return {
    start: booking.check_in,
    end: toISODate(subDays(parseISO(booking.check_out), 1)),
  }
}

/**
 * Whether two inclusive spans share at least one day.
 *
 * Compared as plain `YYYY-MM-DD` **strings**, which is exact rather than merely
 * convenient: the format is zero-padded and fixed-width, so lexicographic order
 * *is* chronological order (see `toISODate`). That keeps this free of timezone
 * and DST reasoning entirely — there is no Date here to be an hour off.
 *
 * Both ends count, so ranges that merely touch (`a.end === b.start`) overlap,
 * while adjacent ones (`b.start === a.end + 1 day`) do not.
 */
export function rangesOverlap(a: InclusiveRange, b: InclusiveRange): boolean {
  return a.start <= b.end && b.start <= a.end
}

/** What stands in the way of a proposed block, or nothing. */
export type BlockConflict = 'booking' | 'block'

/**
 * The first thing a proposed block collides with — a guest's confirmed stay, an
 * existing block, or nothing at all.
 *
 * One implementation, two callers: the action refuses on it and the calendar
 * greys out days with it, so the control a host sees and the rule the server
 * enforces cannot disagree. The same arrangement as `blocksListingDeletion`,
 * which exists for the same reason.
 *
 * **Bookings are reported ahead of blocks when a range hits both.** A host can
 * remove their own block and try again; they cannot remove someone's stay. The
 * more actionable half of the answer is the one worth saying.
 */
export function findBlockConflict(
  candidate: InclusiveRange,
  occupied: {
    booked: readonly InclusiveRange[]
    blocked: readonly InclusiveRange[]
  },
): BlockConflict | null {
  if (occupied.booked.some((range) => rangesOverlap(candidate, range))) {
    return 'booking'
  }
  if (occupied.blocked.some((range) => rangesOverlap(candidate, range))) {
    return 'block'
  }
  return null
}

/**
 * A listing's capacity line — "5 guests · 2 bedrooms · 3 beds · 1.5 baths".
 *
 * `bathrooms` is `numeric(3,1)`, so halves are real and must not be pluralized
 * as singular ("1.5 baths", not "1.5 bath"). `bedrooms` is 0 for a studio, which
 * reads as "Studio" rather than "0 bedrooms".
 */
export function formatCapacity(capacity: {
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: number
}): string {
  return [
    pluralize(capacity.maxGuests, 'guest'),
    capacity.bedrooms === 0 ? 'Studio' : pluralize(capacity.bedrooms, 'bedroom'),
    pluralize(capacity.beds, 'bed'),
    pluralize(capacity.bathrooms, 'bath'),
  ].join(' · ')
}

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}

/**
 * A check-in/check-out time for display — `'15:00'` -> `'3:00 PM'`.
 *
 * `check_in_time`/`check_out_time` are plain `text` columns, not `time`, so the
 * database guarantees nothing about their shape. Anything that is not `HH:MM`
 * returns null and the caller omits the row, rather than rendering garbage or
 * throwing on a listing that is otherwise fine.
 */
export function formatTimeOfDay(value: string | null): string | null {
  if (!value) return null

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`
}

/**
 * A timestamp as "March 2025", for the host card's member-since line. Returns
 * null on an unparseable value so a malformed timestamp costs the line, not the
 * page — `format` throws on an invalid Date.
 */
export function formatMonthYear(iso: string): string | null {
  const date = parseISO(iso)
  if (Number.isNaN(date.getTime())) return null
  return format(date, 'MMMM yyyy')
}

/**
 * A snake_case constant rendered as a label — `tiny_home` -> "Tiny home",
 * `air_conditioning` -> "Air conditioning". Keeps `PROPERTY_TYPES` and
 * `AMENITIES` as the single source of truth instead of pairing each one with a
 * hand-written display string that can drift.
 */
export function humanizeToken(value: string): string {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Compose Tailwind classes conditionally (clsx) and resolve conflicts (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// C0 control characters plus DEL. A raw newline inside a redirect target can
// split the Location header, so they are rejected outright.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/**
 * Sanitize a post-sign-in `next` destination into a same-origin path.
 *
 * This is an open-redirect guard, not a formatter: `next` travels through the
 * URL and back from the OAuth provider, so its value is fully attacker
 * controlled. Supabase's own sample only checks `startsWith('/')`, which still
 * admits the protocol-relative `//evil.com` — browsers read that as an absolute
 * URL and leave the site. Anything that is not a single-slash-rooted path
 * collapses to '/'.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/'
  if (!raw.startsWith('/')) return '/'
  // '//host' is protocol-relative; '/\host' is the backslash variant browsers
  // normalise to the same thing.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  if (CONTROL_CHARS.test(raw)) return '/'
  return raw
}
