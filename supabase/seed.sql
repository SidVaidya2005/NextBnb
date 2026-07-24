-- =============================================================================
-- Seed data — Feature 03
--
-- Populates the database so every screen from F05 onward renders real rows, and
-- so the E2E suite has a known fixture to assert against. Run it after the
-- migrations in supabase/migrations/:
--
--   Supabase MCP:  execute_sql with the contents of this file
--   Studio:        paste into the SQL editor and run
--
-- Verify afterwards with supabase/tests/seed-verification.sql.
--
-- -----------------------------------------------------------------------------
-- RE-RUNNABLE. The delete below removes the five sentinel users, which cascades
-- through profiles -> listings -> photos/bookings/reviews/blocks, so the whole
-- fixture is rebuilt from scratch on every run. Sentinel ids use the `b000`
-- variant; supabase/tests/schema-verification.sql uses `a000`, so the two
-- scripts can never collide. A real Google account has neither prefix and is
-- never touched.
--
-- ALL DATES ARE RELATIVE to current_date. Hard-coded dates would silently turn
-- every "upcoming" booking into a past one within months, breaking F13's cancel
-- flow and F06's availability filter with no error to notice.
--
-- !! THIS SCRIPT RUNS AS SERVICE-ROLE / postgres, WHICH BYPASSES RLS ENTIRELY !!
-- None of the rules the app relies on are enforced here: nothing stops a review
-- that has no matching booking, a host booking their own listing, or a review
-- whose listing_id disagrees with its booking's. Where a row must obey such a
-- rule, it is DERIVED from its parent (bookings select their price snapshot
-- from listings; reviews select listing_id/reviewer_id from bookings) rather
-- than hand-typed. seed-verification.sql re-asserts every one of those rules.
--
-- Demo users are fixtures, not accounts: auth is Google-only, so nobody can
-- ever sign in as them. They exist to own data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Idempotency gate
-- -----------------------------------------------------------------------------

delete from auth.users where id in (
  '00000000-0000-4000-b000-000000000001',
  '00000000-0000-4000-b000-000000000002',
  '00000000-0000-4000-b000-000000000003',
  '00000000-0000-4000-b000-000000000004',
  '00000000-0000-4000-b000-000000000005'
);

-- -----------------------------------------------------------------------------
-- Users — 2 hosts + 3 guests. handle_new_user() mints the profiles rows from
-- raw_user_meta_data. No admin: a fake user can never sign in, so /admin still
-- needs the by-hand is_admin flip on a real account after F04.
--
-- Aiko deliberately has NO avatar_url, so the UI's null-avatar fallback is
-- exercised from the first screen that renders a face.
-- -----------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-b000-000000000001', 'maya.host@nextbnb.test',
   '{"full_name":"Maya Okonkwo","avatar_url":"https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80"}'),
  ('00000000-0000-4000-b000-000000000002', 'tomas.host@nextbnb.test',
   '{"full_name":"Tomás Ferreira","avatar_url":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80"}'),
  ('00000000-0000-4000-b000-000000000003', 'priya.guest@nextbnb.test',
   '{"full_name":"Priya Raman","avatar_url":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80"}'),
  ('00000000-0000-4000-b000-000000000004', 'daniel.guest@nextbnb.test',
   '{"full_name":"Daniel Whitfield","avatar_url":"https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=256&q=80"}'),
  ('00000000-0000-4000-b000-000000000005', 'aiko.guest@nextbnb.test',
   '{"full_name":"Aiko Tanaka"}');

-- -----------------------------------------------------------------------------
-- Listings — 24 published across 8 cities + 2 drafts.
--
-- The shape of this data is deliberate: it is the fixture F06's filter panel
-- will be built against, so every filter dimension needs both matching and
-- non-matching rows. All 10 property types and all 18 amenities appear at least
-- once; prices span $45–$620; max_guests spans 2–16; a few listings carry
-- min_nights > 1; two have no cleaning fee; two have no house rules; and the
-- treehouse deliberately has no kitchen so the kitchen filter excludes something.
--
-- ids and created_at both derive from `n`, so ordering is stable and the grid
-- has a meaningful newest-first sequence instead of 26 identical timestamps.
-- -----------------------------------------------------------------------------

insert into public.listings (
  id, host_id, title, description, property_type, city, state, country,
  neighborhood, max_guests, bedrooms, beds, bathrooms, price_per_night,
  cleaning_fee, amenities, house_rules, check_in_time, check_out_time,
  min_nights, is_published, created_at
)
select
  ('20000000-0000-4000-b000-' || lpad(v.n::text, 12, '0'))::uuid,
  ('00000000-0000-4000-b000-' || lpad(v.host::text, 12, '0'))::uuid,
  v.title, v.description, v.property_type::public.property_type,
  v.city, v.state, v.country, v.neighborhood,
  v.max_guests, v.bedrooms, v.beds, v.bathrooms,
  v.price_per_night, v.cleaning_fee, v.amenities,
  v.house_rules, v.check_in_time, v.check_out_time, v.min_nights, v.is_published,
  now() - (interval '2 days' * (27 - v.n))
