-- =============================================================================
-- 0005 — SECURITY DEFINER hardening
--
-- Response to the Supabase security advisor after 0002/0003. Postgres grants
-- EXECUTE on new functions to PUBLIC by default, and Supabase additionally
-- grants to anon/authenticated — so every function in the `public` schema is
-- reachable as a PostgREST RPC endpoint (/rest/v1/rpc/<name>) unless revoked.
--
-- Two distinct problems, two distinct fixes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trigger functions must not be callable as RPC.
--
-- handle_new_user() is SECURITY DEFINER and writes to public.profiles; it has
-- no business being reachable from the API surface at all. (Invoking a trigger
-- function directly errors out, but an exposed definer endpoint is not
-- something to leave to chance.) set_updated_at() gets the same treatment for
-- consistency, though it is invoker-rights.
--
-- Revoking EXECUTE does NOT affect the triggers: permission on a trigger
-- function is checked when the trigger is created, not when it fires.
-- -----------------------------------------------------------------------------

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

revoke execute on function public.set_updated_at()
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. anon should never reach is_admin().
--
-- The three public-readable tables had a single SELECT policy covering both
-- roles, whose predicate ended in `or public.is_admin()`. A signed-out visitor
-- is never an admin, so that call was always a wasted definer invocation on the
-- hottest read path in the app (public listing pages) — and it forced anon to
-- hold EXECUTE on is_admin().
--
-- Splitting per role lets anon run the trivial `is_published` check and lets us
-- revoke the grant. Multiple permissive policies on the same command are OR'd,
-- and each role only ever evaluates its own.
-- -----------------------------------------------------------------------------

drop policy "listings_select_published_or_own" on public.listings;

create policy "listings_select_anon_published"
  on public.listings for select
  to anon
  using (is_published);

create policy "listings_select_published_or_own"
  on public.listings for select
  to authenticated
  using (
    is_published
    or host_id = (select auth.uid())
    or public.is_admin()
  );

drop policy "listing_photos_select_readable_listing" on public.listing_photos;

create policy "listing_photos_select_anon_published"
  on public.listing_photos for select
  to anon
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_photos.listing_id
        and l.is_published
    )
  );

create policy "listing_photos_select_readable_listing"
  on public.listing_photos for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_photos.listing_id
        and (
          l.is_published
          or l.host_id = (select auth.uid())
          or public.is_admin()
        )
    )
  );

drop policy "blocked_dates_select_readable_listing" on public.blocked_dates;

create policy "blocked_dates_select_anon_published"
  on public.blocked_dates for select
  to anon
  using (
    exists (
      select 1
      from public.listings l
      where l.id = blocked_dates.listing_id
        and l.is_published
    )
  );

create policy "blocked_dates_select_readable_listing"
  on public.blocked_dates for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = blocked_dates.listing_id
        and (
          l.is_published
          or l.host_id = (select auth.uid())
          or public.is_admin()
        )
    )
  );

-- Now that no anon-facing policy references it. `authenticated` keeps EXECUTE
-- because its policies do call is_admin() and RLS predicates are evaluated with
-- the querying role's privileges.
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;
