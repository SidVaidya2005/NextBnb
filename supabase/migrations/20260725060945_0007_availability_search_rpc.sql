-- =============================================================================
-- 0007 — Availability RPC for search (Feature 06)
--
-- Search must exclude listings that are unavailable for a requested date range.
-- That check cannot run in application code: the `bookings` SELECT policy is
-- `guest_id = auth.uid() OR listing host_id = auth.uid() OR is_admin()`, so an
-- anonymous visitor reads ZERO booking rows. A nested select would return "[]"
-- for every listing and the grid would silently claim everything is free.
--
-- So the check moves into a SECURITY DEFINER function with the narrowest useful
-- return type: listing ids only. It exposes occupancy — which the F12 date
-- picker must show publicly anyway — and never guest ids, price snapshots, or
-- any booking row. Same hardening shape as admin_list_users(): fixed empty
-- search_path, fully-qualified references, EXECUTE revoked from PUBLIC.
--
-- `blocked_dates` is already anon-readable for published listings (0005), but
-- both halves live here regardless: architecture.md defines availability as
-- "confirmed bookings UNION blocked_dates", and splitting that across two
-- mechanisms is how the two halves drift apart.
-- =============================================================================

create or replace function public.unavailable_listing_ids(
  p_check_in date,
  p_check_out date
)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- A null bound would build an UNBOUNDED daterange, which overlaps everything
  -- and would therefore mark every listing unavailable. Refusing null is the
  -- difference between "no date filter" and "no results at all".
  select l.id
    from public.listings l
    join public.bookings b on b.listing_id = l.id
   where p_check_in is not null
     and p_check_out is not null
     and l.is_published
     and b.status = 'confirmed'
     -- Bookings are half-open [check_in, check_out): the checkout day is free,
     -- so a same-day turnover is NOT an overlap.
     and daterange(b.check_in, b.check_out, '[)')
         && daterange(p_check_in, p_check_out, '[)')

  union

  select l.id
    from public.listings l
    join public.blocked_dates d on d.listing_id = l.id
   where p_check_in is not null
     and p_check_out is not null
     and l.is_published
     -- Blocks are INCLUSIVE [start_date, end_date] — both ends blocked — so the
     -- end must be pushed out a day to compose with the half-open model above.
     and daterange(d.start_date, d.end_date + 1, '[)')
         && daterange(p_check_in, p_check_out, '[)')
$$;

comment on function public.unavailable_listing_ids(date, date) is
  'Published listing ids that cannot be booked for [p_check_in, p_check_out): '
  'confirmed bookings UNION host blocked dates. SECURITY DEFINER because RLS '
  'hides bookings from anon; returns ids only, never booking detail.';

-- Restricted to published listings above, so calling this directly through
-- PostgREST cannot confirm that a given draft listing id exists.
revoke execute on function public.unavailable_listing_ids(date, date) from public;
grant  execute on function public.unavailable_listing_ids(date, date) to anon, authenticated;
