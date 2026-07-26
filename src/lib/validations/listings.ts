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
import type { Database } from '@/types/database.types'

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

/**
 * Dollars as a human types them → the integer cents everything else uses.
 *
 * The one crossing point between the two representations, shared by the search
 * URL (which carries dollars) and the create-listing form (which collects them).
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Integer cents → the dollars a form field holds. The inverse of
 * `dollarsToCents`, used when an existing listing is loaded back into the edit
 * form: a round trip through both must return the stored cents unchanged, or
 * merely opening the editor and saving would move a price.
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

function toCents(dollars: number | undefined): number | undefined {
  return dollars === undefined ? undefined : dollarsToCents(dollars)
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

// -----------------------------------------------------------------------------
// Feature 09 — creating a listing
//
// These schemas mirror the DB constraints in migration `0001` field for field.
// The database is the real guard; validating here is what turns a constraint
// violation into a message on the right input instead of a 500.
//
// Money is collected in DOLLARS and converted by `dollarsToCents` at the call
// site, exactly as `parseListingFilters` does for the search URL — the schema
// validates, the surrounding function converts. Keeping the schema's input and
// output identical is also what lets react-hook-form bind to it without a
// separate transformed-values type.
// -----------------------------------------------------------------------------

// Bounds that exist only to keep a hostile or fat-fingered payload sane. The DB
// caps `max_guests` at 16 and `bathrooms` at numeric(3,1); the rest are product
// judgements, kept local to this file like MAX_PRICE_DOLLARS above.
const MAX_TITLE = 120
const MAX_DESCRIPTION = 2_000
const MAX_HOUSE_RULES = 1_000
const MAX_PLACE_NAME = 120
const MAX_BEDROOMS = 20
const MAX_BEDS = 30
const MAX_BATHROOMS = 20
const MAX_MIN_NIGHTS = 365

/** Strict 24-hour `HH:MM`. `check_in_time` is a plain text column, so this is
 *  the only thing standing between it and a value `formatTimeOfDay` renders as
 *  nothing. Deliberately stricter than that reader, which tolerates `9:00`. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** House defaults for the two nullable time columns, shared by the form's blank
 *  state and by an edit loading a listing that has none. */
