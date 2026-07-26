'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { bookedNightsRange, findBlockConflict, todayISO } from '@/lib/utils'
import { addBlockSchema, removeBlockSchema } from '@/lib/validations/blockedDates'
import type { ActionResult, InclusiveRange } from '@/lib/utils'

/**
 * Block a range of dates on a listing the caller hosts.
 *
 * Blocks are **inclusive** `[start_date, end_date]` — both ends unavailable —
 * while bookings are half-open, so the two are compared through
 * `bookedNightsRange`/`findBlockConflict` rather than by hand. The same pair
 * greys out days in the calendar, so the control the host sees and the rule
 * enforced here cannot drift apart.
 *
 * **The overlap check is a UX guard, not an authorization one.**
 * `blocked_dates_insert_own_listing` happily accepts a block over a confirmed
 * booking; no database constraint expresses a rule spanning two tables, and an
 * exclusion constraint cannot reach across one. So a guest reserving between
 * this read and this insert can still land a booking under a block. That race is
 * accepted and benign: `unavailable_listing_ids` unions both halves, so search
 * excludes the listing either way and the booking stands untouched — nobody's
 * stay is lost, which is the failure F10's delete guard exists to prevent.
 */
export async function addBlock(input: unknown): Promise<ActionResult> {
  const parsed = addBlockSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Please check those dates.' }
  }

  const { listingId, startDate, endDate } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to manage availability.' }

  // The past-date floor lives here rather than in the schema, and it tests the
  // *end* deliberately — see the note on `addBlockSchema`. A block that has
  // wholly passed does nothing; one that merely started yesterday is still doing
  // useful work, and refusing it would depend on which side of midnight the
  // browser and the server each happened to be on.
  if (endDate < todayISO()) {
    return { ok: false, error: 'Those dates have already passed.' }
  }

  const occupied = await ownOccupancy(supabase, listingId, user.id)
  if (occupied === null) return { ok: false, error: 'That listing could not be found.' }

  const conflict = findBlockConflict({ start: startDate, end: endDate }, occupied)
  if (conflict === 'booking') {
    return {
      ok: false,
      error: 'Those dates include a confirmed reservation and cannot be blocked.',
    }
  }
  if (conflict === 'block') {
    return { ok: false, error: 'Those dates overlap a block you have already set.' }
  }

  const { error } = await supabase.from('blocked_dates').insert({
    listing_id: listingId,
    start_date: startDate,
    end_date: endDate,
  })

  if (error) {
    console.error('[actions/blockedDates] addBlock failed:', error.message)
    return { ok: false, error: 'Those dates could not be blocked. Please try again.' }
  }

  revalidatePath(`/host/listings/${listingId}/availability`)
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}

/**
 * Remove one block, freeing its dates.
 *
 * **No guard, and that was read rather than assumed.** F10's rule is to check
 * the FK actions on everything referencing a row before writing a delete —
 * there, `bookings.listing_id` cascaded and deleting a listing silently erased
 * guests' stays. Nothing references `blocked_dates` at all; `listing_id`
 * cascades *into* it from `listings`. So a block's blast radius is the block.
 *
 * RLS (`blocked_dates_delete_own_listing`) is the authorization; `listing_id` is
 * stated alongside the id for the same belt-and-braces reason `updateListing`
 * states `host_id`.
 */
export async function removeBlock(input: unknown): Promise<ActionResult> {
  const parsed = removeBlockSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That block could not be removed.' }
  }

  const { listingId, blockId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to manage availability.' }

  const { data, error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('id', blockId)
    .eq('listing_id', listingId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[actions/blockedDates] removeBlock failed:', error.message)
    return { ok: false, error: 'Those dates could not be unblocked. Please try again.' }
  }

  // A DELETE matching no row returns success with no data — the silent-success
  // failure mode `0006` exists to eliminate, and the one `updateListing` already
  // guards against. Here the block is simply not on a listing this user hosts.
  if (!data) return { ok: false, error: 'That block could not be found.' }

  revalidatePath(`/host/listings/${listingId}/availability`)
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}

/**
 * Everything already occupying a listing's calendar, but only if this user hosts
 * it — `null` otherwise, which the caller reports as "not found" rather than
 * "not yours" (a listing the caller does not host is not theirs to learn about).
 * The `ownPhotos` shape in `actions/listings.ts`, for the same reasons.
 */
async function ownOccupancy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  userId: string,
): Promise<{ booked: InclusiveRange[]; blocked: InclusiveRange[] } | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, blocked_dates(start_date, end_date), bookings(status, check_in, check_out)')
    .eq('id', listingId)
    .eq('host_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[actions/blockedDates] ownOccupancy failed:', error.message)
    return null
  }
  if (!data) return null

  return {
    // Cancelled stays free their dates, exactly as the partial exclusion
    // constraint does, so they never stand in the way of a block.
    booked: data.bookings
      .filter((booking) => booking.status === 'confirmed')
      .map(bookedNightsRange),
    blocked: data.blocked_dates.map((block) => ({
      start: block.start_date,
      end: block.end_date,
    })),
  }
}
