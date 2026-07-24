-- =============================================================================
-- Schema verification — Feature 02
--
-- Proves the invariants in context/architecture.md hold at the DATABASE level,
-- with no application code involved. Run it after any migration that touches
-- tables, policies, or grants:
--
--   Supabase MCP:  execute_sql with the contents of this file
--   psql:          psql "$DATABASE_URL" -f supabase/tests/schema-verification.sql
--
-- Self-contained and re-runnable: it creates four sentinel users, exercises
-- every rule against them, deletes them (cascading away every fixture row),
-- and finally prints a pass/fail table. Nothing is left behind, so it is safe
-- to run against a seeded database.
--
-- RLS is exercised by impersonation rather than by trusting the policy text:
-- set role authenticated + request.jwt.claims is exactly what PostgREST does
-- for a signed-in request, so auth.uid() resolves the same way it does in prod.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Harness
-- -----------------------------------------------------------------------------

create temporary table if not exists _v (
  seq        serial primary key,
  check_name text    not null,
  passed     boolean not null,
  detail     text
);

truncate _v restart identity;

-- Run SQL as a signed-in user. Returns 'OK' or the SQLSTATE it failed with.
-- A failed statement rolls back to this function's implicit savepoint, so an
-- expected rejection never poisons the rest of the script.
create or replace function pg_temp.try_as(p_user uuid, p_sql text)
returns text
language plpgsql
as $fn$
declare
  v_orig text := current_user;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute p_sql;
  perform set_config('role', v_orig, true);
  return 'OK';
exception when others then
  perform set_config('role', v_orig, true);
  return sqlstate;
end;
$fn$;

-- Evaluate a scalar (usually a count) as a signed-in user. -1 signals an error.
create or replace function pg_temp.value_as(p_user uuid, p_sql text)
returns text
language plpgsql
as $fn$
declare
  v_orig   text := current_user;
  v_result text;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute p_sql into v_result;
  perform set_config('role', v_orig, true);
  return v_result;
exception when others then
  perform set_config('role', v_orig, true);
  return '-1';
end;
$fn$;

create or replace function pg_temp.record(p_name text, p_passed boolean, p_detail text)
returns void
language sql
as $fn$
  insert into _v (check_name, passed, detail) values (p_name, p_passed, p_detail);
$fn$;

-- -----------------------------------------------------------------------------
-- Fixtures
--
-- Sentinel UUIDs so a re-run is idempotent and cleanup is exact. Note the guest
-- deliberately carries Google's alternate metadata keys (name/picture) to prove
-- handle_new_user()'s coalesce fallback works for both shapes.
-- -----------------------------------------------------------------------------

delete from auth.users where id in (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000004'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000001', 'host@nextbnb.test',
   '{"full_name":"Test Host","avatar_url":"https://example.test/host.png"}'),
  ('00000000-0000-4000-a000-000000000002', 'guest@nextbnb.test',
   '{"name":"Test Guest","picture":"https://example.test/guest.png"}'),
  ('00000000-0000-4000-a000-000000000003', 'stranger@nextbnb.test',
   '{"full_name":"Test Stranger"}'),
  ('00000000-0000-4000-a000-000000000004', 'admin@nextbnb.test',
   '{"full_name":"Test Admin"}');

update public.profiles
   set is_admin = true
 where id = '00000000-0000-4000-a000-000000000004';

insert into public.listings
  (id, host_id, title, property_type, city, country,
   max_guests, price_per_night, cleaning_fee, min_nights, is_published, amenities)
values
  ('10000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-a000-000000000001',
   'Verification Cabin (published)', 'cabin', 'Testville', 'Testland',
   4, 12000, 3000, 1, true, array['wifi','kitchen']),
  ('10000000-0000-4000-a000-000000000002',
   '00000000-0000-4000-a000-000000000001',
   'Verification Loft (draft)', 'loft', 'Testville', 'Testland',
   2, 9000, 0, 1, false, array['wifi']);

-- =============================================================================
-- Checks
-- =============================================================================

-- 0. Impersonation actually works. If this fails every check below is
--    meaningless, so it runs first.
select pg_temp.record(
  'harness: auth.uid() reflects impersonated user',
  pg_temp.value_as('00000000-0000-4000-a000-000000000002',
                   'select auth.uid()::text')
    = '00000000-0000-4000-a000-000000000002',
  pg_temp.value_as('00000000-0000-4000-a000-000000000002', 'select auth.uid()::text')
);

-- 1. The auth.users trigger creates profiles, mapping BOTH Google metadata
--    shapes (full_name/avatar_url and name/picture).
select pg_temp.record(
  'trigger: profiles row created for every new auth user',
  (select count(*) from public.profiles
    where id::text like '00000000-0000-4000-a000-00000000000%') = 4,
  'expected 4 sentinel profiles'
);

