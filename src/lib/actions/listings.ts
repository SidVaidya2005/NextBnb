'use server'

import { revalidatePath } from 'next/cache'

import { cloudinary } from '@/lib/cloudinary'
import { MAX_PHOTOS_PER_LISTING } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { nextPhotoPosition, reorderedPositions } from '@/lib/utils'
import {
  addListingPhotoSchema,
  createListingSchema,
  dollarsToCents,
  movePhotoSchema,
  photoActionSchema,
  publishListingSchema,
} from '@/lib/validations/listings'
import type { ActionResult } from '@/lib/utils'

/**
 * Create a listing as a draft.
 *
 * `is_published` is deliberately not set — the column defaults to false and
 * publishing is a separate action that first checks the listing has a photo.
 * That ordering is not a preference: `/api/sign-cloudinary` only signs uploads
 * for a listing the caller **already owns**, so the row has to exist before any
 * photo can be attached, which means a listing is unavoidably photo-less for a
 * moment. Publishing is where that gets resolved.
 *
 * The `host_id = auth.uid()` INSERT policy is the real guard; `getUser()` here
 * is for the message the user sees.
 */
export async function createListing(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createListingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Please check the highlighted fields.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to create a listing.' }

  const values = parsed.data

  const { data, error } = await supabase
    .from('listings')
    .insert({
      host_id: user.id,
      title: values.title,
      description: values.description,
      property_type: values.propertyType,
      city: values.city,
      state: values.state,
      country: values.country,
      neighborhood: values.neighborhood,
      max_guests: values.maxGuests,
      bedrooms: values.bedrooms,
      beds: values.beds,
      bathrooms: values.bathrooms,
      // The form collects dollars; every stored money value is integer cents.
      price_per_night: dollarsToCents(values.pricePerNight),
      cleaning_fee: dollarsToCents(values.cleaningFee),
      amenities: values.amenities,
      house_rules: values.houseRules,
      check_in_time: values.checkInTime,
      check_out_time: values.checkOutTime,
      min_nights: values.minNights,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[actions/listings] createListing failed:', error.message)
    return { ok: false, error: 'That listing could not be created. Please try again.' }
  }

  revalidatePath('/host/listings')
  return { ok: true, data: { id: data.id } }
}

/**
 * Record a photo Cloudinary has just accepted.
 *
 * **`is_cover` is never set here, and that is deliberate.** The widget uploads
 * several files concurrently and fires this once per file, so "is this the first
 * photo?" is read by every one of them before any has inserted — they would all
 * claim the cover and collide on the `listing_photos_one_cover_idx` partial
 * unique index. Leaving the flag unset is race-free and costs nothing:
 * `coverPhotoOf` already falls back to the lowest `position`, so the gallery
 * renders correctly, and `publishListing` promotes an explicit cover before the
 * listing is ever public.
 */
export async function addListingPhoto(input: unknown): Promise<ActionResult> {
  const parsed = addListingPhotoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That photo could not be added.' }
  }

  const { listingId, url, publicId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to add photos.' }

  const existing = await ownPhotos(supabase, listingId, user.id)
  if (existing === null) return { ok: false, error: 'That listing could not be found.' }

  if (existing.length >= MAX_PHOTOS_PER_LISTING) {
    return {
      ok: false,
      error: `A listing can have at most ${MAX_PHOTOS_PER_LISTING} photos.`,
    }
  }

  const { error } = await supabase.from('listing_photos').insert({
    listing_id: listingId,
    url,
    public_id: publicId,
    position: nextPhotoPosition(existing),
  })

  if (error) {
    console.error('[actions/listings] addListingPhoto failed:', error.message)
    return { ok: false, error: 'That photo could not be added. Please try again.' }
  }

  revalidatePath(`/host/listings/${listingId}/photos`)
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}

/**
 * Remove a photo, and its Cloudinary asset when it has one.
 *
 * The row goes first and the asset second. The other order risks destroying the
 * image and then failing to delete the row, which leaves a listing rendering a
 * broken photo — worse than the orphaned asset this order can leave behind, and
 * harder to notice. Seed rows (`public_id = null`) skip Cloudinary entirely.
 */
export async function deleteListingPhoto(input: unknown): Promise<ActionResult> {
  const parsed = photoActionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That photo could not be removed.' }
  }

  const { listingId, photoId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to manage photos.' }

  // Read the public_id before deleting, scoped to a listing this user hosts.
  // `!inner` makes the join a filter rather than an optional embed, so a photo
  // on someone else's listing comes back as no rows.
  const { data: photo, error: readError } = await supabase
    .from('listing_photos')
    .select('id, public_id, listings!inner(host_id)')
    .eq('id', photoId)
    .eq('listing_id', listingId)
    .eq('listings.host_id', user.id)
    .single()

  if (readError || !photo) {
    return { ok: false, error: 'That photo could not be found.' }
  }

  const { error } = await supabase.from('listing_photos').delete().eq('id', photoId)

  if (error) {
    console.error('[actions/listings] deleteListingPhoto failed:', error.message)
    return { ok: false, error: 'That photo could not be removed. Please try again.' }
  }

  if (photo.public_id) {
    try {
      await cloudinary.uploader.destroy(photo.public_id, { invalidate: true })
    } catch (cause) {
      // The row is already gone, so the listing is correct either way. Log the
      // orphaned asset rather than failing a delete the user has seen succeed.
      console.error(
        '[actions/listings] cloudinary destroy failed for',
        photo.public_id,
        cause instanceof Error ? cause.message : cause,
      )
    }
  }

  revalidatePath(`/host/listings/${listingId}/photos`)
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}

/** Move a photo one step within the gallery. */
export async function movePhoto(input: unknown): Promise<ActionResult> {
  const parsed = movePhotoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That photo could not be moved.' }
  }

  const { listingId, photoId, direction } = parsed.data
  return applyOrder(listingId, photoId, direction)
}

