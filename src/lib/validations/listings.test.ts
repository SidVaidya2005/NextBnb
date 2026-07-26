import { addDays, subDays } from 'date-fns'
import { describe, it, expect } from 'vitest'

import { toISODate } from '@/lib/utils'
import {
  addListingPhotoSchema,
  createListingSchema,
  hasActiveFilters,
  listingPhotoFolder,
  movePhotoSchema,
  parseListingFilters,
  type RawSearchParams,
} from '@/lib/validations/listings'

// Dates are relative to the real clock, exactly like the seed — a hard-coded
// date would quietly turn "upcoming" into "past" and rot the suite.
const future = (days: number) => toISODate(addDays(new Date(), days))
const past = (days: number) => toISODate(subDays(new Date(), days))

const parse = (params: RawSearchParams) => parseListingFilters(params)

describe('parseListingFilters — degradation', () => {
  it('returns no filters for an empty URL', () => {
    const filters = parse({})

    expect(filters.amenities).toEqual([])
    expect(filters.city).toBeUndefined()
    expect(filters.stay).toBeUndefined()
    expect(hasActiveFilters(filters)).toBe(false)
  })

  it('drops one invalid field without losing the valid ones', () => {
    const filters = parse({ city: 'Kyoto', guests: 'abc', minPrice: '-5' })

    expect(filters.city).toBe('Kyoto')
    expect(filters.guests).toBeUndefined()
    expect(filters.minPriceCents).toBeUndefined()
  })

  it('treats an empty value as absent rather than as zero', () => {
    // Number('') is 0, so an unguarded coerce would turn "?minPrice=" into a
    // real $0 filter and make the URL look filtered when it is not.
    const filters = parse({ city: '', minPrice: '', guests: '' })

    expect(filters.city).toBeUndefined()
    expect(filters.minPriceCents).toBeUndefined()
    expect(hasActiveFilters(filters)).toBe(false)
  })

  it('takes the first value when a param is repeated', () => {
    expect(parse({ city: ['Kyoto', 'Lisbon'] }).city).toBe('Kyoto')
  })
})

describe('parseListingFilters — price', () => {
  it('converts whole dollars in the URL to integer cents', () => {
    const filters = parse({ minPrice: '50', maxPrice: '300' })

    expect(filters.minPriceCents).toBe(5000)
    expect(filters.maxPriceCents).toBe(30000)
  })

  it('rounds fractional dollars to whole cents', () => {
    expect(parse({ minPrice: '49.995' }).minPriceCents).toBe(5000)
  })

  it('swaps an inverted range instead of dropping it', () => {
    const filters = parse({ minPrice: '300', maxPrice: '50' })

    expect(filters.minPriceCents).toBe(5000)
    expect(filters.maxPriceCents).toBe(30000)
  })

  it('rejects an absurd bound', () => {
    expect(parse({ maxPrice: '99999999' }).maxPriceCents).toBeUndefined()
  })
})

describe('parseListingFilters — guests and property type', () => {
  it('accepts a guest count inside the supported range', () => {
    expect(parse({ guests: '4' }).guests).toBe(4)
  })

  it('rejects a guest count outside it', () => {
    expect(parse({ guests: '0' }).guests).toBeUndefined()
    expect(parse({ guests: '17' }).guests).toBeUndefined()
    expect(parse({ guests: '2.5' }).guests).toBeUndefined()
  })

  it('accepts a known property type and drops an unknown one', () => {
    expect(parse({ type: 'treehouse' }).propertyType).toBe('treehouse')
    expect(parse({ type: 'castle' }).propertyType).toBeUndefined()
  })
})

describe('parseListingFilters — amenities', () => {
  it('reads a comma-separated list', () => {
    expect(parse({ amenities: 'wifi,kitchen' }).amenities).toEqual([
      'wifi',
      'kitchen',
    ])
  })

  it('reads repeated params, which is what a plain checkbox group posts', () => {
    expect(parse({ amenities: ['wifi', 'kitchen'] }).amenities).toEqual([
      'wifi',
      'kitchen',
    ])
  })

  it('drops unknown amenities but keeps the valid ones', () => {
    expect(parse({ amenities: 'wifi,helipad,pool' }).amenities).toEqual([
      'wifi',
      'pool',
    ])
  })

  it('de-duplicates', () => {
    expect(parse({ amenities: 'wifi,wifi' }).amenities).toEqual(['wifi'])
  })
})