from (values
  -- n, host, title, description, type, city, state, country, neighborhood,
  -- guests, bedrooms, beds, baths, price, cleaning, amenities, rules, in, out, min, published
  (1, 1, 'Sunlit Alfama Loft with River Views',
   'A converted attic in the oldest quarter of Lisbon, with original beams, a wall of south-facing windows and a small terrace looking over the Tejo. Steep stairs, no lift — worth every step.'::text,
   'loft', 'Lisbon', null::text, 'Portugal', 'Alfama'::text,
   4, 1, 2, 1.0, 14500, 3500,
   array['wifi','kitchen','washer','air_conditioning','workspace','tv','smoke_alarm'],
   'No smoking. Quiet hours after 22:00 — the walls are 300 years old and thin.'::text,
   '15:00', '11:00', 2, true),

  (2, 2, 'Bright Bairro Alto Apartment',
   'One bedroom on a quiet side street, two minutes from the miradouro. Refinished pine floors, a proper kitchen, and enough soundproofing to sleep through the neighbourhood.',
   'apartment', 'Lisbon', null, 'Portugal', 'Bairro Alto',
   3, 1, 2, 1.0, 9800, 2500,
   array['wifi','kitchen','washer','tv','air_conditioning'],
   'No parties. No smoking indoors.',
   '15:00', '11:00', 1, true),

  (3, 1, 'Tiled Guesthouse in Graça',
   'A small guesthouse behind a hand-tiled facade, with breakfast left in the pantry each morning and a shaded courtyard for the afternoon.',
   'guesthouse', 'Lisbon', null, 'Portugal', 'Graça',
   2, 1, 1, 1.0, 7200, 2000,
   array['wifi','kitchen','heating','breakfast','smoke_alarm'],
   null,
   '14:00', '11:00', 1, true),

  (4, 2, 'Machiya Townhouse near Gion',
   'A restored wooden townhouse on a lane of the same. Tatami rooms, a cedar bath, and a courtyard garden barely three metres across that changes completely with the season.',
   'home', 'Kyoto', null, 'Japan', 'Higashiyama',
   5, 2, 3, 1.5, 21000, 4500,
   array['wifi','kitchen','washer','dryer','heating','tv','workspace','smoke_alarm'],
   'Shoes off at the entrance. No smoking anywhere on the property.',
   '16:00', '10:00', 2, true),

  (5, 1, 'Minimal Apartment by the Kamo River',
   'Two rooms, well ordered, with the river path directly below and Demachiyanagi station a short walk north. Bicycles included.',
   'apartment', 'Kyoto', null, 'Japan', 'Kamigyō',
   2, 1, 1, 1.0, 11500, 2500,
   array['wifi','kitchen','air_conditioning','heating','workspace'],
   'No shoes indoors. Sort recycling into the marked bins.',
   '15:00', '10:00', 1, true),

  (6, 2, 'Garden Cottage in Arashiyama',
   'A detached cottage at the quiet end of the bamboo grove, with a small maple garden and a kotatsu for winter. Far enough from the crowds to hear the river.',
   'cottage', 'Kyoto', null, 'Japan', 'Arashiyama',
   4, 2, 2, 1.0, 17800, 4000,
   array['wifi','kitchen','heating','fireplace','free_parking','smoke_alarm'],
   'No smoking. Please do not feed the monkeys.',
   '16:00', '10:00', 3, true),

  (7, 1, 'East Austin Bungalow with Yard',
   'A 1940s bungalow reworked for how people actually live: big kitchen, screened porch, and a fenced back yard with a grill and a hammock.',
   'home', 'Austin', 'Texas', 'United States', 'East Austin',
   6, 3, 3, 2.0, 19500, 5000,
   array['wifi','kitchen','washer','dryer','air_conditioning','free_parking','bbq_grill','tv','crib','smoke_alarm'],
   'No parties or events. Quiet after 22:00 — neighbours are close.',
   '15:00', '11:00', 2, true),

  (8, 2, 'Tiny Home off South Congress',
   'Two hundred square feet, used well. Sleeping loft, full kitchenette, outdoor shower, and a deck under a live oak. Walkable to everything on SoCo.',
   'tiny_home', 'Austin', 'Texas', 'United States', 'South Congress',
   2, 1, 1, 1.0, 8900, 0,
   array['wifi','kitchen','air_conditioning','free_parking','ev_charger'],
   null,
   '15:00', '11:00', 1, true),

  (9, 1, 'Warehouse Loft Downtown',
   'A working artist''s loft on the fourth floor of a converted warehouse: concrete, north light, a freight lift, and a desk you could actually finish something at.',
   'loft', 'Austin', 'Texas', 'United States', 'Downtown',
   4, 1, 2, 1.5, 16500, 4000,
   array['wifi','kitchen','washer','air_conditioning','workspace','tv','gym','smoke_alarm'],
   'No smoking. The freight lift stops running at midnight.',
   '16:00', '11:00', 2, true),

  (10, 2, 'Roma Norte Apartment with Balcony',
   'A second-floor apartment on a jacaranda-lined street, with a balcony wide enough to eat on and half of Roma Norte within ten minutes.',
   'apartment', 'Mexico City', null, 'Mexico', 'Roma Norte',
   4, 2, 2, 1.0, 10500, 2500,
   array['wifi','kitchen','washer','tv','workspace'],
   'No smoking indoors. Building gate locks at 23:00.',
   '15:00', '12:00', 1, true),

  (11, 1, 'Condesa Family Home',
   'A whole house for a group: four bedrooms around a central patio, a long dining table, and Parque México two streets away.',
   'home', 'Mexico City', null, 'Mexico', 'Condesa',
   8, 4, 5, 2.5, 27500, 7000,
   array['wifi','kitchen','washer','dryer','air_conditioning','tv','free_parking','crib','bbq_grill','smoke_alarm'],
   'No parties. Maximum 8 guests — the number on the booking is the number we expect.',
   '15:00', '11:00', 2, true),

  (12, 2, 'Artist''s Studio in Coyoacán',
   'One room and a small kitchen, filled with light from a single north window. Cheap, quiet, and five minutes from the market.',
   'other', 'Mexico City', null, 'Mexico', 'Coyoacán',
   2, 0, 1, 1.0, 4500, 0,
   array['wifi','kitchen','workspace'],
   null,
   '14:00', '11:00', 1, true),

  (13, 1, 'Turf-Roof Cabin under the Northern Lights',
   'A modern cabin with a traditional turf roof, forty minutes from the city and well outside the light pollution. Floor-to-ceiling glass facing north.',
   'cabin', 'Reykjavík', null, 'Iceland', 'Mosfellsdalur',
   4, 2, 2, 1.0, 23000, 5500,
   array['wifi','kitchen','heating','fireplace','hot_tub','free_parking','smoke_alarm'],
   'No smoking. Please rinse before using the hot tub.',
   '16:00', '11:00', 2, true),

  (14, 2, 'Central Reykjavík Apartment',
   'A warm, well-insulated flat on Laugavegur with underfloor heating and a window seat for watching the weather change every twenty minutes.',
   'apartment', 'Reykjavík', null, 'Iceland', 'Laugavegur',
   3, 1, 2, 1.0, 15900, 3500,
   array['wifi','kitchen','washer','heating','tv','workspace'],
   'No smoking. Remove outdoor shoes in the hallway.',
   '15:00', '11:00', 1, true),

  (15, 1, 'Coastal Cottage with Hot Tub',
   'On the water at Grótta, with a geothermal hot tub on the deck and nothing between you and the Atlantic. Bring layers.',
   'cottage', 'Reykjavík', null, 'Iceland', 'Seltjarnarnes',
   6, 3, 4, 2.0, 31000, 6500,
   array['wifi','kitchen','washer','dryer','heating','hot_tub','fireplace','free_parking','smoke_alarm'],
   'No smoking. Hot tub closes at 23:00 out of respect for the neighbours.',
   '16:00', '11:00', 3, true),

  (16, 2, 'Clifton Villa with Infinity Pool',
   'Built into the slope above Clifton, with an infinity pool that reads as though it runs straight into the Atlantic. Five bedrooms, each with its own bathroom.',
   'villa', 'Cape Town', 'Western Cape', 'South Africa', 'Clifton',
   10, 5, 6, 4.0, 62000, 15000,
   array['wifi','kitchen','washer','dryer','air_conditioning','pool','hot_tub','gym','tv','free_parking','bbq_grill','ev_charger','smoke_alarm'],
   'No parties or events. Pool is not fenced — children must be supervised.',
   '15:00', '10:00', 3, true),

  (17, 1, 'City Bowl Apartment with Table Mountain Views',
   'A corner flat with two full walls of window, looking straight up at the mountain. Secure parking and a five-minute walk to Kloof Street.',
   'apartment', 'Cape Town', 'Western Cape', 'South Africa', 'Gardens',
   4, 2, 2, 2.0, 13500, 3000,
   array['wifi','kitchen','washer','tv','workspace','air_conditioning'],
   'No smoking indoors. Load-shedding schedule is on the fridge.',
   '14:00', '10:00', 2, true),

  (18, 2, 'Woodstock Guesthouse',
   'A converted warehouse guesthouse sleeping up to sixteen, with a long communal kitchen, a pool in the courtyard, and the Saturday market around the corner. Built for groups.',
   'guesthouse', 'Cape Town', 'Western Cape', 'South Africa', 'Woodstock',
   16, 7, 9, 4.0, 45000, 12000,
   array['wifi','kitchen','washer','dryer','tv','free_parking','pool','bbq_grill','breakfast','crib','smoke_alarm'],
   'No parties. Groups of 10+ please message before booking.',
   '15:00', '10:00', 2, true),

  (19, 1, 'Blue Ridge Cabin with Fireplace',
   'A log cabin twenty minutes up the mountain, with a stone fireplace, a covered porch, and a hot tub facing the ridge. No neighbours in sight.',
   'cabin', 'Asheville', 'North Carolina', 'United States', 'Blue Ridge',
   6, 3, 4, 2.0, 18500, 4500,
   array['wifi','kitchen','heating','fireplace','hot_tub','free_parking','bbq_grill','smoke_alarm'],
   'No smoking indoors. Firewood is provided — please do not cut anything standing.',
   '16:00', '11:00', 2, true),

  (20, 2, 'Treehouse in the Pisgah Forest',
   'Twelve feet up a poplar, reached by a rope bridge. A wood stove, a bed under a skylight, and a composting toilet. No kitchen and no road noise.',
   'treehouse', 'Asheville', 'North Carolina', 'United States', 'Pisgah',
   2, 1, 1, 1.0, 24500, 3500,
   array['wifi','heating','fireplace'],
   'Not suitable for young children or anyone unsteady on a rope bridge. No open flame outside the stove.',
   '16:00', '11:00', 2, true),

  (21, 1, 'Craftsman House in West Asheville',
   'A restored 1920s craftsman on Haywood, with the original built-ins, a deep front porch, and room for eight without anyone sleeping on a sofa.',
   'home', 'Asheville', 'North Carolina', 'United States', 'West Asheville',
   8, 4, 5, 2.5, 22000, 5500,
   array['wifi','kitchen','washer','dryer','heating','air_conditioning','tv','free_parking','crib','workspace','smoke_alarm'],
   'No smoking. Street parking only after the second car.',
   '15:00', '11:00', 1, true),

  (22, 2, 'Lakefront Villa on Wakatipu',
   'Directly on the lake with its own jetty, six bedrooms, and the Remarkables filling every window on the south side. Minimum four nights.',
   'villa', 'Queenstown', 'Otago', 'New Zealand', 'Kelvin Heights',
   12, 6, 7, 3.5, 58000, 13000,
   array['wifi','kitchen','washer','dryer','heating','pool','hot_tub','gym','tv','free_parking','ev_charger','bbq_grill','smoke_alarm'],
   'No parties or events. Jetty use at your own risk; life jackets in the boat shed.',
   '16:00', '10:00', 4, true),

  (23, 1, 'Alpine Cabin near the Remarkables',
   'A small dark-timber cabin at the foot of the access road, built for people who intend to be out all day and warm all evening.',
   'cabin', 'Queenstown', 'Otago', 'New Zealand', 'Frankton',
   4, 2, 2, 1.0, 20500, 4000,
   array['wifi','kitchen','heating','fireplace','free_parking','smoke_alarm'],
   'No smoking. Ski gear in the drying room, not the living room.',
   '16:00', '10:00', 2, true),

  (24, 2, 'Central Queenstown Apartment',
   'A straightforward two-bedroom flat a block from the waterfront, with a balcony over the garden and the gondola in view.',
   'apartment', 'Queenstown', 'Otago', 'New Zealand', 'Town Centre',
   4, 2, 2, 1.0, 12500, 3000,
   array['wifi','kitchen','heating','tv','washer'],
   'No smoking indoors. No parties.',
   '15:00', '10:00', 1, true),

  -- Drafts: unpublished, invisible to everyone except their host and admins.
  -- Both sit in cities that already appear above, so the city list stays at 8.
  (25, 1, 'Belém Riverside Home',
   'Draft — still measuring rooms and waiting on the last of the photos.',
   'home', 'Lisbon', null, 'Portugal', 'Belém',
   5, 3, 3, 2.0, 18000, 4000,
   array['wifi','kitchen','washer','tv'],
   null,
   '15:00', '11:00', 1, false),

  (26, 2, 'Barton Creek Cottage',
   'Draft — pricing not final, and the deck needs rebuilding before anyone stays here.',
   'cottage', 'Austin', 'Texas', 'United States', 'Barton Creek',
   4, 2, 2, 1.0, 15000, 3500,
   array['wifi','kitchen','heating','free_parking'],
   null,
   '15:00', '11:00', 1, false)
) as v(
  n, host, title, description, property_type, city, state, country,
  neighborhood, max_guests, bedrooms, beds, bathrooms, price_per_night,
  cleaning_fee, amenities, house_rules, check_in_time, check_out_time,
  min_nights, is_published
);

