-- =============================================================================
-- 0006 — Lock the remaining "none" cells in the RLS matrix
--
-- Found by supabase/tests/schema-verification.sql: an UPDATE against a table
-- with RLS enabled but NO update policy is not an error. It matches zero rows
-- and reports success. Immutability held, but silently — a caller (and a test)
-- cannot tell "refused" from "applied".
--
-- 0003 already took the explicit route for the DELETE cells the matrix marks
-- "none". This finishes the job for the two UPDATE cells, and drops anon to
-- read-only across the board.
-- =============================================================================

-- reviews are immutable once posted: to change one, delete and re-post.
revoke update on public.reviews from anon, authenticated;

-- a favorite is created or removed, never edited.
revoke update on public.favorites from anon, authenticated;

-- A signed-out visitor browses; they never write. Every write policy in 0003 is
-- scoped `to authenticated`, so this is already true — making it a privilege
-- error as well means a bug in that scoping cannot quietly become a data path.
revoke insert, update, delete on public.profiles        from anon;
revoke insert, update, delete on public.listings        from anon;
revoke insert, update, delete on public.listing_photos  from anon;
revoke insert, update, delete on public.bookings        from anon;
revoke insert, update, delete on public.blocked_dates   from anon;
revoke insert, update, delete on public.favorites       from anon;
revoke insert, update, delete on public.reviews         from anon;
revoke insert, update, delete on public.message_threads from anon;
revoke insert, update, delete on public.messages        from anon;