describe('parseListingFilters — dates', () => {
  it('builds a stay when both dates are valid and ordered', () => {
    const filters = parse({ checkIn: future(10), checkOut: future(14) })

    expect(filters.stay).toEqual({
      checkIn: future(10),
      checkOut: future(14),
      nights: 4,
    })
  })

  it('keeps a lone check-in for the form but builds no stay', () => {
    const filters = parse({ checkIn: future(10) })

    expect(filters.checkIn).toBe(future(10))
    expect(filters.checkOut).toBeUndefined()
    // The availability filter must not run on a range that does not exist.
    expect(filters.stay).toBeUndefined()
  })

  it('drops a past check-in, and the check-out with it', () => {
    const filters = parse({ checkIn: past(3), checkOut: future(3) })

    expect(filters.checkIn).toBeUndefined()
    expect(filters.checkOut).toBeUndefined()
    expect(filters.stay).toBeUndefined()
  })

  it('drops a check-out that does not postdate the check-in', () => {
    const sameDay = parse({ checkIn: future(5), checkOut: future(5) })
    expect(sameDay.stay).toBeUndefined()

    const inverted = parse({ checkIn: future(5), checkOut: future(2) })
    expect(inverted.stay).toBeUndefined()
  })

  it('rejects malformed and impossible dates', () => {
    expect(parse({ checkIn: '2026-8-5' }).checkIn).toBeUndefined()
    expect(parse({ checkIn: '2026-02-31' }).checkIn).toBeUndefined()
    expect(parse({ checkIn: 'tomorrow' }).checkIn).toBeUndefined()
  })

  it('drops a lone check-out', () => {
    expect(parse({ checkOut: future(5) }).checkOut).toBeUndefined()
  })
})

