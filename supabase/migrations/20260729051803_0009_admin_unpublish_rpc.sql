-- =============================================================================
-- 0009 — Admin soft moderation: unpublish someone else's listing (Feature 17)
--
-- THE GAP THIS CLOSES. `listings_delete_own_or_admin` names is_admin(), and so do
-- the SELECT policies — but `listings_update_own` is `using (host_id = uid) with
-- check (host_id = uid)` with NO admin branch, in any of 0001-0008. So an admin
-- unpublish is an UPDATE that matches zero rows and returns `{ error: null }`:
-- F13's finding exactly, moderation reported as successful that did nothing.
-- Until this migration, the admin dashboard's soft, reversible, PREFERRED verb was
-- the one thing an admin could not do, and it failed silently.
--
-- WHY A FUNCTION RATHER THAN `or public.is_admin()` ON THE POLICY. The OR-shaped
-- widening would have been symmetrical with the delete/cancel/review policies and
-- one line long. It was rejected because NO column grant restricts listing writes
-- (0006 revokes for `anon` only; a host may write every column of their own row,
-- constrained to their own row by the WITH CHECK). Widening the policy therefore
-- grants an admin every listing column — including `host_id`, i.e. the power to
-- reassign a listing to a different user. Nobody asked for that, and F16 already
-- recorded ONE policy being looser than the app that uses it as a live hazard.
--
-- So this follows admin_list_users() instead, and for the same stated reason:
-- the one function that bypasses RLS exposes only the one thing RLS cannot reach.
-- Here that is a single boolean, in a single direction.
--
-- ONE DIRECTION, DELIBERATELY. There is no admin republish. Publishing carries a
-- >= 1 photo requirement (setListingPublished) that makes "exactly one cover" true
-- for coverPhotoOf/orderedPhotos, and re-entering that path from here would mean
-- duplicating the guard or skipping it. A host republishes their own listing.
--
-- Same hardening shape as admin_list_users(), unavailable_listing_ids() and
-- listing_occupied_ranges(): fixed empty search_path, fully-qualified references,
-- EXECUTE revoked from PUBLIC and anon. The is_admin() check INSIDE the body is
-- the real gate — a definer function bypasses RLS entirely, so the grant below is
-- only a second lock.
-- =============================================================================

create or replace function public.admin_unpublish_listing(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Raise rather than return null: the caller must be able to tell "you are not an
  -- admin" from "no such listing", because it reports the second to the user as a
  -- refusal and the first is a bug or a forged request. Same errcode and shape as
  -- admin_list_users().
  if not public.is_admin() then
    raise exception 'forbidden: admin privileges required'
      using errcode = '42501';
  end if;

  -- Idempotent by construction: unpublishing an already-unpublished listing still
  -- matches the row and still returns its id, so two clicks converge (F08's
  -- setFavorite shape) instead of the second reporting "not found".
  update public.listings
     set is_published = false
   where id = p_listing_id
  returning id into v_id;

  -- NULL means no such listing — and it is the ONLY thing null can mean here,
  -- because the admin gate above has already raised and RLS is bypassed. That is
  -- what makes F13's zero-row branch safe to keep in the caller.
  return v_id;
end;
$$;

comment on function public.admin_unpublish_listing(uuid) is
  'Admin-only soft moderation: clears listings.is_published and writes no other '
  'column. SECURITY DEFINER because listings_update_own has no admin branch, so an '
  'admin UPDATE would silently affect zero rows. Self-guarded with is_admin() '
  '(raises 42501); returns the listing id, or null when no such listing exists. '
  'Deliberately one-directional — there is no admin republish, because publishing '
  'carries a >= 1 photo requirement that lives in setListingPublished.';

revoke execute on function public.admin_unpublish_listing(uuid) from public, anon;
grant  execute on function public.admin_unpublish_listing(uuid) to authenticated;
