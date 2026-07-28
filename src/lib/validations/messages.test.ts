import { describe, it, expect } from 'vitest'

import {
  MAX_MESSAGE_BODY,
  markThreadReadSchema,
  sendMessageSchema,
  startThreadSchema,
  threadIdSchema,
} from '@/lib/validations/messages'

const THREAD_ID = '50000000-0000-4000-b000-000000000001'
const LISTING_ID = '10000000-0000-4000-a000-000000000001'

const message = (body: string) => ({ threadId: THREAD_ID, body })

describe('sendMessageSchema', () => {
  it('accepts an ordinary message', () => {
    const parsed = sendMessageSchema.safeParse(message('Is the wifi any good?'))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.body).toBe('Is the wifi any good?')
  })

  it('trims surrounding whitespace', () => {
    expect(sendMessageSchema.safeParse(message('  hello  ')).data?.body).toBe('hello')
  })

  it('rejects an empty or whitespace-only body', () => {
    // `messages.body` carries `check (length(trim(body)) > 0)`. Without the trim
    // here a spaces-only send would reach Postgres and come back as a 23514 —
    // a constraint violation standing in for "type something".
    expect(sendMessageSchema.safeParse(message('')).success).toBe(false)
    expect(sendMessageSchema.safeParse(message('   ')).success).toBe(false)
    expect(sendMessageSchema.safeParse(message('\n\t ')).success).toBe(false)
  })

  it('measures the cap AFTER trimming, not before', () => {
    // Verified against the installed Zod 4.4.3 rather than assumed: `.min()` and
    // `.max()` see the trimmed value. A body that only exceeds the cap because
    // of padding is legitimate input, and must not be refused.
    const padded = `  ${'x'.repeat(MAX_MESSAGE_BODY)}  `
    const parsed = sendMessageSchema.safeParse(message(padded))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.body).toHaveLength(MAX_MESSAGE_BODY)
  })

  it('accepts a body exactly at the cap and rejects one past it', () => {
    expect(sendMessageSchema.safeParse(message('x'.repeat(MAX_MESSAGE_BODY))).success).toBe(
      true,
    )
    expect(
      sendMessageSchema.safeParse(message('x'.repeat(MAX_MESSAGE_BODY + 1))).success,
    ).toBe(false)
  })

  it('accepts its own output — parse(parse(x)) succeeds', () => {
    // **F09's rule.** The composer posts the trimmed value and `sendMessage`
    // re-validates it with this same schema, so the output has to be inside the
    // accepted input set. Trimming an already-trimmed string is a no-op, which
    // is precisely why this holds — asserted rather than trusted.
    const once = sendMessageSchema.safeParse(message('  Checking in late.  '))
    expect(once.success).toBe(true)

    const twice = sendMessageSchema.safeParse(once.data)
    expect(twice.success).toBe(true)
    expect(twice.data).toEqual(once.data)
  })

  it('rejects a malformed thread id before it can reach Postgres', () => {
    expect(sendMessageSchema.safeParse({ threadId: 'nope', body: 'hi' }).success).toBe(false)
  })
})

describe('startThreadSchema', () => {
  it('accepts a listing id, and nothing else is required', () => {
    // Both participants are derived by the action — `guest_id` from the session,
    // `host_id` from the listing — because `message_threads_insert_participant`
    // is an OR and would accept a thread naming an arbitrary stranger as guest.
    const parsed = startThreadSchema.safeParse({ listingId: LISTING_ID })
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ listingId: LISTING_ID })
  })

  it('rejects a malformed listing id', () => {
    expect(startThreadSchema.safeParse({ listingId: 'not-a-uuid' }).success).toBe(false)
  })
})

describe('markThreadReadSchema', () => {
  it('accepts a thread id', () => {
    expect(markThreadReadSchema.safeParse({ threadId: THREAD_ID }).success).toBe(true)
  })

  it('rejects a malformed id', () => {
    expect(markThreadReadSchema.safeParse({ threadId: 'nope' }).success).toBe(false)
  })
})

describe('threadIdSchema', () => {
  it('gates the route segment so a bad link is a 404, not a logged 22P02', () => {
    expect(threadIdSchema.safeParse(THREAD_ID).success).toBe(true)
    expect(threadIdSchema.safeParse('../../etc').success).toBe(false)
  })
})
