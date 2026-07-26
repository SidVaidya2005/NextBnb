-- =============================================================================
-- 0008 — Per-listing occupancy for the booking widget (Feature 12)
--
-- 0007 answers "which listings are busy in this date range" and returns ids. The
-- booking widget needs the transpose — "which nights are busy for THIS listing" —
-- and no amount of app code can compute it: the `bookings` SELECT policy admits
-- the guest, the listing's host and admins, so an anonymous visitor AND a signed-in
-- guest looking at someone else's listing both read ZERO booking rows. A nested
-- select would return "[]" and the calendar would offer every night as free,
-- silently and successfully. That is F06's finding, arriving in the write path.
--
-- Same hardening shape as unavailable_listing_ids() and admin_list_users(): fixed
-- empty search_path, fully-qualified references, EXECUTE revoked from PUBLIC.
-- Occupancy is public information in this product (architecture.md → Availability
-- Rules), so exposing it is the design; the function still exposes nothing else —
-- no guest ids, no price snapshots, no booking rows, and nothing about a draft.
--
-- ONE range model on this side of the boundary: everything comes back INCLUSIVE
-- [start_date, end_date]. Returning bookings half-open and blocks inclusive in one
-- result set would hand the caller two conventions in the same array, which is
-- exactly how the two drift apart.
-- =============================================================================

create or replace function public.listing_occupied_ranges(p_listing_id uuid)
returns table (start_date date, end_date date)
language sql
stable
security definer
set search_path = ''
as $$
  -- Bookings are half-open [check_in, check_out): the guest leaves on the checkout
  -- day and another may arrive that morning, which is what the btree_gist
  -- exclusion constraint permits. `- 1` is what makes that true here — passing
  -- check_out through would paint one extra night as taken on every calendar and
  -- refuse a legal same-day turnover.
  select b.check_in, (b.check_out - 1)::date
    from public.listings l
    join public.bookings b on b.listing_id = l.id
   where l.id = p_listing_id
     and l.is_published
     and b.status = 'confirmed'
     -- A stay whose last occupied night has passed constrains nothing.
     and b.check_out > current_date

  union all

  -- Blocks are already inclusive [start_date, end_date] — both ends taken.
  select d.start_date, d.end_date
    from public.listings l
    join public.blocked_dates d on d.listing_id = l.id
   where l.id = p_listing_id
     and l.is_published
     and d.end_date >= current_date
$$;

comment on function public.listing_occupied_ranges(uuid) is
  'Inclusive [start_date, end_date] spans a published listing cannot be booked on: '
  'confirmed bookings (converted from half-open with check_out - 1) UNION host '
  'blocked dates, future only. SECURITY DEFINER because RLS hides bookings from '
  'anon and from any guest who is not the host; returns dates only, never booking '
  'detail. Needs no null guard (l.id = null matches nothing) — but note that an '
  'unknown or unpublished id therefore returns zero rows, which reads as "free". '
  'That is safe because bookings_insert_own_not_own_listing independently requires '
  'is_published and host_id <> auth.uid(): nothing books on an empty result alone.';

-- Restricted to published listings above, so calling this directly through
-- PostgREST cannot confirm that a given draft listing id exists.
revoke execute on function public.listing_occupied_ranges(uuid) from public;
grant  execute on function public.listing_occupied_ranges(uuid) to anon, authenticated;
