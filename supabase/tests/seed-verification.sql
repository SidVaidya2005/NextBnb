-- =============================================================================
-- Seed verification — Feature 03
--
-- Proves supabase/seed.sql produced coherent, useful fixture data. Run it after
-- every seed run:
--
--   Supabase MCP:  execute_sql with the contents of this file
--   psql:          psql "$DATABASE_URL" -f supabase/tests/seed-verification.sql
--
-- UNLIKE schema-verification.sql, this script does NOT clean up after itself —
-- the seed is meant to persist. It only reads.
--
-- Why this exists at all: the seed runs as service-role, which BYPASSES RLS.
-- Every rule the app depends on — a review must belong to a completed booking
-- by that guest, a host cannot book their own listing, a review's listing must
-- match its booking's — is unenforced during seeding. Postgres will happily
-- accept fixture data no real user could ever have produced. Checks 5–9 below
-- re-assert those rules by hand; they are the point of this file. The count
-- checks are the easy part.
--
-- Every assertion is scoped to the seed's sentinel id prefixes, so rows created
-- later by a real signed-in account never make it pass or fail spuriously.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Harness — same shape as schema-verification.sql
-- -----------------------------------------------------------------------------

create temporary table if not exists _sv (
  seq        serial primary key,
  check_name text    not null,
  passed     boolean not null,
  detail     text
);

truncate _sv restart identity;

create or replace function pg_temp.record(p_name text, p_passed boolean, p_detail text)
returns void
language sql
as $fn$
  insert into _sv (check_name, passed, detail) values (p_name, p_passed, p_detail);
$fn$;

-- Evaluate a scalar as the signed-out visitor. RLS predicates run with the
-- querying role's privileges, so this is the only honest way to ask "what does
-- a logged-out browser actually see?" — reading the policy text is not proof.
create or replace function pg_temp.value_as_anon(p_sql text)
returns text
language plpgsql
as $fn$
declare
  v_orig   text := current_user;
  v_result text;
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute p_sql into v_result;
  perform set_config('role', v_orig, true);
  return v_result;
exception when others then
  perform set_config('role', v_orig, true);
  return '-1';
end;
$fn$;

-- Shorthand for the sentinel prefixes.
create or replace function pg_temp.seeded_listings() returns setof public.listings
language sql stable as $fn$
  select * from public.listings where id::text like '20000000-0000-4000-b000-%';
$fn$;

create or replace function pg_temp.seeded_bookings() returns setof public.bookings
language sql stable as $fn$
  select * from public.bookings where id::text like '30000000-0000-4000-b000-%';
$fn$;

-- =============================================================================
-- 1. Row counts
-- =============================================================================

select pg_temp.record(
  'counts: 5 demo profiles exist',
  (select count(*) from public.profiles where id::text like '00000000-0000-4000-b000-%') = 5,
  'expected 5'
);

select pg_temp.record(
  'counts: 26 listings — 24 published + 2 drafts',
  (select count(*) from pg_temp.seeded_listings()) = 26
    and (select count(*) from pg_temp.seeded_listings() where is_published) = 24
    and (select count(*) from pg_temp.seeded_listings() where not is_published) = 2,
  'expected 26 / 24 / 2'
);

select pg_temp.record(
  'counts: 130 listing photos',
  (select count(*) from public.listing_photos
    where listing_id::text like '20000000-0000-4000-b000-%') = 130,
  'expected 26 listings x 5'
);

select pg_temp.record(
  'counts: 17 bookings',
  (select count(*) from pg_temp.seeded_bookings()) = 17,
  'expected 17'
);

select pg_temp.record(
  'counts: 7 reviews',
  (select count(*) from public.reviews
    where booking_id::text like '30000000-0000-4000-b000-%') = 7,
  'expected 7'
);

select pg_temp.record(
  'counts: 5 blocked date ranges',
  (select count(*) from public.blocked_dates
    where listing_id::text like '20000000-0000-4000-b000-%') = 5,
  'expected 5'
);

select pg_temp.record(
  'profiles: all named, exactly one without an avatar',
  (select count(*) from public.profiles
    where id::text like '00000000-0000-4000-b000-%' and full_name is null) = 0
  and (select count(*) from public.profiles
    where id::text like '00000000-0000-4000-b000-%' and avatar_url is null) = 1,
  'the null avatar exercises the UI fallback'
);

-- =============================================================================
-- 2. Photo integrity
-- =============================================================================

