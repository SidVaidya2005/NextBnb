'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { setFavoriteSchema } from '@/lib/validations/favorites'
import type { ActionResult } from '@/lib/utils'

/**
 * Saves or unsaves a listing for the current user.
 *
 * Idempotent by design: the caller sends the state it wants and this brings the
 * table to that state, so a double-click converges instead of racing. See
 * `validations/favorites.ts` for why that beats a flip.
 *
 * `favorites` has no UPDATE path at all — migration `0006` revoked it, because a
 * favorite is created or removed and never edited. So this is strictly an insert
 * or a delete.
 *
 * The `user_id = auth.uid()` RLS policies are the real guard; the `getUser()`
 * check below is for the message the user sees, not for authorization.
 */
export async function setFavorite(input: unknown): Promise<ActionResult> {
  const parsed = setFavoriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That stay could not be saved.' }
  }

  const { listingId, saved } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Sign in to save stays.' }
  }

  const { error } = saved
    ? await supabase
        .from('favorites')
        // The composite PK (user_id, listing_id) makes a repeat save a conflict
        // rather than a duplicate row; ignoring it keeps the retry silent.
        .upsert(
          { user_id: user.id, listing_id: listingId },
          { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
        )
    : await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId)

  if (error) {
    console.error('[actions/favorites] setFavorite failed:', error.message)
    return { ok: false, error: 'That stay could not be saved. Please try again.' }
  }

  // Only /favorites. The home page and the listing page are dynamic — they read
  // cookies and searchParams, so they re-render on every visit anyway — and
  // revalidating "/" would re-run the whole filtered search query on every tap
  // of a heart for no freshness gain.
  revalidatePath('/favorites')

  return { ok: true, data: undefined }
}
