'use server'

import { revalidatePath } from 'next/cache'

import { cancelBooking } from '@/lib/actions/bookings'
import { destroyAsset } from '@/lib/cloudinary'
import { getCurrentProfile } from '@/lib/queries/profiles'
import { createClient } from '@/lib/supabase/server'
import { cancelBookingSchema } from '@/lib/validations/bookings'
import { deleteListingSchema, listingActionSchema } from '@/lib/validations/listings'
import type { ActionResult } from '@/lib/utils'

/**
 * Moderation actions for `/admin`. Every one of them re-checks `is_admin` here,
 * and that check is **load-bearing rather than defence in depth** — see
 * `adminDeleteListing` for the case where RLS alone would let the wrong person
 * through.
 *
 * Each mutation writes one `[admin]` audit line naming the actor, the verb, the
 * target and the outcome. **Refusals are logged too**: a refused moderation is
 * the more interesting event, and a log that records only successes cannot
 * distinguish "nobody tried" from "somebody tried and was stopped". A dedicated
 * audit table is out of scope for this build (`build-plan.md` → F17).
 */

/** The admin's own id, or null when the caller is not an admin. */
async function requireAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile()
  return profile?.is_admin ? profile.id : null
}

function audit(
  actorId: string,
  verb: string,
  targetId: string,
  outcome: 'ok' | 'refused' | 'failed',
): void {
  console.log(`[admin] actor=${actorId} action=${verb} target=${targetId} outcome=${outcome}`)
}

/**
 * Unpublish someone else's listing — the soft, reversible moderation verb.
 *
 * **This goes through `admin_unpublish_listing()` because an ordinary UPDATE
 * silently does nothing.** `listings_update_own` is `host_id = auth.uid()` with
 * no admin branch, so `.from('listings').update({ is_published: false })` as an
 * admin matches zero rows and returns `{ error: null }` — F13's finding, in the
 * one verb this dashboard is supposed to prefer. Migration `0009` adds the
 * definer function; it writes that column and no other, so nothing here can
 * touch a price, a title, or `host_id`.
 *
 * **There is no admin republish**, deliberately: publishing carries a >= 1 photo
 * requirement that lives in `setListingPublished`, and a second entry point would
 * either duplicate that guard or skip it. The host republishes their own listing.
 */
export async function adminUnpublishListing(input: unknown): Promise<ActionResult> {
  const parsed = listingActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'That listing could not be updated.' }

  const { listingId } = parsed.data

  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: 'Unauthorized.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_unpublish_listing', {
    p_listing_id: listingId,
  })

  if (error) {
    audit(actorId, 'unpublish_listing', listingId, 'failed')
    console.error('[actions/admin] adminUnpublishListing failed:', error.message)
    return { ok: false, error: 'That listing could not be unpublished. Please try again.' }
  }

  // The function returns the listing id, or null when no such listing exists —
  // and null can mean nothing else here, because a non-admin caller raises 42501
  // above rather than arriving with an empty result. The generated type says
  // `string` (postgrest does not model a nullable scalar return), so TypeScript
  // will not ask for this branch: F08's trap, in an RPC rather than an embed.
  if (data === null) {
    audit(actorId, 'unpublish_listing', listingId, 'refused')
    return { ok: false, error: 'That listing could not be found.' }
  }

  audit(actorId, 'unpublish_listing', listingId, 'ok')

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/host/listings')
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}

/**
 * Hard-delete any listing, cascading its photos, bookings and reviews.
 *
 * **The `is_admin` check above is what makes this safe, and RLS is not a
 * substitute for it.** `listings_delete_own_or_admin` admits
 * `host_id = auth.uid() OR is_admin()`, so without that check an ordinary host
 * could call this action on their **own** listing and delete it while a confirmed
 * stay was still upcoming — walking straight past the guard that is the entire
 * point of `deleteListing`. The database would permit it and nothing would error.
 * This is the inverse of the project's usual arrangement, where RLS is the
 * backstop: here the action is the only thing narrowing a policy that is
 * deliberately wider than either caller.
 *
 * **It is not a widened `deleteListing`, because the two differ in their central
 * rule rather than their filter.** That action refuses while an upcoming stay
 * exists; this one must not — F10 left the policy open precisely so moderation
 * keeps a hard-delete escape hatch for spam and abuse. Merging them means a
 * boolean that inverts the guard the function exists for (F15: ask which verb a
 * write pattern was learned from before reusing it).
 *
 * **What the admin gets instead of a refusal is the count.** `deletionImpact`
 * feeds the confirm step, so the operator reads "also erases 3 upcoming
 * reservations and 7 reviews" *before* the click. `bookings.listing_id` is
 * `on delete cascade`, so those stays are not cancelled — they are erased, with
 * no `cancelled_at` and nothing left in the guest's Trips. That is F10's Key
 * Decision, and stating it is the most this surface can do about it.
 *
 * Rows go before assets, F10's ordering: destroying images first risks losing
 * them and then failing to remove the rows, which leaves a listing rendering
 * broken photos. An orphaned Cloudinary asset is the cheaper failure, and it is
 * logged.
 */
