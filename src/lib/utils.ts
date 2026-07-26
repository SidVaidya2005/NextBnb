import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