-- -----------------------------------------------------------------------------
-- Photos — 5 per listing, 130 rows. Every URL was HEAD-checked (200) AND
-- visually reviewed before being written here: a 200 only proves a URL
-- resolves, not that the image shows a building. Three candidates that returned
-- 200 were a camera, a massage table and a business handshake.
--
-- public_id is NULL on every row: these are external Unsplash URLs that were
-- never uploaded to Cloudinary, so the delete path must skip destroy() for them.
-- Position 0 is the cover; the partial unique index enforces at most one.
-- -----------------------------------------------------------------------------

insert into public.listing_photos (listing_id, url, public_id, position, is_cover)
select
  ('20000000-0000-4000-b000-' || lpad(p.n::text, 12, '0'))::uuid,
  'https://images.unsplash.com/' || p.photo || '?auto=format&fit=crop&w=1200&q=80',
  null,
  p.position,
  p.position = 0
from (values
  -- 1 Alfama loft
  (1, 0, 'photo-1502005229762-cf1b2da7c5d6'), (1, 1, 'photo-1600210492486-724fe5c67fb0'),
  (1, 2, 'photo-1505691938895-1758d7feb511'), (1, 3, 'photo-1560185893-a55cbc8c57e8'),
  (1, 4, 'photo-1484154218962-a197022b5858'),
  -- 2 Bairro Alto apartment
  (2, 0, 'photo-1574362848149-11496d93a7c7'), (2, 1, 'photo-1502672260266-1c1ef2d93688'),
  (2, 2, 'photo-1567767292278-a4f21aa2d36e'), (2, 3, 'photo-1522771739844-6a9f6d5f14af'),
  (2, 4, 'photo-1556911220-bff31c812dba'),
  -- 3 Graça guesthouse
  (3, 0, 'photo-1583608205776-bfd35f0d9f83'), (3, 1, 'photo-1586023492125-27b2c045efd7'),
  (3, 2, 'photo-1519643381401-22c77e60520e'), (3, 3, 'photo-1512918728675-ed5a9ecdebfd'),
  (3, 4, 'photo-1556909212-d5b604d0c90d'),
  -- 4 Kyoto machiya
  (4, 0, 'photo-1600566753190-17f0baa2a6c3'), (4, 1, 'photo-1533779283484-8ad4940aa3a8'),
  (4, 2, 'photo-1611892440504-42a792e24d32'), (4, 3, 'photo-1595526114035-0d45ed16cfbf'),
  (4, 4, 'photo-1600489000022-c2086d79f9d4'),
  -- 5 Kamo River apartment
  (5, 0, 'photo-1512915922686-57c11dde9b6b'), (5, 1, 'photo-1551105378-78e609e1d468'),
  (5, 2, 'photo-1513694203232-719a280e022f'), (5, 3, 'photo-1531835551805-16d864c8d311'),
  (5, 4, 'photo-1507089947368-19c1da9775ae'),
  -- 6 Arashiyama cottage
  (6, 0, 'photo-1572120360610-d971b9d7767c'), (6, 1, 'photo-1590490360182-c33d57733427'),
  (6, 2, 'photo-1524758631624-e2822e304c36'), (6, 3, 'photo-1615874959474-d609969a20ed'),
  (6, 4, 'photo-1584622650111-993a426fbf0a'),
  -- 7 East Austin bungalow
  (7, 0, 'photo-1605276374104-dee2a0ed3cd6'), (7, 1, 'photo-1600566753086-00f18fb6b3ea'),
  (7, 2, 'photo-1554995207-c18c203602cb'), (7, 3, 'photo-1540518614846-7eded433c457'),
  (7, 4, 'photo-1484154218962-a197022b5858'),
  -- 8 SoCo tiny home
  (8, 0, 'photo-1518780664697-55e3ad937233'), (8, 1, 'photo-1502005097973-6a7082348e28'),
  (8, 2, 'photo-1551105378-78e609e1d468'), (8, 3, 'photo-1513694203232-719a280e022f'),
  (8, 4, 'photo-1584622650111-993a426fbf0a'),
  -- 9 Downtown warehouse loft
  (9, 0, 'photo-1536376072261-38c75010e6c9'), (9, 1, 'photo-1522156373667-4c7234bbd804'),
  (9, 2, 'photo-1600121848594-d8644e57abab'), (9, 3, 'photo-1631049307264-da0ec9d70304'),
  (9, 4, 'photo-1507089947368-19c1da9775ae'),
  -- 10 Roma Norte apartment
  (10, 0, 'photo-1600047509807-ba8f99d2cdde'), (10, 1, 'photo-1526057565006-20beab8dd2ed'),
  (10, 2, 'photo-1594563703937-fdc640497dcd'), (10, 3, 'photo-1522771739844-6a9f6d5f14af'),
  (10, 4, 'photo-1524758631624-e2822e304c36'),
  -- 11 Condesa family home
  (11, 0, 'photo-1523217582562-09d0def993a6'), (11, 1, 'photo-1554995207-c18c203602cb'),
  (11, 2, 'photo-1618221195710-dd6b41faaea6'), (11, 3, 'photo-1505693416388-ac5ce068fe85'),
  (11, 4, 'photo-1556911220-bff31c812dba'),
  -- 12 Coyoacán studio
  (12, 0, 'photo-1486304873000-235643847519'), (12, 1, 'photo-1586023492125-27b2c045efd7'),
  (12, 2, 'photo-1513694203232-719a280e022f'), (12, 3, 'photo-1551105378-78e609e1d468'),
  (12, 4, 'photo-1584622650111-993a426fbf0a'),
  -- 13 Turf-roof cabin
  (13, 0, 'photo-1510798831971-661eb04b3739'), (13, 1, 'photo-1533779283484-8ad4940aa3a8'),
  (13, 2, 'photo-1598928506311-c55ded91a20c'), (13, 3, 'photo-1560185893-a55cbc8c57e8'),
  (13, 4, 'photo-1556909212-d5b604d0c90d'),
  -- 14 Central Reykjavík apartment
  (14, 0, 'photo-1600585154340-be6161a56a0c'), (14, 1, 'photo-1503174971373-b1f69850bded'),
  (14, 2, 'photo-1523755231516-e43fd2e8dca5'), (14, 3, 'photo-1531835551805-16d864c8d311'),
  (14, 4, 'photo-1600489000022-c2086d79f9d4'),
  -- 15 Grótta coastal cottage
  (15, 0, 'photo-1570129477492-45c003edd2be'), (15, 1, 'photo-1590490360182-c33d57733427'),
  (15, 2, 'photo-1617104678098-de229db51175'), (15, 3, 'photo-1598928506311-c55ded91a20c'),
  (15, 4, 'photo-1507089947368-19c1da9775ae'),
  -- 16 Clifton villa
  (16, 0, 'photo-1580587771525-78b9dba3b914'), (16, 1, 'photo-1512917774080-9991f1c4c750'),
  (16, 2, 'photo-1618221195710-dd6b41faaea6'), (16, 3, 'photo-1505693416388-ac5ce068fe85'),
  (16, 4, 'photo-1584622650111-993a426fbf0a'),
  -- 17 City Bowl apartment
  (17, 0, 'photo-1600573472550-8090b5e0745e'), (17, 1, 'photo-1501876725168-00c445821c9e'),
  (17, 2, 'photo-1505691938895-1758d7feb511'), (17, 3, 'photo-1616594039964-ae9021a400a0'),
  (17, 4, 'photo-1484154218962-a197022b5858'),
  -- 18 Woodstock guesthouse
  (18, 0, 'photo-1564013799919-ab600027ffc6'), (18, 1, 'photo-1522156373667-4c7234bbd804'),
  (18, 2, 'photo-1555854877-bab0e564b8d5'), (18, 3, 'photo-1540518614846-7eded433c457'),
  (18, 4, 'photo-1556911220-bff31c812dba'),
  -- 19 Blue Ridge cabin
  (19, 0, 'photo-1568605114967-8130f3a36994'), (19, 1, 'photo-1493809842364-78817add7ffb'),
  (19, 2, 'photo-1611892440504-42a792e24d32'), (19, 3, 'photo-1631049307264-da0ec9d70304'),
  (19, 4, 'photo-1600489000022-c2086d79f9d4'),
  -- 20 Pisgah treehouse
  (20, 0, 'photo-1449158743715-0a90ebb6d2d8'), (20, 1, 'photo-1470770841072-f978cf4d019e'),
  (20, 2, 'photo-1596394516093-501ba68a0ba6'), (20, 3, 'photo-1512918728675-ed5a9ecdebfd'),
  (20, 4, 'photo-1556909212-d5b604d0c90d'),
  -- 21 West Asheville craftsman
  (21, 0, 'photo-1475855581690-80accde3ae2b'), (21, 1, 'photo-1600607687939-ce8a6c25118c'),
  (21, 2, 'photo-1616486338812-3dadae4b4ace'), (21, 3, 'photo-1560448205-4d9b3e6bb6db'),
  (21, 4, 'photo-1507089947368-19c1da9775ae'),
  -- 22 Wakatipu lakefront villa
  (22, 0, 'photo-1509600110300-21b9d5fedeb7'), (22, 1, 'photo-1543489822-c49534f3271f'),
  (22, 2, 'photo-1560448204-e02f11c3d0e2'), (22, 3, 'photo-1505693416388-ac5ce068fe85'),
  (22, 4, 'photo-1556911220-bff31c812dba'),
  -- 23 Remarkables alpine cabin
  (23, 0, 'photo-1600585154526-990dced4db0d'), (23, 1, 'photo-1598928506311-c55ded91a20c'),
  (23, 2, 'photo-1590490360182-c33d57733427'), (23, 3, 'photo-1531835551805-16d864c8d311'),
  (23, 4, 'photo-1600489000022-c2086d79f9d4'),
  -- 24 Central Queenstown apartment
  (24, 0, 'photo-1582268611958-ebfd161ef9cf'), (24, 1, 'photo-1522708323590-d24dbb6b0267'),
  (24, 2, 'photo-1523755231516-e43fd2e8dca5'), (24, 3, 'photo-1616594039964-ae9021a400a0'),
  (24, 4, 'photo-1484154218962-a197022b5858'),
  -- 25 draft, Belém
  (25, 0, 'photo-1512917774080-9991f1c4c750'), (25, 1, 'photo-1600607687920-4e2a09cf159d'),
  (25, 2, 'photo-1600121848594-d8644e57abab'), (25, 3, 'photo-1595526114035-0d45ed16cfbf'),
  (25, 4, 'photo-1556909212-d5b604d0c90d'),
  -- 26 draft, Barton Creek
  (26, 0, 'photo-1600596542815-ffad4c1539a9'), (26, 1, 'photo-1560185007-cde436f6a4d0'),
  (26, 2, 'photo-1541123437800-1bb1317badc2'), (26, 3, 'photo-1631049307264-da0ec9d70304'),
  (26, 4, 'photo-1507089947368-19c1da9775ae')
) as p(n, position, photo);