select pg_temp.record(
  'trigger: falls back to name/picture metadata keys',
  (select full_name = 'Test Guest' and avatar_url = 'https://example.test/guest.png'
     from public.profiles where id = '00000000-0000-4000-a000-000000000002'),
  'guest profile was built from name/picture'
);

-- 2. RLS is enabled on all nine tables.
select pg_temp.record(
  'rls: enabled on all 9 tables',
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity
      and c.relname in ('profiles','listings','listing_photos','bookings',
                        'blocked_dates','favorites','reviews',
                        'message_threads','messages')) = 9,
  'relrowsecurity count'
);

-- 3. Every table actually has policies (RLS enabled with no policy denies all).
select pg_temp.record(
  'rls: every table has at least one policy',
  (select count(distinct tablename) from pg_policies
    where schemaname = 'public') = 9,
  (select string_agg(distinct tablename, ', ') from pg_policies where schemaname = 'public')
);

-- 4. Overlapping confirmed bookings are impossible. THE core invariant.
select pg_temp.record(
  'booking: guest can reserve free dates',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.bookings
      (id, listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('20000000-0000-4000-a000-000000000001',
            '10000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000002',
            current_date + 30, current_date + 35, 2,
            5, 12000, 3000, 8400, 71400)
  $q$) = 'OK',
  'baseline booking, current_date +30 to +35'
);

select pg_temp.record(
  'booking: overlapping range rejected by exclusion constraint (23P01)',
  pg_temp.try_as('00000000-0000-4000-a000-000000000003', $q$
    insert into public.bookings
      (listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('10000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000003',
            current_date + 32, current_date + 37, 1,
            5, 12000, 3000, 8400, 71400)
  $q$) = '23P01',
  'second guest tried +32 to +37'
);

-- 5. Half-open [check_in, check_out): a stay may begin on another's checkout
--    day. If the range were inclusive this would be rejected as an overlap.
select pg_temp.record(
  'booking: same-day turnover accepted (half-open range)',
  pg_temp.try_as('00000000-0000-4000-a000-000000000003', $q$
    insert into public.bookings
      (id, listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('20000000-0000-4000-a000-000000000003',
            '10000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000003',
            current_date + 35, current_date + 38, 1,
            3, 12000, 3000, 5040, 44040)
  $q$) = 'OK',
  'check_in == previous booking check_out'
);

-- 6. No self-booking (policy, not application code).
select pg_temp.record(
  'booking: host cannot book their own listing',
  pg_temp.try_as('00000000-0000-4000-a000-000000000001', $q$
    insert into public.bookings
      (listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('10000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000001',
            current_date + 60, current_date + 62, 1,
            2, 12000, 3000, 3360, 30360)
  $q$) = '42501',
  'RLS insert policy rejects host_id = guest_id'
);

-- 7. Unpublished listings cannot be booked.
select pg_temp.record(
  'booking: unpublished listing cannot be booked',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.bookings
      (listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('10000000-0000-4000-a000-000000000002',
            '00000000-0000-4000-a000-000000000002',
            current_date + 70, current_date + 72, 1,
            2, 9000, 0, 2520, 20520)
  $q$) = '42501',
  'draft listing rejected'
);

-- 8. Price snapshots are immutable: the cancel grant covers status/cancelled_at
--    only, so touching money is a privilege error, not a silent no-op.
select pg_temp.record(
  'booking: guest cannot rewrite the price snapshot',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    update public.bookings set total = 1
     where id = '20000000-0000-4000-a000-000000000001'
  $q$) = '42501',
  'column-level grant blocks UPDATE of total'
);

-- 9. Cancelling frees the dates (the exclusion constraint is partial).
-- NOTE: the mutation and the assertion MUST be separate statements. A SELECT
-- takes its snapshot before evaluating, so a row written by a function called
-- in that same SELECT is not visible to a subquery beside it.
select pg_temp.record(
  'booking: guest can cancel an upcoming booking',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    update public.bookings
       set status = 'cancelled', cancelled_at = now()
     where id = '20000000-0000-4000-a000-000000000001'
  $q$) = 'OK',
  'cancel accepted by the UPDATE policy'
);

select pg_temp.record(
  'booking: cancel actually applied the status transition',
  (select status from public.bookings
    where id = '20000000-0000-4000-a000-000000000001')::text = 'cancelled',
  'status is now cancelled'
);

select pg_temp.record(
  'booking: cancelled dates become bookable again',
  pg_temp.try_as('00000000-0000-4000-a000-000000000003', $q$
    insert into public.bookings
      (listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('10000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000003',
            current_date + 30, current_date + 33, 1,
            3, 12000, 3000, 5040, 44040)
  $q$) = 'OK',
  'same range the cancelled booking held'
);

-- 10. A past stay is not cancellable: the UPDATE policy's USING clause carries
--     the cancellation window, so the row simply does not match (0 rows, no
--     error) and the status is unchanged.
insert into public.bookings
  (id, listing_id, guest_id, check_in, check_out, guests_count,
   nights, price_per_night, cleaning_fee, service_fee, total)
values ('20000000-0000-4000-a000-000000000002',
        '10000000-0000-4000-a000-000000000001',
        '00000000-0000-4000-a000-000000000002',
        current_date - 10, current_date - 3, 2,
        7, 12000, 3000, 11760, 98760);

select pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where id = '20000000-0000-4000-a000-000000000002'
$q$);

select pg_temp.record(
  'booking: a past stay cannot be cancelled',
  (select status from public.bookings
    where id = '20000000-0000-4000-a000-000000000002')::text = 'confirmed',
  'still confirmed after cancel attempt'
);

-- 11. Privilege escalation is impossible.
select pg_temp.record(
  'profiles: user cannot promote themselves to admin',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    update public.profiles set is_admin = true
     where id = '00000000-0000-4000-a000-000000000002'
  $q$) = '42501',
  'blocked by column-level grant, not by RLS'
);