export const DEFAULT_CHECK_IN_TIME = '15:00'
export const DEFAULT_CHECK_OUT_TIME = '11:00'

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`)

/**
 * A nullable text column: the form posts `''` for "left blank", the DB wants null.
 *
 * **`.nullish()` is what makes this schema idempotent, and that is load-bearing.**
 * The client validates with this schema and then sends the *result* to the server
 * action, which validates again with the same schema — so the schema must accept
 * its own output. Without `null` in the input set, every listing with a blank
 * optional field passed on the client and was rejected on the server with
 * "Please check the highlighted fields", pointing at no field in particular.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .nullish()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value))

export const createListingSchema = z.object({
  title: requiredText(MAX_TITLE, 'Give your place a title.'),
  description: optionalText(MAX_DESCRIPTION),
  propertyType: z.enum(PROPERTY_TYPES, { message: 'Choose a property type.' }),

  city: requiredText(MAX_PLACE_NAME, 'Add the city.'),
  state: optionalText(MAX_PLACE_NAME),
  country: requiredText(MAX_PLACE_NAME, 'Add the country.'),
  neighborhood: optionalText(MAX_PLACE_NAME),

  maxGuests: z
    .number({ message: 'How many guests can stay?' })
    .int('Use a whole number.')
    .min(1, 'At least one guest.')
    .max(MAX_GUESTS, `At most ${MAX_GUESTS} guests.`),
  bedrooms: z
    .number({ message: 'How many bedrooms?' })
    .int('Use a whole number.')
    .min(0, 'Cannot be negative.')
    .max(MAX_BEDROOMS, `At most ${MAX_BEDROOMS} bedrooms.`),
  beds: z
    .number({ message: 'How many beds?' })
    .int('Use a whole number.')
    .min(1, 'At least one bed.')
    .max(MAX_BEDS, `At most ${MAX_BEDS} beds.`),
  // numeric(3,1) in the DB, so halves are real and 1.25 is not storable.
  bathrooms: z
    .number({ message: 'How many bathrooms?' })
    .min(0, 'Cannot be negative.')
    .max(MAX_BATHROOMS, `At most ${MAX_BATHROOMS} bathrooms.`)
    .multipleOf(0.5, 'Use whole or half bathrooms.'),

  // Dollars. `price_per_night` is `check (price_per_night > 0)`, so 0 is not a
  // free listing — it is a rejected insert.
  pricePerNight: z
    .number({ message: 'Set a nightly price.' })
    .positive('Set a price above zero.')
    .max(MAX_PRICE_DOLLARS, 'That price is too high.'),
  cleaningFee: z
    .number({ message: 'Set a cleaning fee, or 0 for none.' })
    .nonnegative('Cannot be negative.')
    .max(MAX_PRICE_DOLLARS, 'That fee is too high.'),

  amenities: z.array(amenitySchema).max(AMENITIES.length),
  houseRules: optionalText(MAX_HOUSE_RULES),

  checkInTime: z.string().regex(TIME_PATTERN, 'Use a 24-hour time like 15:00.'),
  checkOutTime: z.string().regex(TIME_PATTERN, 'Use a 24-hour time like 11:00.'),
  minNights: z
    .number({ message: 'Set a minimum stay.' })
    .int('Use a whole number of nights.')
    .min(1, 'At least one night.')
    .max(MAX_MIN_NIGHTS, `At most ${MAX_MIN_NIGHTS} nights.`),
})

/**
 * What the **form** holds. Optional text fields are plain strings here, blank
 * when empty, because that is what an `<input>` produces.
 */
export type ListingFormValues = z.input<typeof createListingSchema>

/**
 * What the **action** receives once parsed: blanks normalised to `null`, ready
 * for the nullable columns. Distinct from `ListingFormValues` because the
 * optional-text fields transform.
 */
export type CreateListingInput = z.output<typeof createListingSchema>

/**
 * The Cloudinary folder a listing's photos live in.
 *
 * Defined once because three places must agree on it exactly: the upload
 * widget's `options.folder`, the ownership regex in `/api/sign-cloudinary`, and
 * the `publicId` check below. If they drift, uploads fail signature validation
 * with nothing useful in the message.
 */
export function listingPhotoFolder(listingId: string): string {
  return `nextbnb/listings/${listingId}`
}

/** Cloudinary's delivery host — the only one `next.config.ts` whitelists. */
const CLOUDINARY_URL_PREFIX = 'https://res.cloudinary.com/'

/**
 * A photo the client claims Cloudinary just returned.
 *
 * **Both fields are attacker-controlled** — this is a server action, and nothing
 * stops a caller posting whatever they like instead of the widget's response.
 * The `publicId` check is the security-critical one: `deleteListingPhoto` passes
 * it straight to `cloudinary.uploader.destroy()`, so an unconstrained value
 * would let someone record a row pointing at **another host's asset** and then
 * destroy it by deleting their own photo. Pinning it under this listing's own
 * folder is what makes that impossible.
 *
 * The URL is checked by prefix rather than with `z.url()`, which in Zod 4
 * validates URL *syntax* only — it accepts `javascript:alert(1)` quite happily.
 */
export const addListingPhotoSchema = z
  .object({
    listingId: z.uuid(),
    url: z
      .string()
      .trim()
      .startsWith(CLOUDINARY_URL_PREFIX, 'That is not a Cloudinary URL.')
      .max(2_000),
    publicId: z.string().trim().min(1).max(500),
  })
  .refine(
    (photo) => photo.publicId.startsWith(`${listingPhotoFolder(photo.listingId)}/`),
    { message: 'That photo does not belong to this listing.', path: ['publicId'] },
  )

/** Identifies one photo of one listing — used by delete and set-cover. */
export const photoActionSchema = z.object({
  listingId: z.uuid(),
  photoId: z.uuid(),
})

/** Reorder is relative, never an absolute index: two clicks in flight then
 *  compose instead of both writing the same stale position. */
export const movePhotoSchema = photoActionSchema.extend({
  direction: z.enum(['earlier', 'later']),
})

// -----------------------------------------------------------------------------
// Feature 10 — managing an existing listing
// -----------------------------------------------------------------------------

/** Names one listing. Publish/unpublish and delete both start here. */
export const listingActionSchema = z.object({
  listingId: z.uuid(),
})

/**
 * Publish state as a value, not an instruction to flip — the shape F08 settled
 * on for `setFavorite`, and for the same reason: a toggle has to read the
 * current row and invert it, so two clicks in flight both resolve against the
 * same "before" and can land opposite to what the button showed. Sending the
 * state you want makes the write idempotent and converge.
 */
export const setPublishedSchema = listingActionSchema.extend({
  published: z.boolean(),
})

export const deleteListingSchema = listingActionSchema

/**
 * An edit: every field the create form collects, plus which listing.
 *
 * Extending `createListingSchema` rather than restating it is what keeps the
 * two forms honest — a rule added to creation cannot be forgotten on edit. It
 * also inherits `optionalText`'s `.nullish()`, which matters here for the same
 * reason it mattered in F09: this schema validates on the client, and the
 * client posts its *result* to an action that validates again with it. It has
 * to accept its own output.
 */
export const updateListingSchema = createListingSchema.extend({
  listingId: z.uuid(),
})

export type UpdateListingInput = z.output<typeof updateListingSchema>

/** The listing columns the edit form reads back. */
type ListingFormSource = Pick<
  Database['public']['Tables']['listings']['Row'],
  | 'title'
  | 'description'
  | 'property_type'
  | 'city'
  | 'state'
  | 'country'
  | 'neighborhood'
  | 'max_guests'
  | 'bedrooms'
  | 'beds'
  | 'bathrooms'
  | 'price_per_night'
  | 'cleaning_fee'
  | 'amenities'
  | 'house_rules'
  | 'check_in_time'
  | 'check_out_time'
  | 'min_nights'
>

/**
 * A stored listing → the values the edit form starts from.
 *
 * **Mapping null to `''` is load-bearing, and TypeScript will not ask for it.**
 * `ListingFormValues` is `z.input<typeof createListingSchema>` and
 * `optionalText` is `.nullish()`, so a `null` description type-checks perfectly
 * well as a default value — and then React sees `value={null}`, warns, and
 * silently hands the field back to the DOM as uncontrolled. The column is
 * nullable, the input is not; this is the seam between them.
 *
 * The two time columns are nullable too, and the form requires them, so a
 * listing stored without one opens on the house default rather than on a value
 * its own schema would reject. Anything not matching `TIME_PATTERN` gets the
 * same treatment — `check_in_time` is plain `text`, so nothing at the database
 * level guarantees its shape.
 */
export function toListingFormValues(
  listing: ListingFormSource,
): ListingFormValues {
  return {
    title: listing.title,
    description: listing.description ?? '',
    propertyType: listing.property_type,
    city: listing.city,
    state: listing.state ?? '',
    country: listing.country,
    neighborhood: listing.neighborhood ?? '',
    maxGuests: listing.max_guests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    pricePerNight: centsToDollars(listing.price_per_night),
    cleaningFee: centsToDollars(listing.cleaning_fee),
    // The column is `text[]`; the form's checkboxes are keyed on AMENITIES. A
    // retired amenity is dropped rather than rendered as a checkbox nothing
    // matches — the same leniency `parseAmenities` applies to a stale URL.
    amenities: listing.amenities.filter(isKnownAmenity),
    houseRules: listing.house_rules ?? '',
    checkInTime: timeOrDefault(listing.check_in_time, DEFAULT_CHECK_IN_TIME),
    checkOutTime: timeOrDefault(listing.check_out_time, DEFAULT_CHECK_OUT_TIME),
    minNights: listing.min_nights,
  }
}

function isKnownAmenity(value: string): value is Amenity {
  return amenitySchema.safeParse(value).success
}

function timeOrDefault(value: string | null, fallback: string): string {
  return value && TIME_PATTERN.test(value) ? value : fallback
}