select pg_temp.record(
  'photos: every listing has exactly 5',
  (select count(*) from (
     select listing_id from public.listing_photos
      where listing_id::text like '20000000-0000-4000-b000-%'
      group by listing_id having count(*) <> 5
   ) x) = 0,
  'no listing may be short of photos'
);

select pg_temp.record(
  'photos: every listing has exactly one cover',
  (select count(*) from (
     select listing_id from public.listing_photos
      where listing_id::text like '20000000-0000-4000-b000-%'
      group by listing_id having count(*) filter (where is_cover) <> 1
   ) x) = 0,
  'partial unique index enforces at-most-one; this proves at-least-one'
);

select pg_temp.record(
  'photos: positions are 0-4 with no duplicates',
  (select count(*) from (
     select listing_id from public.listing_photos
      where listing_id::text like '20000000-0000-4000-b000-%'
      group by listing_id
     having count(distinct position) <> 5 or min(position) <> 0 or max(position) <> 4
   ) x) = 0,
  'gallery order must be unambiguous'
);

select pg_temp.record(
  'photos: all seed rows have public_id = null',
  (select count(*) from public.listing_photos
    where listing_id::text like '20000000-0000-4000-b000-%'
      and public_id is not null) = 0,
  'Unsplash seeds were never uploaded — delete must skip cloudinary.destroy()'
);

select pg_temp.record(
  'photos: every url is an images.unsplash.com https url',
  (select count(*) from public.listing_photos
    where listing_id::text like '20000000-0000-4000-b000-%'
      and url not like 'https://images.unsplash.com/photo-%') = 0,
  'next.config.ts only whitelists this host'
);

-- =============================================================================
-- 3. Catalogue coverage — F06 needs every filter dimension populated
-- =============================================================================

select pg_temp.record(
  'coverage: all 10 property types appear',
  (select count(distinct property_type) from pg_temp.seeded_listings()) = 10,
  'every property-type filter must return something'
);

select pg_temp.record(
  'coverage: all 18 amenities appear on at least one listing',
  (select count(*) from unnest(array[
     'wifi','kitchen','washer','dryer','air_conditioning','heating',
     'workspace','tv','free_parking','pool','hot_tub','ev_charger',
     'crib','gym','bbq_grill','breakfast','fireplace','smoke_alarm'
   ]) as a
   where not exists (
     select 1 from pg_temp.seeded_listings() l where a = any(l.amenities)
   )) = 0,
  'an amenity chip that always returns nothing is an untestable filter'
);

select pg_temp.record(
  'coverage: 8 distinct cities',
  (select count(distinct city) from pg_temp.seeded_listings()) = 8,
  'destination search needs several cities with >1 listing each'
);

select pg_temp.record(
  'coverage: every city has at least 3 published listings',
  (select count(*) from (
     select city from pg_temp.seeded_listings()
      where is_published group by city having count(*) < 3
   ) x) = 0,
  'a destination search returning one card cannot demonstrate a grid'
);

-- =============================================================================
-- 4. Filter spread — each dimension must have matching AND non-matching rows
-- =============================================================================

select pg_temp.record(
  'spread: price range spans under $100 to over $500',
  (select min(price_per_night) from pg_temp.seeded_listings()) < 10000
    and (select max(price_per_night) from pg_temp.seeded_listings()) > 50000,
  'min/max price filters need room to bite'
);

select pg_temp.record(
  'spread: at least 3 listings sleep 8 or more',
  (select count(*) from pg_temp.seeded_listings() where max_guests >= 8) >= 3,
  'guest-count filter'
);

select pg_temp.record(
  'spread: at least one listing has no kitchen',
  (select count(*) from pg_temp.seeded_listings()
    where not ('kitchen' = any(amenities))) >= 1,
  'a filter that never excludes anything proves nothing'
);

select pg_temp.record(
  'spread: at least one listing requires more than 1 night',
  (select count(*) from pg_temp.seeded_listings() where min_nights > 1) >= 1,
  'F12 must have a minimum-stay rule to enforce'
);

select pg_temp.record(
  'spread: at least one listing has no cleaning fee',
  (select count(*) from pg_temp.seeded_listings() where cleaning_fee = 0) >= 1,
  'price breakdown must handle a zero line item'
);

-- =============================================================================
-- 5. No self-booking — RLS did NOT enforce this during seeding
-- =============================================================================

select pg_temp.record(
  'integrity: no booking by a listing''s own host',
  (select count(*) from pg_temp.seeded_bookings() b
     join public.listings l on l.id = b.listing_id
    where b.guest_id = l.host_id) = 0,
  'the bookings INSERT policy would have blocked this for a real user'
);