select pg_temp.record(
  'profiles: user can still edit their own name',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    update public.profiles set full_name = 'Renamed Guest'
     where id = '00000000-0000-4000-a000-000000000002'
  $q$) = 'OK',
  'granted columns remain writable'
);

-- 12. Emails are reachable only through the self-guarded definer function.
select pg_temp.record(
  'admin: non-admin calling admin_list_users() is refused',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002',
                 'select * from public.admin_list_users()') = '42501',
  'internal is_admin() gate raises'
);

select pg_temp.record(
  'admin: admin calling admin_list_users() gets rows',
  pg_temp.value_as('00000000-0000-4000-a000-000000000004',
                   'select count(*)::text from public.admin_list_users()')::int >= 4,
  'admin sees auth.users emails'
);

-- 13. Draft listings are invisible at the database level — no query-side filter.
select pg_temp.record(
  'listings: draft invisible to a stranger',
  pg_temp.value_as('00000000-0000-4000-a000-000000000003',
    $q$select count(*)::text from public.listings
        where id = '10000000-0000-4000-a000-000000000002'$q$) = '0',
  'unpublished listing hidden'
);

select pg_temp.record(
  'listings: draft visible to its owner',
  pg_temp.value_as('00000000-0000-4000-a000-000000000001',
    $q$select count(*)::text from public.listings
        where id = '10000000-0000-4000-a000-000000000002'$q$) = '1',
  'host sees own draft'
);

select pg_temp.record(
  'listings: draft visible to an admin',
  pg_temp.value_as('00000000-0000-4000-a000-000000000004',
    $q$select count(*)::text from public.listings
        where id = '10000000-0000-4000-a000-000000000002'$q$) = '1',
  'is_admin() branch of the SELECT policy'
);

-- 14. Reviews: only the guest, only after checkout, only once.
select pg_temp.record(
  'reviews: rejected before checkout has passed',
  pg_temp.try_as('00000000-0000-4000-a000-000000000003', $q$
    insert into public.reviews (listing_id, booking_id, reviewer_id, rating, comment)
    values ('10000000-0000-4000-a000-000000000001',
            '20000000-0000-4000-a000-000000000003',
            '00000000-0000-4000-a000-000000000003', 5, 'Too early')
  $q$) = '42501',
  'future booking is not "completed"'
);

select pg_temp.record(
  'reviews: accepted after checkout has passed',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.reviews (listing_id, booking_id, reviewer_id, rating, comment)
    values ('10000000-0000-4000-a000-000000000001',
            '20000000-0000-4000-a000-000000000002',
            '00000000-0000-4000-a000-000000000002', 5, 'Lovely stay')
  $q$) = 'OK',
  'completed booking accepts one review'
);

select pg_temp.record(
  'reviews: second review on the same booking rejected (23505)',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.reviews (listing_id, booking_id, reviewer_id, rating, comment)
    values ('10000000-0000-4000-a000-000000000001',
            '20000000-0000-4000-a000-000000000002',
            '00000000-0000-4000-a000-000000000002', 1, 'Changed my mind')
  $q$) = '23505',
  'unique (booking_id)'
);

-- Immutability is a privilege error, not a silent zero-row update (0006).
select pg_temp.record(
  'reviews: immutable once posted',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    update public.reviews set rating = 1
     where booking_id = '20000000-0000-4000-a000-000000000002'
  $q$) = '42501',
  'UPDATE revoked on reviews'
);