-- -----------------------------------------------------------------------------
-- Bookings — 17 rows covering every temporal state the app distinguishes:
-- 8 past-completed (reviewable), 6 upcoming (cancellable), 1 in-progress,
-- 2 cancelled. Because the dates are relative, that spread survives every
-- re-run; seed-verification asserts all four states still exist.
--
-- The price snapshot is SELECTED FROM THE LISTING rather than typed in, so
-- nights/price/cleaning/service/total cannot disagree with the listing they
-- came from. The 0.14 rate mirrors SERVICE_FEE_PCT in src/lib/constants.ts —
-- duplicated deliberately: these are snapshots, and a future rate change must
-- NOT retroactively alter historical bookings. round() on numeric is half-up.
--
-- Booking 17 deliberately OVERLAPS cancelled booking 16 on the same listing,
-- proving in live data that the `where status = 'confirmed'` clause on the
-- exclusion constraint really does free a cancelled booking's dates.
-- -----------------------------------------------------------------------------

insert into public.bookings (
  id, listing_id, guest_id, check_in, check_out, guests_count,
  nights, price_per_night, cleaning_fee, service_fee, total, status,
  created_at, cancelled_at
)
select
  ('30000000-0000-4000-b000-' || lpad(b.n::text, 12, '0'))::uuid,
  l.id,
  ('00000000-0000-4000-b000-' || lpad(b.guest::text, 12, '0'))::uuid,
  b.check_in,
  b.check_out,
  b.guests_count,
  (b.check_out - b.check_in),
  l.price_per_night,
  l.cleaning_fee,
  round((b.check_out - b.check_in) * l.price_per_night * 0.14)::int,
  (b.check_out - b.check_in) * l.price_per_night
    + l.cleaning_fee
    + round((b.check_out - b.check_in) * l.price_per_night * 0.14)::int,
  b.status::public.booking_status,
  b.check_in - interval '21 days',
  b.cancelled_at