export async function adminDeleteListing(input: unknown): Promise<ActionResult> {
  const parsed = deleteListingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'That listing could not be deleted.' }

  const { listingId } = parsed.data

  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: 'Unauthorized.' }

  const supabase = await createClient()

  // No `host_id` filter — that is the difference from `deleteListing`, and the
  // admin gate above is what earns it. The `listings` SELECT policy already
  // returns every row to an admin, including drafts.
  const { data: listing, error: readError } = await supabase
    .from('listings')
    .select('id, listing_photos(public_id)')
    .eq('id', listingId)
    .maybeSingle()

  if (readError) {
    audit(actorId, 'delete_listing', listingId, 'failed')
    console.error('[actions/admin] adminDeleteListing read failed:', readError.message)
    return { ok: false, error: 'That listing could not be deleted. Please try again.' }
  }
  if (!listing) {
    audit(actorId, 'delete_listing', listingId, 'refused')
    return { ok: false, error: 'That listing could not be found.' }
  }

  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .select('id')
    .maybeSingle()

  if (error) {
    audit(actorId, 'delete_listing', listingId, 'failed')
    console.error('[actions/admin] adminDeleteListing failed:', error.message)
    return { ok: false, error: 'That listing could not be deleted. Please try again.' }
  }

  // F13's rule: a DELETE that RLS refuses returns `{ error: null }` and zero
  // rows. It should be unreachable — `is_admin()` satisfies the policy and the
  // read above proved the row exists — but if it ever fires, the gate and the
  // policy have stopped agreeing, and reporting success would be a lie.
  if (!deleted) {
    audit(actorId, 'delete_listing', listingId, 'refused')
    return { ok: false, error: 'That listing could not be deleted.' }
  }

  // Seed photos carry no public_id and were never uploaded, so they are skipped.
  await Promise.all(
    listing.listing_photos
      .map((photo) => photo.public_id)
      .filter((publicId): publicId is string => publicId !== null)
      .map(destroyAsset),
  )

  audit(actorId, 'delete_listing', listingId, 'ok')

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/host/listings')
  // The route is gone; revalidating drops any cached render so it 404s.
  revalidatePath(`/listings/${listingId}`)
  // Guests whose stays just vanished — /trips and the host's board both change.
  revalidatePath('/trips')
  revalidatePath('/host/reservations')
  return { ok: true, data: undefined }
}

/**
 * Cancel any booking as an admin.
 *
 * **This delegates rather than reimplementing, and that is the one verb of the
 * three where the build plan's "reuse the existing action" line was right.**
 * `cancelBooking` carries no `guest_id` filter — it leans entirely on
 * `bookings_update_cancel_own_or_admin`, whose USING clause names `is_admin()`
 * with **no** `status`/`check_in` conditions on that branch. So an admin can
 * already cancel a stay in progress that its own guest could not, and one
 * implementation owns the status transition, its zero-row check and its five
 * `revalidatePath` calls.
 *
 * The admin check here is therefore not what authorises the write — RLS is. It
 * is what makes the audit line meaningful, and what stops an ordinary guest
 * routing their own cancellation through the admin log.
 */
export async function adminCancelBooking(input: unknown): Promise<ActionResult> {
  const parsed = cancelBookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'That reservation could not be found.' }

  const { bookingId } = parsed.data

  const actorId = await requireAdmin()
  if (!actorId) return { ok: false, error: 'Unauthorized.' }

  const result = await cancelBooking(parsed.data)

  audit(actorId, 'cancel_booking', bookingId, result.ok ? 'ok' : 'refused')

  return result
}