/**
 * Make a photo the cover — which also moves it to the front.
 *
 * Position and cover are kept in lockstep because `orderedPhotos` sorts
 * cover-first: a cover left mid-strip would show the host one order in this
 * editor and visitors another on the listing page.
 */
export async function setCoverPhoto(input: unknown): Promise<ActionResult> {
  const parsed = photoActionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That photo could not be set as the cover.' }
  }

  const { listingId, photoId } = parsed.data
  return applyOrder(listingId, photoId, 'front', { markCover: true })
}

/**
 * Publish a draft.
 *
 * Refuses without a photo — that requirement is what makes "exactly one cover"
 * true, which `coverPhotoOf` and `orderedPhotos` have both been documenting as
 * this feature's job. A listing that reaches search always has a cover to show.
 */
export async function publishListing(input: unknown): Promise<ActionResult> {
  const parsed = publishListingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That listing could not be published.' }
  }

  const { listingId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to publish a listing.' }

  const photos = await ownPhotos(supabase, listingId, user.id)
  if (photos === null) return { ok: false, error: 'That listing could not be found.' }

  if (photos.length === 0) {
    return { ok: false, error: 'Add at least one photo before publishing.' }
  }

  // Uploads never claim the cover (see addListingPhoto), so this is normally
  // where it first gets set.
  if (!photos.some((photo) => photo.is_cover)) {
    const lead = photos.reduce((lowest, photo) =>
      photo.position < lowest.position ? photo : lowest,
    )
    const { error: coverError } = await supabase
      .from('listing_photos')
      .update({ is_cover: true })
      .eq('id', lead.id)

    if (coverError) {
      console.error('[actions/listings] publish cover failed:', coverError.message)
      return { ok: false, error: 'That listing could not be published. Please try again.' }
    }
  }

  const { error } = await supabase
    .from('listings')
    .update({ is_published: true })
    .eq('id', listingId)
    .eq('host_id', user.id)

  if (error) {
    console.error('[actions/listings] publishListing failed:', error.message)
    return { ok: false, error: 'That listing could not be published. Please try again.' }
  }

  revalidatePath('/host/listings')
  revalidatePath(`/host/listings/${listingId}/photos`)
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}

// -----------------------------------------------------------------------------
// Shared internals
// -----------------------------------------------------------------------------

type OwnPhoto = { id: string; position: number; is_cover: boolean }

/**
 * A listing's photos, but only if this user hosts it — `null` otherwise, which
 * callers report as "not found" rather than "not yours" (a listing the caller
 * cannot host is not theirs to learn about).
 */
async function ownPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  userId: string,
): Promise<OwnPhoto[] | null> {
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('host_id', userId)
    .maybeSingle()

  if (!listing) return null

  const { data, error } = await supabase
    .from('listing_photos')
    .select('id, position, is_cover')
    .eq('listing_id', listingId)

  if (error) {
    console.error('[actions/listings] ownPhotos failed:', error.message)
    return null
  }

  return data ?? []
}

/**
 * Renumber a listing's photos around one move, writing only the rows that
 * actually changed.
 *
 * `reorderedPositions` returns the whole sequence renumbered `0..n-1` — it heals
 * gaps left by deletes — but an adjacent swap only really moves two rows, so
 * writing the diff keeps the common case at two updates instead of fifteen.
 */
async function applyOrder(
  listingId: string,
  photoId: string,
  move: 'earlier' | 'later' | 'front',
  options: { markCover?: boolean } = {},
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to manage photos.' }

  const photos = await ownPhotos(supabase, listingId, user.id)
  if (photos === null) return { ok: false, error: 'That listing could not be found.' }
  if (!photos.some((photo) => photo.id === photoId)) {
    return { ok: false, error: 'That photo could not be found.' }
  }

  const reordered = reorderedPositions(photos, photoId, move)

  if (reordered) {
    const before = new Map(photos.map((photo) => [photo.id, photo.position]))
    const changed = reordered.filter((row) => before.get(row.id) !== row.position)

    const results = await Promise.all(
      changed.map((row) =>
        supabase
          .from('listing_photos')
          .update({ position: row.position })
          .eq('id', row.id),
      ),
    )

    const failure = results.find((result) => result.error)
    if (failure?.error) {
      console.error('[actions/listings] reorder failed:', failure.error.message)
      return { ok: false, error: 'Those photos could not be reordered. Please try again.' }
    }
  }

  if (options.markCover) {
    // Clear first: `listing_photos_one_cover_idx` is a partial unique index, so
    // setting a second cover before clearing the old one is a constraint error.
    // If the second write fails the listing is left with no flagged cover, which
    // coverPhotoOf handles by falling back to the lowest position.
    const { error: clearError } = await supabase
      .from('listing_photos')
      .update({ is_cover: false })
      .eq('listing_id', listingId)
      .eq('is_cover', true)

    const { error: setError } = clearError
      ? { error: clearError }
      : await supabase.from('listing_photos').update({ is_cover: true }).eq('id', photoId)

    if (setError) {
      console.error('[actions/listings] setCover failed:', setError.message)
      return { ok: false, error: 'That cover could not be set. Please try again.' }
    }
  }

  revalidatePath(`/host/listings/${listingId}/photos`)
  revalidatePath(`/listings/${listingId}`)
  return { ok: true, data: undefined }
}