from (values
  -- PAST, completed -> these are what makes reviews possible
  (1,  1,  3, current_date - 40, current_date - 35, 2, 'confirmed', null::timestamptz),
  (2,  1,  4, current_date - 22, current_date - 18, 3, 'confirmed', null),
  (3,  19, 5, current_date - 50, current_date - 44, 4, 'confirmed', null),
  (4,  19, 3, current_date - 30, current_date - 27, 2, 'confirmed', null),
  (5,  16, 4, current_date - 60, current_date - 53, 6, 'confirmed', null),
  (6,  16, 5, current_date - 25, current_date - 21, 4, 'confirmed', null),
  (7,  4,  3, current_date - 18, current_date - 14, 2, 'confirmed', null),
  (8,  7,  4, current_date - 12, current_date - 9,  4, 'confirmed', null),
  -- UPCOMING -> consume availability in F06/F12, cancellable in F13
  (9,  22, 3, current_date + 12, current_date + 17, 8, 'confirmed', null),
  (10, 13, 4, current_date + 20, current_date + 24, 2, 'confirmed', null),
  (11, 11, 5, current_date + 14, current_date + 18, 5, 'confirmed', null),
  (12, 2,  3, current_date + 30, current_date + 33, 2, 'confirmed', null),
  (13, 20, 4, current_date + 45, current_date + 48, 2, 'confirmed', null),
  -- IN PROGRESS -> check_in has passed but check_out has not
  (14, 17, 5, current_date - 2,  current_date + 3,  2, 'confirmed', null),
  -- CANCELLED -> dates are freed
  (15, 5,  4, current_date - 35, current_date - 30, 2, 'cancelled', now() - interval '38 days'),
  (16, 9,  3, current_date + 12, current_date + 16, 2, 'cancelled', now() - interval '3 days'),
  -- Overlaps #16 on listing 9 on purpose: proves cancelled dates are bookable
  (17, 9,  5, current_date + 13, current_date + 18, 3, 'confirmed', null)
) as b(n, listing, guest, check_in, check_out, guests_count, status, cancelled_at)
join public.listings l
  on l.id = ('20000000-0000-4000-b000-' || lpad(b.listing::text, 12, '0'))::uuid;