select pg_temp.record(
  'integrity: no booking exceeds its listing''s max_guests',
  (select count(*) from pg_temp.seeded_bookings() b
     join public.listings l on l.id = b.listing_id
    where b.guests_count > l.max_guests) = 0,
  'a 9-guest booking on a 4-guest listing is not reachable through the UI'
);

select pg_temp.record(
  'integrity: no booking is shorter than its listing''s min_nights',
  (select count(*) from pg_temp.seeded_bookings() b
     join public.listings l on l.id = b.listing_id
    where b.nights < l.min_nights) = 0,
  'F12 enforces minimum stay; the seed must not contradict it'
);

select pg_temp.record(
  'integrity: every booking is on a published listing',
  (select count(*) from pg_temp.seeded_bookings() b
     join public.listings l on l.id = b.listing_id
    where not l.is_published) = 0,
  'drafts are unbookable — the INSERT policy requires is_published'
);

-- =============================================================================
-- 6. Price snapshots are internally coherent
--
-- Only internal consistency is asserted, deliberately. Comparing a snapshot
-- back to its listing would start failing the moment a host edits a price in
-- F10 — and a snapshot that no longer matches the current listing is CORRECT
-- behaviour, not a defect.
-- =============================================================================

select pg_temp.record(
  'money: nights matches the date range on every booking',
  (select count(*) from pg_temp.seeded_bookings()
    where nights <> (check_out - check_in)) = 0,
  'half-open [check_in, check_out)'
);

select pg_temp.record(
  'money: service_fee is 14% of subtotal, rounded half-up to whole cents',
  (select count(*) from pg_temp.seeded_bookings()
    where service_fee <> round(nights * price_per_night * 0.14)::int) = 0,
  'mirrors SERVICE_FEE_PCT in src/lib/constants.ts'
);

select pg_temp.record(
  'money: total = subtotal + cleaning_fee + service_fee',
  (select count(*) from pg_temp.seeded_bookings()
    where total <> nights * price_per_night + cleaning_fee + service_fee) = 0,
  'all integer cents, no floating point anywhere'
);

-- =============================================================================
-- 7. Review integrity — RLS did NOT enforce any of this during seeding
-- =============================================================================

select pg_temp.record(
  'reviews: reviewer is the booking''s guest and listing matches',
  (select count(*) from public.reviews r
     join public.bookings b on b.id = r.booking_id
    where r.booking_id::text like '30000000-0000-4000-b000-%'
      and (b.guest_id <> r.reviewer_id or b.listing_id <> r.listing_id)) = 0,
  'a review attributed to the wrong stay or wrong person'
);

select pg_temp.record(
  'reviews: every reviewed booking is confirmed and already checked out',
  (select count(*) from public.reviews r
     join public.bookings b on b.id = r.booking_id
    where r.booking_id::text like '30000000-0000-4000-b000-%'
      and (b.status <> 'confirmed' or b.check_out >= current_date)) = 0,
  '"completed" is derived, never stored — no review before checkout'
);

select pg_temp.record(
  'reviews: ratings are within 1-5 and not uniformly perfect',
  (select count(*) from public.reviews
    where booking_id::text like '30000000-0000-4000-b000-%'
      and rating not between 1 and 5) = 0
  and (select count(distinct rating) from public.reviews
    where booking_id::text like '30000000-0000-4000-b000-%') >= 3,
  'a fixture where every rating is 5 cannot show a meaningful average'
);

select pg_temp.record(
  'reviews: at least 3 listings carry 2+ reviews, and most carry none',
  (select count(*) from (
     select listing_id from public.reviews
      where booking_id::text like '30000000-0000-4000-b000-%'
      group by listing_id having count(*) >= 2
   ) x) >= 3
  and (select count(*) from pg_temp.seeded_listings() l
        where not exists (select 1 from public.reviews r where r.listing_id = l.id)) >= 10,
  'F05 must render both an average and a no-rating state'
);

select pg_temp.record(
  'reviews: at least one completed booking is left unreviewed',
  (select count(*) from pg_temp.seeded_bookings() b
    where b.status = 'confirmed' and b.check_out < current_date
      and not exists (select 1 from public.reviews r where r.booking_id = b.id)) >= 1,
  'F15 needs an outstanding review target'
);

-- =============================================================================
-- 8. Availability coherence
-- =============================================================================

