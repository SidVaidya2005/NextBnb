import { addDays, subDays } from 'date-fns'
import { describe, it, expect } from 'vitest'

import { toISODate } from '@/lib/utils'
import {
  hasActiveFilters,
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