-- -----------------------------------------------------------------------------
-- Reviews — 7, one per past confirmed booking except #8, which is left
-- unreviewed on purpose (a real inbox always has one outstanding).
--
-- listing_id and reviewer_id are SELECTED FROM THE BOOKING, never typed, so a
-- review can not end up attributed to the wrong stay or the wrong person —
-- the exact incoherence RLS would have caught for a real user but does not here.
-- Listings 1, 19 and 16 each collect two reviews from different guests; the
-- other 21 listings have none, so F05 must render the no-rating state.
-- -----------------------------------------------------------------------------

insert into public.reviews (listing_id, booking_id, reviewer_id, rating, comment, created_at)
select
  bk.listing_id,
  bk.id,
  bk.guest_id,
  r.rating,
  r.comment,
  (bk.check_out + interval '1 day')::timestamptz
from (values
  (1, 5, 'Worth the stairs. We ate breakfast on the terrace every morning and watched the ferries. Maya left a map with her own notes on it.'),
  (2, 4, 'Lovely space and a great location. The stairs are no joke with luggage — pack light and you will be fine.'),
  (3, 5, 'Woke up to fog in the valley twice. The fireplace works properly and there is enough wood. We stayed in most evenings and did not regret it.'),
  (4, 4, 'Very peaceful, exactly as described. The road up is steep — a normal car managed it fine in dry weather.'),
  (5, 5, 'The pool is every bit as good as the photos suggest. Six of us and nobody felt on top of anybody else.'),
  (6, 3, 'Beautiful house and a great position, but the load-shedding hit us harder than expected and the wifi went with it. Worth knowing before you book if you plan to work.'),
  (7, 4, 'The courtyard garden is tiny and completely charming. Slightly cold in the mornings — the tatami rooms are not heated.')
) as r(booking, rating, comment)
join public.bookings bk
  on bk.id = ('30000000-0000-4000-b000-' || lpad(r.booking::text, 12, '0'))::uuid;