select pg_temp.record(
  'availability: no two confirmed bookings overlap on a listing',
  (select count(*) from pg_temp.seeded_bookings() a
     join pg_temp.seeded_bookings() b
       on a.listing_id = b.listing_id and a.id < b.id
    where a.status = 'confirmed' and b.status = 'confirmed'
      and daterange(a.check_in, a.check_out, '[)')
       && daterange(b.check_in, b.check_out, '[)')) = 0,
  'the exclusion constraint should make this impossible — assert it anyway'
);

select pg_temp.record(
  'availability: no blocked range overlaps a confirmed booking',
  (select count(*) from public.blocked_dates d
     join public.bookings b
       on b.listing_id = d.listing_id and b.status = 'confirmed'
    where d.listing_id::text like '20000000-0000-4000-b000-%'
      and daterange(d.start_date, d.end_date + 1, '[)')
       && daterange(b.check_in, b.check_out, '[)')) = 0,
  'blocks are inclusive [start, end]; converted to [start, end+1) to compare'
);

select pg_temp.record(
  'availability: a confirmed booking overlaps a CANCELLED one',
  (select count(*) from pg_temp.seeded_bookings() c
     join pg_temp.seeded_bookings() f
       on f.listing_id = c.listing_id and f.status = 'confirmed'
    where c.status = 'cancelled'
      and daterange(c.check_in, c.check_out, '[)')
       && daterange(f.check_in, f.check_out, '[)')) >= 1,
  'proves in live data that cancelling frees the dates'
);

-- =============================================================================
-- 9. Temporal shape — must survive every future re-run, since all dates are
-- relative. If this ever fails, the seed has aged out and needs re-running.
-- =============================================================================

select pg_temp.record(
  'temporal: at least one completed stay exists (reviewable)',
  (select count(*) from pg_temp.seeded_bookings()
    where status = 'confirmed' and check_out < current_date) >= 1,
  'derived completed = confirmed AND check_out < current_date'
);

select pg_temp.record(
  'temporal: at least one upcoming stay exists (cancellable)',
  (select count(*) from pg_temp.seeded_bookings()
    where status = 'confirmed' and check_in > current_date) >= 1,
  'F13 cancel needs a target'
);

select pg_temp.record(
  'temporal: at least one in-progress stay exists',
  (select count(*) from pg_temp.seeded_bookings()
    where status = 'confirmed'
      and check_in <= current_date and check_out > current_date) >= 1,
  'not cancellable, not yet reviewable — the awkward middle state'
);

select pg_temp.record(
  'temporal: at least one cancelled booking exists',
  (select count(*) from pg_temp.seeded_bookings() where status = 'cancelled') >= 1,
  'cancelled rows must carry cancelled_at'
);

select pg_temp.record(
  'temporal: every cancelled booking has cancelled_at set',
  (select count(*) from pg_temp.seeded_bookings()
    where status = 'cancelled' and cancelled_at is null) = 0,
  null
);

select pg_temp.record(
  'temporal: no booking starts in the past for a future-dated fixture',
  (select count(*) from pg_temp.seeded_bookings()
    where check_out <= check_in) = 0,
  'checkout must be strictly after check-in'
);

-- =============================================================================
-- 10. RLS against real seed data — the signed-out view
-- =============================================================================

select pg_temp.record(
  'rls: anon sees the 24 published listings',
  pg_temp.value_as_anon($q$
    select count(*)::text from public.listings
     where id::text like '20000000-0000-4000-b000-%'
  $q$) = '24',
  'drafts must not leak to a logged-out visitor'
);

select pg_temp.record(
  'rls: anon sees photos only for published listings',
  pg_temp.value_as_anon($q$
    select count(*)::text from public.listing_photos
     where listing_id::text like '20000000-0000-4000-b000-%'
  $q$) = '120',
  '24 visible listings x 5 photos; the 2 drafts'' 10 photos stay hidden'
);

select pg_temp.record(
  'rls: anon sees the public reviews',
  pg_temp.value_as_anon($q$
    select count(*)::text from public.reviews
     where booking_id::text like '30000000-0000-4000-b000-%'
  $q$) = '7',
  'reviews are public — they render on listing pages'
);

select pg_temp.record(
  'rls: anon sees no bookings at all',
  pg_temp.value_as_anon($q$
    select count(*)::text from public.bookings
     where id::text like '30000000-0000-4000-b000-%'
  $q$) = '0',
  'bookings are guest/host only'
);

-- =============================================================================
-- Report
-- =============================================================================

select
  case when passed then 'PASS' else 'FAIL' end as result,
  check_name,
  detail
from _sv
order by passed, seq;
