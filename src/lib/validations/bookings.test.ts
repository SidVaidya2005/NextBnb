import { addDays } from 'date-fns'
import { describe, it, expect } from 'vitest'

import { MAX_GUESTS } from '@/lib/constants'
import { toISODate } from '@/lib/utils'
import { createBookingSchema } from '@/lib/validations/bookings'

const LISTING_ID = '20000000-0000-4000-b000-000000000001'

const stay = (checkIn: string, checkOut: string, guests = 2) => ({
  listingId: LISTING_ID,
  checkIn,
  checkOut,
  guests,
})

describe('createBookingSchema', () => {
  it('accepts an ordinary stay', () => {
    expect(createBookingSchema.safeParse(stay('2026-08-12', '2026-08-17')).success).toBe(
      true,
    )
  })

  it('accepts a single night', () => {
    expect(createBookingSchema.safeParse(stay('2026-08-12', '2026-08-13')).success).toBe(
      true,
    )
  })

  it('rejects a same-day checkout — a stay is never zero nights', () => {
    // The half-open rule that separates this schema from addBlockSchema, where a
    // one-day inclusive range is the ordinary way to block a single night.
    const parsed = createBookingSchema.safeParse(stay('2026-08-12', '2026-08-12'))
    expect(parsed.success).toBe(false)
  })

  it('rejects a checkout before check-in', () => {
    expect(createBookingSchema.safeParse(stay('2026-08-17', '2026-08-12')).success).toBe(
      false,
    )
  })

  it('rejects a date that is well-formed but not a real day', () => {
    // z.iso.date() is a calendar check, not a regex — 2026 is not a leap year.
    expect(createBookingSchema.safeParse(stay('2026-02-29', '2026-03-02')).success).toBe(
      false,
    )
    expect(createBookingSchema.safeParse(stay('2026-02-31', '2026-03-02')).success).toBe(
      false,
    )
  })

  it('rejects a non-date string and a missing field', () => {
    expect(
      createBookingSchema.safeParse(stay('next tuesday', '2026-08-17')).success,
    ).toBe(false)
    expect(
      createBookingSchema.safeParse({
        listingId: LISTING_ID,
        checkIn: '2026-08-12',
        guests: 2,
      }).success,
    ).toBe(false)
  })

  it('rejects a listing id that is not a uuid', () => {
    expect(
      createBookingSchema.safeParse({
        listingId: 'not-a-uuid',
        checkIn: '2026-08-12',
        checkOut: '2026-08-17',
        guests: 2,
      }).success,
    ).toBe(false)
  })

  it('accepts the DB guest ceiling and rejects one past it', () => {
    // 16 is `guests_count between 1 and 16` in migration 0001. The narrower
    // per-listing cap is createBooking's — the schema cannot see the listing.
    expect(
      createBookingSchema.safeParse(stay('2026-08-12', '2026-08-17', MAX_GUESTS)).success,
    ).toBe(true)
    expect(
      createBookingSchema.safeParse(stay('2026-08-12', '2026-08-17', MAX_GUESTS + 1))
        .success,
    ).toBe(false)
  })

  it('rejects zero, negative and fractional guest counts', () => {
    expect(createBookingSchema.safeParse(stay('2026-08-12', '2026-08-17', 0)).success).toBe(
      false,
    )
    expect(
      createBookingSchema.safeParse(stay('2026-08-12', '2026-08-17', -1)).success,
    ).toBe(false)
    expect(
      createBookingSchema.safeParse(stay('2026-08-12', '2026-08-17', 2.5)).success,
    ).toBe(false)
  })

  it('accepts a stay exactly at the 365-night ceiling and rejects one past it', () => {
    const checkIn = '2026-08-12'
    // Half-open, so night 365 ends on checkIn + 365.
    expect(
      createBookingSchema.safeParse(
        stay(checkIn, toISODate(addDays(new Date(checkIn), 365))),
      ).success,
    ).toBe(true)
    expect(
      createBookingSchema.safeParse(
        stay(checkIn, toISODate(addDays(new Date(checkIn), 366))),
      ).success,
    ).toBe(false)
  })

  it('accepts a stay in the past — the floor is the action’s, not the schema’s', () => {
    // Deliberate: `todayISO()` is evaluated on the client and again on the
    // server, so a date floor here would refuse at 00:00:01 what it accepted at
    // 23:59:59. `createBooking` owns that rule, as `addBlock` does for blocks.
    expect(createBookingSchema.safeParse(stay('2020-01-01', '2020-01-05')).success).toBe(
      true,
    )
  })

  it('accepts its own output — the schema guards both the widget and the action', () => {
    // F09's finding: the client validates, posts the *result*, and the action
    // validates again with this same schema. parse(parse(x)) has to succeed.
    const once = createBookingSchema.parse(stay('2026-08-12', '2026-08-17'))
    expect(() => createBookingSchema.parse(once)).not.toThrow()
    expect(createBookingSchema.parse(once)).toEqual(once)
  })
})