-- -----------------------------------------------------------------------------
-- Blocked dates — host-set unavailability, INCLUSIVE [start_date, end_date].
--
-- None of these overlaps a confirmed booking on the same listing: F11 forbids a
-- host from blocking over a reservation, and seeded data must not contradict a
-- rule the app enforces. seed-verification checks this by converting each block
-- to the half-open daterange(start, end + 1, '[)') that bookings use.
-- -----------------------------------------------------------------------------

insert into public.blocked_dates (listing_id, start_date, end_date)
select
  ('20000000-0000-4000-b000-' || lpad(d.n::text, 12, '0'))::uuid,
  d.start_date,
  d.end_date
from (values
  (1,  current_date + 50, current_date + 55),
  (16, current_date + 5,  current_date + 9),
  (22, current_date + 25, current_date + 30),
  (13, current_date + 35, current_date + 40),
  (19, current_date + 60, current_date + 70)
) as d(n, start_date, end_date);

-- =============================================================================
-- Optional: adopt the demo data into your own account
--
-- Not executed by this script. After signing in with Google (F04), the Host and
-- Trips pages will be empty because everything above belongs to demo users.
-- To take ownership of one host's listings, find your id and reassign:
--
--   select id, full_name from public.profiles where full_name = 'Your Name';
--
--   update public.listings
--      set host_id = '<your-profile-id>'
--    where host_id = '00000000-0000-4000-b000-000000000001';
--
-- Re-running this seed reverts it. Note that bookings on those listings stay
-- with their original guests, which is what you want: you become the host who
-- receives them, and /host/reservations fills up.
-- =============================================================================
