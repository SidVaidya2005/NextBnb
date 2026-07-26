import { addDays } from 'date-fns'
import { describe, it, expect } from 'vitest'

import { toISODate } from '@/lib/utils'
import { addBlockSchema, removeBlockSchema } from '@/lib/validations/blockedDates'

const LISTING_ID = '20000000-0000-4000-a000-000000000001'
const BLOCK_ID = '30000000-0000-4000-a000-000000000009'

const block = (startDate: string, endDate: string) => ({
  listingId: LISTING_ID,
  startDate,
  endDate,
})

describe('addBlockSchema', () => {
  it('accepts a multi-day range', () => {
    const parsed = addBlockSchema.safeParse(block('2026-08-18', '2026-08-23'))
    expect(parsed.success).toBe(true)
  })

  it('accepts a one-day block — both ends are inclusive', () => {
    // The rule that separates this schema from a booking's: `end > start` would
    // make a single blocked night unexpressible, and the table's own constraint
    // is `end_date >= start_date`.
    const parsed = addBlockSchema.safeParse(block('2026-08-18', '2026-08-18'))
    expect(parsed.success).toBe(true)
  })

  it('rejects a range that ends before it starts', () => {
    const parsed = addBlockSchema.safeParse(block('2026-08-23', '2026-08-18'))
    expect(parsed.success).toBe(false)
  })

  it('rejects a date that is well-formed but not a real day', () => {
    // z.iso.date() is a calendar check, not a regex — 2026 is not a leap year.
    expect(addBlockSchema.safeParse(block('2026-02-29', '2026-03-01')).success).toBe(
      false,
    )
    expect(addBlockSchema.safeParse(block('2026-02-31', '2026-03-01')).success).toBe(
      false,
    )
  })

  it('rejects a non-date string and a missing field', () => {
    expect(addBlockSchema.safeParse(block('next tuesday', '2026-08-23')).success).toBe(
      false,
    )
    expect(
      addBlockSchema.safeParse({ listingId: LISTING_ID, startDate: '2026-08-18' })
        .success,
    ).toBe(false)
  })

  it('rejects a listing id that is not a uuid', () => {
    const parsed = addBlockSchema.safeParse({
      listingId: 'not-a-uuid',
      startDate: '2026-08-18',
      endDate: '2026-08-23',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts a range exactly at the 365-day ceiling and rejects one past it', () => {
    const start = '2026-08-18'
    // Inclusive, so day 365 is start + 364.
    expect(
      addBlockSchema.safeParse(block(start, toISODate(addDays(new Date(start), 364))))
        .success,
    ).toBe(true)
    expect(
      addBlockSchema.safeParse(block(start, toISODate(addDays(new Date(start), 365))))
        .success,
    ).toBe(false)
  })

  it('accepts a range in the past — the floor is the action’s, not the schema’s', () => {
    // Decision 6: `todayISO()` is evaluated separately on the client and the
    // server, so a date floor here would refuse at 00:00:01 what it accepted at
    // 23:59:59. `addBlock` owns that rule.
    const parsed = addBlockSchema.safeParse(block('2020-01-01', '2020-01-05'))
    expect(parsed.success).toBe(true)
  })

  it('accepts its own output — the schema guards both the form and the action', () => {
    // F09's finding: the client validates, posts the *result*, and the server
    // validates again with this same schema. parse(parse(x)) has to succeed.
    const once = addBlockSchema.parse(block('2026-08-18', '2026-08-23'))
    expect(() => addBlockSchema.parse(once)).not.toThrow()
    expect(addBlockSchema.parse(once)).toEqual(once)
  })
})

describe('removeBlockSchema', () => {
  it('accepts a listing and block id', () => {
    const parsed = removeBlockSchema.safeParse({
      listingId: LISTING_ID,
      blockId: BLOCK_ID,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a missing or malformed block id', () => {
    expect(removeBlockSchema.safeParse({ listingId: LISTING_ID }).success).toBe(false)
    expect(
      removeBlockSchema.safeParse({ listingId: LISTING_ID, blockId: '7' }).success,
    ).toBe(false)
  })

  it('accepts its own output', () => {
    const once = removeBlockSchema.parse({ listingId: LISTING_ID, blockId: BLOCK_ID })
    expect(removeBlockSchema.parse(once)).toEqual(once)
  })
})
