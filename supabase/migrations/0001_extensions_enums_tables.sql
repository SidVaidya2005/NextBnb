-- =============================================================================
-- 0001 — Extensions, enums, tables, constraints, indexes
--
-- The full NextBnb data model (context/architecture.md → Data Model). RLS is
-- enabled separately in 0003; this file is structure only.
--
-- Money is ALWAYS an integer number of cents. Booking ranges are half-open
-- [check_in, check_out); blocked_dates ranges are inclusive [start_date, end_date].
-- =============================================================================

-- Required for the bookings exclusion constraint: gist needs btree_gist to
-- index `listing_id with =` (plain equality on uuid) alongside a range operator.
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums — must stay in sync with src/lib/constants.ts
-- -----------------------------------------------------------------------------

create type public.property_type as enum (
  'home',
  'apartment',
  'villa',
  'cabin',
  'cottage',
  'loft',
  'guesthouse',
  'tiny_home',
  'treehouse',
  'other'
);

create type public.booking_status as enum ('confirmed', 'cancelled');

-- -----------------------------------------------------------------------------
-- profiles — mirrors auth.users, populated by the trigger in 0002.
--
-- Deliberately has NO email column: this table is publicly readable (host names
-- and reviewer names appear on public listing pages), so an email here would
-- expose every user's address. Email stays in auth.users and is reachable only
-- via admin_list_users() (0002).
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  property_type public.property_type not null,
  city text not null check (length(trim(city)) > 0),
  state text,
  country text not null check (length(trim(country)) > 0),
  neighborhood text,
  -- Upper bound mirrors MAX_GUESTS in src/lib/constants.ts.
  max_guests int not null check (max_guests between 1 and 16),
  bedrooms int not null default 0 check (bedrooms >= 0),
  beds int not null default 1 check (beds >= 1),
  bathrooms numeric(3, 1) not null default 1 check (bathrooms >= 0),
  price_per_night int not null check (price_per_night > 0),
  cleaning_fee int not null default 0 check (cleaning_fee >= 0),
  amenities text[] not null default '{}',
  house_rules text,
  check_in_time text default '15:00',
  check_out_time text default '11:00',
  min_nights int not null default 1 check (min_nights >= 1),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Keeps the column honest against AMENITIES in src/lib/constants.ts. `<@` is
  -- "is contained by", so any value outside the list rejects the whole row.
  constraint listings_amenities_known check (
    amenities <@ array[
      'wifi', 'kitchen', 'washer', 'dryer', 'air_conditioning', 'heating',
      'workspace', 'tv', 'free_parking', 'pool', 'hot_tub', 'ev_charger',
      'crib', 'gym', 'bbq_grill', 'breakfast', 'fireplace', 'smoke_alarm'
    ]::text[]
  )
);

-- -----------------------------------------------------------------------------
-- listing_photos
--
-- public_id is null for seed/Unsplash rows (external URLs never uploaded to
-- Cloudinary); delete actions skip cloudinary.destroy() for those.
-- -----------------------------------------------------------------------------

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  url text not null,
  public_id text,
  position int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one cover per listing. "Exactly one" is guaranteed by the write path
-- (createListing always marks the first photo) — enforcing it here would need a
-- deferred constraint trigger that fires on every cascade delete.
create unique index listing_photos_one_cover_idx
  on public.listing_photos (listing_id)
  where is_cover;

-- -----------------------------------------------------------------------------
-- bookings
--
-- Price fields are SNAPSHOTS taken at booking time and never recomputed from
-- the listing afterwards. "Completed" is derived (confirmed + check_out past),
-- never stored.
-- -----------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  guest_id uuid not null references public.profiles (id) on delete cascade,
  check_in date not null,
  check_out date not null,
  guests_count int not null default 1 check (guests_count between 1 and 16),
  nights int not null check (nights > 0),
  price_per_night int not null check (price_per_night >= 0),
  cleaning_fee int not null default 0 check (cleaning_fee >= 0),
  service_fee int not null check (service_fee >= 0),
  total int not null check (total >= 0),
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint bookings_checkout_after_checkin check (check_out > check_in),
  -- THE anti-double-booking guard. Half-open '[)' means a stay ending Aug 5 and
  -- one starting Aug 5 do not conflict — same-day turnover is legal. The WHERE
  -- clause is what lets a cancelled booking free its dates.
  constraint bookings_no_overlap exclude using gist (
    listing_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status = 'confirmed')
);

-- -----------------------------------------------------------------------------
-- blocked_dates — host-set unavailability, INCLUSIVE [start_date, end_date].
--
-- Note the deliberate asymmetry with bookings: converting a block for overlap
-- math means daterange(start_date, end_date + 1, '[)').
-- -----------------------------------------------------------------------------

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint blocked_dates_end_after_start check (end_date >= start_date)
);

-- -----------------------------------------------------------------------------
-- favorites — composite PK, no surrogate id (a user favorites a listing once).
-- -----------------------------------------------------------------------------

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- -----------------------------------------------------------------------------
-- reviews — one per booking, immutable once posted (no UPDATE policy in 0003).
-- -----------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- message_threads
-- -----------------------------------------------------------------------------

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  guest_id uuid not null references public.profiles (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint message_threads_participants_differ check (guest_id <> host_id),
  -- NULLS NOT DISTINCT (PG15+) is required: a plain UNIQUE treats every NULL as
  -- distinct, so listing-less threads between the same two people would
  -- duplicate without limit.
  constraint message_threads_unique_participants
    unique nulls not distinct (guest_id, host_id, listing_id)
);

-- -----------------------------------------------------------------------------
-- messages — Realtime is enabled on this table only (0004).
-- -----------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
--
-- Postgres does NOT index foreign keys automatically, and the RLS policies in
-- 0003 traverse these FKs in EXISTS subqueries on every row — so every FK
-- column is indexed. The listings columns additionally back Feature 06 search.
-- -----------------------------------------------------------------------------

create index listings_host_id_idx on public.listings (host_id);
create index listings_city_idx on public.listings (city);
create index listings_property_type_idx on public.listings (property_type);
create index listings_price_per_night_idx on public.listings (price_per_night);
create index listings_published_created_idx
  on public.listings (created_at desc)
  where is_published;

create index listing_photos_listing_id_idx on public.listing_photos (listing_id);

create index bookings_listing_id_idx on public.bookings (listing_id);
create index bookings_guest_id_idx on public.bookings (guest_id);

create index blocked_dates_listing_id_idx on public.blocked_dates (listing_id);

create index favorites_listing_id_idx on public.favorites (listing_id);

create index reviews_listing_id_idx on public.reviews (listing_id);
create index reviews_reviewer_id_idx on public.reviews (reviewer_id);

create index message_threads_guest_id_idx on public.message_threads (guest_id);
create index message_threads_host_id_idx on public.message_threads (host_id);
create index message_threads_listing_id_idx on public.message_threads (listing_id);
create index message_threads_last_message_idx
  on public.message_threads (last_message_at desc);

create index messages_thread_created_idx
  on public.messages (thread_id, created_at desc);
create index messages_sender_id_idx on public.messages (sender_id);
