-- =============================================================================
-- 0004 — Realtime
--
-- Live delivery is needed for exactly one surface: the messaging thread view
-- (Feature 16), which subscribes to INSERTs filtered by thread_id. Every other
-- screen is server-rendered and revalidated after a mutation, so adding more
-- tables to the publication would ship change events nobody listens for.
--
-- Realtime respects RLS per subscriber: a client only receives message rows it
-- could have SELECTed, which the messages_select_participant policy (0003)
-- restricts to the thread's two participants.
--
-- No Supabase Storage buckets are created anywhere in this project — all images
-- live in Cloudinary (context/architecture.md → Image Storage & Delivery).
-- =============================================================================

alter publication supabase_realtime add table public.messages;
