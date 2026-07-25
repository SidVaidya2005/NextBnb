import { parseISO } from 'date-fns'
import { z } from 'zod'

import {
  AMENITIES,
  MAX_GUESTS,
  PROPERTY_TYPES,
  type Amenity,
  type PropertyType,
} from '@/lib/constants'
import { nightsBetween, todayISO } from '@/lib/utils'

/** `searchParams` as Next hands them over: repeated keys arrive as an array. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * A validated stay. Present **only** when both dates survived validation and
 * form a real forward-looking range.
 *
 * This exists so the availability filter cannot be half-applied. If the query
 * read `checkIn`/`checkOut` separately it would be one forgotten `&&` away from
 * building an unbounded range and excluding every listing.
 */
export type Stay = {
  checkIn: string
  checkOut: string
  nights: number
}

export type ListingFilters = {
  city?: string
  /** Kept for form round-trip even when incomplete; never used to filter. */
  checkIn?: string
  checkOut?: string
  /** The only date value the query may filter on. */
  stay?: Stay
  guests?: number
  /** Integer **cents** — converted from the dollars the URL carries. */
  minPriceCents?: number
  maxPriceCents?: number
  propertyType?: PropertyType
  /** Always an array; AND semantics — a listing must have every one. */
  amenities: Amenity[]
}

export const NO_FILTERS: ListingFilters = { amenities: [] }

/**
 * A listing id taken from the URL path.
 *
 * Checked before the id reaches a query: `id` is a `uuid` column, so Postgres
 * raises `22P02` on anything that is not one. That surfaces as a logged database
 * error for what is really just a stale or hand-edited link — the right answer
 * is a 404, decided here, before any round trip.
 */
export const listingIdSchema = z.uuid()

// $100k/night is far past any plausible listing and stops a hostile URL from
// turning a price bound into a giant number the query has to reason about.
const MAX_PRICE_DOLLARS = 100_000

const amenitySchema = z.enum(AMENITIES)

/**
 * Every field is independently `.catch()`-ed so one bad value cannot take the
 * others down with it: `?city=Kyoto&guests=abc` still filters by city. A URL is
 * an untrusted, hand-editable, bookmarkable surface — it degrades, it never
 * throws.
 */
const searchParamsSchema = z.object({
  city: z.string().trim().min(1).max(120).optional().catch(undefined),
  checkIn: z.iso.date().optional().catch(undefined),
  checkOut: z.iso.date().optional().catch(undefined),
  guests: z.coerce.number().int().min(1).max(MAX_GUESTS).optional().catch(undefined),
  minPrice: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PRICE_DOLLARS)
    .optional()
    .catch(undefined),
  maxPrice: z.coerce
    .number()
    .nonnegative()
    .max(MAX_PRICE_DOLLARS)
    .optional()
    .catch(undefined),
  type: z.enum(PROPERTY_TYPES).optional().catch(undefined),
})

/**
 * Read the six search dimensions out of the URL.
 *
 * The URL is the source of truth for search state (code-standards.md), so this
 * is the one place its shape is defined — and the one place prices cross from
 * the dollars a human reads to the integer cents everything else uses.
 */
export function parseListingFilters(raw: RawSearchParams): ListingFilters {
  const parsed = searchParamsSchema.safeParse({
    city: first(raw.city),
    checkIn: first(raw.checkIn),
    checkOut: first(raw.checkOut),
    guests: first(raw.guests),
    minPrice: first(raw.minPrice),
    maxPrice: first(raw.maxPrice),
    type: first(raw.type),
  })

  // Unreachable — every field catches — but returning the empty filter set is
  // the right answer if that ever stops being true.
  if (!parsed.success) return NO_FILTERS

  const data = parsed.data
  const today = todayISO()

  // Search is forward-looking: a past check-in is dropped rather than used.
  const checkIn = data.checkIn && data.checkIn >= today ? data.checkIn : undefined
  // A check-out only survives alongside a valid check-in that it postdates —
  // so an incomplete or inverted range can never reach the availability filter.
  const checkOut =
    checkIn && data.checkOut && data.checkOut > checkIn ? data.checkOut : undefined

  const [minPriceDollars, maxPriceDollars] = orderedPriceBounds(
    data.minPrice,
    data.maxPrice,
  )

  return {
    city: data.city,
    checkIn,
    checkOut,
    stay:
      checkIn && checkOut
        ? {
            checkIn,
            checkOut,
            nights: nightsBetween(parseISO(checkIn), parseISO(checkOut)),
          }
        : undefined,
    guests: data.guests,
    minPriceCents: toCents(minPriceDollars),
    maxPriceCents: toCents(maxPriceDollars),
    propertyType: data.type,
    amenities: parseAmenities(raw.amenities),
  }
}

/** Whether the user narrowed anything — drives the "no matches" empty state. */
export function hasActiveFilters(filters: ListingFilters): boolean {
  return Boolean(
    filters.city ||
      filters.checkIn ||
      filters.stay ||
      filters.guests ||
      filters.minPriceCents !== undefined ||
      filters.maxPriceCents !== undefined ||
      filters.propertyType ||
      filters.amenities.length > 0,
  )
}

/**
 * Collapse a param to a single usable string.
 *
 * An empty value (`?city=`) is treated as absent — otherwise a blank numeric
 * field coerces to 0 and silently becomes a real `minPrice=$0` filter.
 */
function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw.trim() === '' ? undefined : raw
}

/**
 * An inverted range ("$300 to $50") is what someone means, entered backwards,
 * so it is swapped rather than dropped — dropping it would show every listing
 * and look like the filter was ignored.
 */
function orderedPriceBounds(
  min: number | undefined,
  max: number | undefined,
): [number | undefined, number | undefined] {
  if (min !== undefined && max !== undefined && min > max) return [max, min]
  return [min, max]
}

function toCents(dollars: number | undefined): number | undefined {
  return dollars === undefined ? undefined : Math.round(dollars * 100)
}

/**
 * Amenities, accepted in both forms the app can produce: the comma-separated
 * `amenities=wifi,kitchen` that shared links carry, and the repeated
 * `amenities=wifi&amenities=kitchen` that a plain HTML checkbox group posts.
 * Supporting both is what lets the filter panel work without JavaScript.
 *
 * Unknown values are dropped rather than rejected, so a stale bookmark naming a
 * retired amenity still filters by the ones it gets right.
 */
function parseAmenities(raw: string | string[] | undefined): Amenity[] {
  if (raw === undefined) return []

  const valid = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value): value is Amenity => amenitySchema.safeParse(value).success)

  return [...new Set(valid)]
}