-- 15. Messaging is participants-only, and read receipts belong to the reader.
insert into public.message_threads (id, listing_id, guest_id, host_id)
values ('30000000-0000-4000-a000-000000000001',
        '10000000-0000-4000-a000-000000000001',
        '00000000-0000-4000-a000-000000000002',
        '00000000-0000-4000-a000-000000000001');

select pg_temp.record(
  'messages: participant can send',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.messages (id, thread_id, sender_id, body)
    values ('40000000-0000-4000-a000-000000000001',
            '30000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000002', 'Is this available?')
  $q$) = 'OK',
  'guest posts into own thread'
);

select pg_temp.record(
  'messages: non-participant cannot send',
  pg_temp.try_as('00000000-0000-4000-a000-000000000003', $q$
    insert into public.messages (thread_id, sender_id, body)
    values ('30000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000003', 'Butting in')
  $q$) = '42501',
  'stranger blocked from the thread'
);

select pg_temp.record(
  'messages: non-participant cannot read',
  pg_temp.value_as('00000000-0000-4000-a000-000000000003',
    $q$select count(*)::text from public.messages
        where thread_id = '30000000-0000-4000-a000-000000000001'$q$) = '0',
  'thread contents hidden'
);

select pg_temp.record(
  'messages: recipient marks the message read',
  pg_temp.try_as('00000000-0000-4000-a000-000000000001', $q$
    update public.messages set read_at = now()
     where id = '40000000-0000-4000-a000-000000000001'
  $q$) = 'OK',
  'host is allowed to stamp read_at'
);

-- Separate statement, for the snapshot reason noted above.
select pg_temp.record(
  'messages: read receipt actually persisted',
  (select read_at is not null from public.messages
    where id = '40000000-0000-4000-a000-000000000001'),
  'read_at is set on the guest message'
);

select pg_temp.record(
  'messages: sender cannot edit the body',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    update public.messages set body = 'edited'
     where id = '40000000-0000-4000-a000-000000000001'
  $q$) = '42501',
  'only read_at is grantable'
);

-- 16. Favorites are private.
select pg_temp.record(
  'favorites: private to their owner',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.favorites (user_id, listing_id)
    values ('00000000-0000-4000-a000-000000000002',
            '10000000-0000-4000-a000-000000000001')
  $q$) = 'OK'
  and pg_temp.value_as('00000000-0000-4000-a000-000000000003',
        'select count(*)::text from public.favorites') = '0',
  'owner writes, stranger sees nothing'
);

-- 17. Realtime is published for messages and nothing else.
select pg_temp.record(
  'realtime: publication contains messages only',
  (select coalesce(string_agg(tablename, ','), '') from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public') = 'messages',
  (select coalesce(string_agg(tablename, ','), '(none)') from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public')
);

-- 18. Constraint spot-checks that need no impersonation.
select pg_temp.record(
  'constraints: amenity outside the AMENITIES list is rejected',
  pg_temp.try_as('00000000-0000-4000-a000-000000000001', $q$
    insert into public.listings
      (host_id, title, property_type, city, country, max_guests,
       price_per_night, amenities)
    values ('00000000-0000-4000-a000-000000000001', 'Bad amenities', 'home',
            'Testville', 'Testland', 2, 5000, array['helipad'])
  $q$) = '23514',
  'listings_amenities_known check'
);

select pg_temp.record(
  'constraints: check_out must be after check_in',
  pg_temp.try_as('00000000-0000-4000-a000-000000000002', $q$
    insert into public.bookings
      (listing_id, guest_id, check_in, check_out, guests_count,
       nights, price_per_night, cleaning_fee, service_fee, total)
    values ('10000000-0000-4000-a000-000000000001',
            '00000000-0000-4000-a000-000000000002',
            current_date + 90, current_date + 90, 1,
            1, 12000, 3000, 1680, 16680)
  $q$) = '23514',
  'bookings_checkout_after_checkin'
);

select pg_temp.record(
  'constraints: only one cover photo per listing',
  pg_temp.try_as('00000000-0000-4000-a000-000000000001', $q$
    insert into public.listing_photos (listing_id, url, is_cover) values
      ('10000000-0000-4000-a000-000000000001', 'https://example.test/1.jpg', true),
      ('10000000-0000-4000-a000-000000000001', 'https://example.test/2.jpg', true)
  $q$) = '23505',
  'listing_photos_one_cover_idx'
);

-- =============================================================================
-- Cleanup — removing the sentinel auth users cascades through profiles and
-- every dependent row, so the database is left exactly as it was found.
-- =============================================================================

delete from auth.users where id in (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000004'
);

-- =============================================================================
-- Report
-- =============================================================================

select
  case when passed then 'PASS' else 'FAIL' end as result,
  check_name,
  detail
from _v
order by passed, seq;
