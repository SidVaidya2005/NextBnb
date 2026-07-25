-- =============================================================================
-- 0003 — Row Level Security: column grants + the policy matrix
--
-- RLS is the authoritative access control for NextBnb (context/architecture.md
-- → Row Level Security). Application code is never the only guard.
--
-- Two conventions applied throughout:
--
--   1. `(select auth.uid())` rather than bare `auth.uid()`. The subselect is
--      hoisted into an InitPlan and evaluated ONCE per query instead of once
--      per row — Supabase's documented RLS performance rule.
--   2. Explicit `to anon, authenticated` / `to authenticated`. A policy scoped
--      `to authenticated` stops evaluating immediately for signed-out users
--      instead of running the whole predicate and failing at the end.
--
-- RLS filters ROWS, not COLUMNS. Where a rule is "may update, but only this
-- column", the column-level GRANTs below carry it — Postgres checks those in
-- addition to RLS.
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_photos  enable row level security;
alter table public.bookings        enable row level security;
alter table public.blocked_dates   enable row level security;
alter table public.favorites       enable row level security;
alter table public.reviews         enable row level security;
alter table public.message_threads enable row level security;
alter table public.messages        enable row level security;

-- -----------------------------------------------------------------------------
-- Column-level privileges
--
-- Supabase grants ALL on public tables to anon/authenticated by default, so
-- these revokes are what make "cancel only" and "cannot self-promote" real.
-- -----------------------------------------------------------------------------

-- profiles: a user edits their display name and avatar — NOT is_admin.
-- Without this, `update profiles set is_admin = true where id = auth.uid()`
-- satisfies the own-row policy and grants the caller the admin dashboard.
revoke update on public.profiles from authenticated;
grant  update (full_name, avatar_url) on public.profiles to authenticated;

-- bookings: cancelling is a status transition, never a rewrite of the price
-- snapshot or the dates.
revoke update on public.bookings from authenticated;
grant  update (status, cancelled_at) on public.bookings to authenticated;

-- message_threads: participants bump ordering only.
revoke update on public.message_threads from authenticated;
grant  update (last_message_at) on public.message_threads to authenticated;

-- messages: the recipient stamps read_at; message bodies are never editable.
revoke update on public.messages from authenticated;
grant  update (read_at) on public.messages to authenticated;

-- Tables whose DELETE column in the matrix is "none". Absent a DELETE policy
-- these already affect zero rows; revoking turns a silent no-op into a hard
-- error. Row removal happens via FK cascade, which runs as the table owner and
-- is unaffected by these grants.
revoke delete on public.profiles        from anon, authenticated;
revoke delete on public.bookings        from anon, authenticated;
revoke delete on public.message_threads from anon, authenticated;
revoke delete on public.messages        from anon, authenticated;

-- -----------------------------------------------------------------------------
-- profiles — publicly readable (host names, reviewer names, message
-- participants). Safe precisely because there is no email column.
-- Rows are created ONLY by the handle_new_user() trigger: no INSERT policy.
-- -----------------------------------------------------------------------------

create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- listings — unpublished listings are invisible to everyone but their owner
-- and admins. Enforced here, not in the query layer.
-- -----------------------------------------------------------------------------

create policy "listings_select_published_or_own"
  on public.listings for select
  to anon, authenticated
  using (
    is_published
    or host_id = (select auth.uid())
    or public.is_admin()
  );

create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (host_id = (select auth.uid()));

create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "listings_delete_own_or_admin"
  on public.listings for delete
  to authenticated
  using (host_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- listing_photos — ownership is proven by joining to the parent listing inside
-- the policy, never taken from the client.
-- -----------------------------------------------------------------------------

create policy "listing_photos_select_readable_listing"
  on public.listing_photos for select
  to anon, authenticated
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

create policy "listing_photos_insert_own_listing"
  on public.listing_photos for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = listing_photos.listing_id
        and l.host_id = (select auth.uid())
    )
  );

create policy "listing_photos_update_own_listing"
  on public.listing_photos for update
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_photos.listing_id
        and l.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = listing_photos.listing_id
        and l.host_id = (select auth.uid())
    )
  );

create policy "listing_photos_delete_own_listing_or_admin"
  on public.listing_photos for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.listings l
      where l.id = listing_photos.listing_id
        and l.host_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------

create policy "bookings_select_participant_or_admin"
  on public.bookings for select
  to authenticated
  using (
    guest_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.listings l
      where l.id = bookings.listing_id
        and l.host_id = (select auth.uid())
    )
  );