describe('hasActiveFilters', () => {
  it('is true for any single narrowed dimension', () => {
    expect(hasActiveFilters(parse({ city: 'Kyoto' }))).toBe(true)
    expect(hasActiveFilters(parse({ guests: '2' }))).toBe(true)
    expect(hasActiveFilters(parse({ minPrice: '50' }))).toBe(true)
    expect(hasActiveFilters(parse({ type: 'cabin' }))).toBe(true)
    expect(hasActiveFilters(parse({ amenities: 'pool' }))).toBe(true)
    expect(
      hasActiveFilters(parse({ checkIn: future(3), checkOut: future(6) })),
    ).toBe(true)
  })

  it('stays false when every value was rejected', () => {
    expect(hasActiveFilters(parse({ guests: 'abc', type: 'castle' }))).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Feature 09 — createListingSchema
// -----------------------------------------------------------------------------

const VALID_LISTING = {
  title: '  Cliffside Cabin  ',
  description: '',
  propertyType: 'cabin',
  city: 'Reykjavík',
  state: '',
  country: 'Iceland',
  neighborhood: '',
  maxGuests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 1.5,
  pricePerNight: 145,
  cleaningFee: 35,
  amenities: ['wifi', 'kitchen'],
  houseRules: '',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  minNights: 2,
}

const listing = (overrides: Record<string, unknown> = {}) =>
  createListingSchema.safeParse({ ...VALID_LISTING, ...overrides })

describe('createListingSchema', () => {
  it('accepts a complete listing and trims the text', () => {
    const result = listing()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Cliffside Cabin')
      expect(result.data.pricePerNight).toBe(145)
    }
  })

  it('turns a blank optional field into null, not an empty string', () => {
    // The columns are nullable; '' would render as an empty paragraph on the
    // detail page instead of the row being omitted.
    const result = listing()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeNull()
      expect(result.data.state).toBeNull()
      expect(result.data.neighborhood).toBeNull()
      expect(result.data.houseRules).toBeNull()
    }
  })

  it('keeps an optional field that was actually filled in', () => {
    const result = listing({ state: ' Suðurland ' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.state).toBe('Suðurland')
  })

  it.each([
    ['a blank title', { title: '   ' }],
    ['a missing city', { city: '' }],
    ['a missing country', { country: '' }],
    ['an unknown property type', { propertyType: 'castle' }],
    ['a free listing', { pricePerNight: 0 }],
    ['a negative price', { pricePerNight: -10 }],
    ['a negative cleaning fee', { cleaningFee: -1 }],
    ['more guests than the DB allows', { maxGuests: 17 }],
    ['no guests', { maxGuests: 0 }],
    ['a fractional guest count', { maxGuests: 2.5 }],
    ['zero beds', { beds: 0 }],
    ['negative bedrooms', { bedrooms: -1 }],
    ['a quarter bathroom', { bathrooms: 1.25 }],
    ['an unknown amenity', { amenities: ['helipad'] }],
    ['a 12-hour check-in time', { checkInTime: '3:00 PM' }],
    ['an impossible hour', { checkInTime: '24:00' }],
    ['an impossible minute', { checkOutTime: '11:60' }],
    ['a zero-night minimum', { minNights: 0 }],
  ])('rejects %s', (_label, override) => {
    expect(listing(override).success).toBe(false)
  })

  it('rejects a missing numeric field rather than coercing it to zero', () => {
    // react-hook-form hands back NaN for an emptied number input; Zod 4 rejects
    // NaN, which is what surfaces "Set a nightly price" instead of a free stay.
    expect(listing({ pricePerNight: Number.NaN }).success).toBe(false)
  })

  it('allows a studio and a no-fee listing', () => {
    expect(listing({ bedrooms: 0, cleaningFee: 0 }).success).toBe(true)
  })

  it('allows an empty amenity list', () => {
    expect(listing({ amenities: [] }).success).toBe(true)
  })

  it('accepts its own output — the schema must be idempotent', () => {
    // The client validates, then posts the RESULT to the server action, which
    // validates again with this same schema. So parse(parse(x)) has to work.
    // It did not: the optional-text fields emit `null` but only accepted
    // `string | undefined`, so every listing with a blank description passed on
    // the client and was refused by the action with a message naming no field.
    const first = listing()
    expect(first.success).toBe(true)
    if (!first.success) return

    const second = createListingSchema.safeParse(first.data)
    expect(second.success).toBe(true)
    if (second.success) expect(second.data).toEqual(first.data)
  })

  it('round-trips a filled optional field unchanged', () => {
    const first = listing({ description: 'A quiet place.' })
    if (!first.success) throw new Error('first parse failed')

    const second = createListingSchema.safeParse(first.data)
    expect(second.success).toBe(true)
    if (second.success) expect(second.data.description).toBe('A quiet place.')
  })
})

// -----------------------------------------------------------------------------
// Feature 09 — addListingPhotoSchema
//
// Both fields are attacker-controlled: this is a server action, and nothing
// makes the caller send Cloudinary's actual response.
// -----------------------------------------------------------------------------

const LISTING_ID = '20000000-0000-4000-a000-000000000001'
const OTHER_LISTING_ID = '20000000-0000-4000-a000-000000000002'

const photo = (overrides: Record<string, unknown> = {}) =>
  addListingPhotoSchema.safeParse({
    listingId: LISTING_ID,
    url: `https://res.cloudinary.com/demo/image/upload/v1/${listingPhotoFolder(LISTING_ID)}/abc.jpg`,
    publicId: `${listingPhotoFolder(LISTING_ID)}/abc`,
    ...overrides,
  })

describe('addListingPhotoSchema', () => {
  it('accepts a photo in this listing folder', () => {
    expect(photo().success).toBe(true)
  })

  it("refuses a public_id in ANOTHER listing's folder", () => {
    // The one that matters: deleteListingPhoto passes public_id straight to
    // cloudinary.uploader.destroy(), so without this a host could record a row
    // pointing at someone else's asset and then destroy it.
    expect(
      photo({ publicId: `${listingPhotoFolder(OTHER_LISTING_ID)}/victim` })
        .success,
    ).toBe(false)
  })

  it('refuses a public_id outside the nextbnb namespace entirely', () => {
    expect(photo({ publicId: 'someone-elses-brand/logo' }).success).toBe(false)
  })

  it('refuses a folder-prefix near-miss', () => {
    // `nextbnb/listings/<id>` with no trailing slash is a sibling folder whose
    // name merely starts the same way.
    expect(photo({ publicId: `${listingPhotoFolder(LISTING_ID)}-evil/x` }).success).toBe(
      false,
    )
  })

  it('refuses a URL that is not Cloudinary delivery', () => {
    expect(photo({ url: 'https://evil.example.com/tracker.gif' }).success).toBe(false)
  })

  it('refuses a javascript: URL', () => {
    // z.url() would ACCEPT this — it validates URL syntax, not scheme, which is
    // why the check is a host prefix rather than z.url().
    expect(photo({ url: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('refuses a malformed listing id', () => {
    expect(photo({ listingId: 'not-a-uuid' }).success).toBe(false)
  })
})

describe('movePhotoSchema', () => {
  it('accepts the two relative directions', () => {
    for (const direction of ['earlier', 'later']) {
      expect(
        movePhotoSchema.safeParse({
          listingId: LISTING_ID,
          photoId: OTHER_LISTING_ID,
          direction,
        }).success,
      ).toBe(true)
    }
  })

  it('refuses an absolute position', () => {
    expect(
      movePhotoSchema.safeParse({
        listingId: LISTING_ID,
        photoId: OTHER_LISTING_ID,
        direction: 3,
      }).success,
    ).toBe(false)
  })
})