-- No self-booking, and no booking an unpublished draft. The exclusion
-- constraint in 0001 is the final guard against overlapping dates.
create policy "bookings_insert_own_not_own_listing"
  on public.bookings for insert
  to authenticated
  with check (
    guest_id = (select auth.uid())
    and exists (
      select 1
      from public.listings l
      where l.id = bookings.listing_id
        and l.host_id <> (select auth.uid())
        and l.is_published
    )
  );

-- Cancel only. The USING clause carries the cancellation WINDOW: a guest may
-- cancel a confirmed booking whose check-in has not passed. Because USING also
-- requires status = 'confirmed', a cancelled booking can never be un-cancelled.
-- WITH CHECK is deliberately laxer than USING — it validates the row AFTER the
-- update, where status is 'cancelled'. Column grants above restrict which
-- columns the update may touch.
create policy "bookings_update_cancel_own_or_admin"
  on public.bookings for update
  to authenticated
  using (
    public.is_admin()
    or (
      guest_id = (select auth.uid())
      and status = 'confirmed'
      and check_in >= current_date
    )
  )
  with check (
    guest_id = (select auth.uid())
    or public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- blocked_dates — visible wherever the listing is (guests need them to render
-- an availability calendar); writable only by the host.
-- -----------------------------------------------------------------------------

create policy "blocked_dates_select_readable_listing"
  on public.blocked_dates for select
  to anon, authenticated
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

create policy "blocked_dates_insert_own_listing"
  on public.blocked_dates for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = blocked_dates.listing_id
        and l.host_id = (select auth.uid())
    )
  );

create policy "blocked_dates_update_own_listing"
  on public.blocked_dates for update
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = blocked_dates.listing_id
        and l.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = blocked_dates.listing_id
        and l.host_id = (select auth.uid())
    )
  );

create policy "blocked_dates_delete_own_listing"
  on public.blocked_dates for delete
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = blocked_dates.listing_id
        and l.host_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- favorites — entirely private to their owner. No UPDATE: a favorite is
-- created or removed, never edited.
-- -----------------------------------------------------------------------------

create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- reviews — public to read; writable only by the guest of a COMPLETED booking.
-- "Completed" is derived here, never stored: confirmed + checkout in the past.
--
-- Note every reference to the new row is qualified `reviews.<col>`. Unqualified
-- names inside these subqueries would bind to the subquery's own table (b),
-- making the comparison trivially true.
--
-- No UPDATE policy anywhere: reviews are immutable by omission. To change one,
-- delete and re-post.
-- -----------------------------------------------------------------------------

create policy "reviews_select_public"
  on public.reviews for select
  to anon, authenticated
  using (true);

create policy "reviews_insert_own_completed_booking"
  on public.reviews for insert
  to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.guest_id = (select auth.uid())
        and b.listing_id = reviews.listing_id
        and b.status = 'confirmed'
        and b.check_out < current_date
    )
  );

create policy "reviews_delete_own_or_admin"
  on public.reviews for delete
  to authenticated
  using (reviewer_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- message_threads — strictly the two participants. Admins are NOT granted
-- access: moderating conversations is out of scope for this build.
-- -----------------------------------------------------------------------------

create policy "message_threads_select_participant"
  on public.message_threads for select
  to authenticated
  using (
    guest_id = (select auth.uid())
    or host_id = (select auth.uid())
  );

create policy "message_threads_insert_participant"
  on public.message_threads for insert
  to authenticated
  with check (
    guest_id = (select auth.uid())
    or host_id = (select auth.uid())
  );

create policy "message_threads_update_participant"
  on public.message_threads for update
  to authenticated
  using (
    guest_id = (select auth.uid())
    or host_id = (select auth.uid())
  )
  with check (
    guest_id = (select auth.uid())
    or host_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- messages
--
-- UPDATE is the RECIPIENT stamping read_at, so the policy requires the caller
-- to be a participant who is NOT the sender. (architecture.md said "own
-- message", which would let a sender mark their own outgoing message read and
-- leave the actual reader unable to — see the F02 build-journal entry.)
-- -----------------------------------------------------------------------------

create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.message_threads t
      where t.id = messages.thread_id
        and (
          t.guest_id = (select auth.uid())
          or t.host_id = (select auth.uid())
        )
    )
  );

create policy "messages_insert_own_in_thread"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.message_threads t
      where t.id = messages.thread_id
        and (
          t.guest_id = (select auth.uid())
          or t.host_id = (select auth.uid())
        )
    )
  );

create policy "messages_update_read_receipt"
  on public.messages for update
  to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.message_threads t
      where t.id = messages.thread_id
        and (
          t.guest_id = (select auth.uid())
          or t.host_id = (select auth.uid())
        )
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.message_threads t
      where t.id = messages.thread_id
        and (
          t.guest_id = (select auth.uid())
          or t.host_id = (select auth.uid())
        )
    )
  );
