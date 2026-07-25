# Build Plan

> **Role:** The ordered plan — phases and numbered features to build, in sequence.
> **Read before starting a feature**; build one feature fully before the next.
> **Relates to:** features come from `project-overview.md`; status tracked in `progress-tracker.md`.

## Core Principle

Build **foundation-first, then UI-with-real-data, then interaction**. Get the
schema, RLS, auth, and seed data solid before any screen, so every page renders
against real Supabase rows from day one. Within a feature, prefer the shape a
user sees (page + states) wired to real queries, then layer the mutating actions.
Every feature ends **verifiable** — you can sign in, click through it, see the
database change, **and its unit tests (plus any relevant E2E flow) pass** (see
`code-standards.md` → Testing). Do not start a feature until the one before it
works end to end. Every screen is built to the `context/DESIGN.md` system from the
start (tokens in `globals.css @theme`) and verified responsive at all four
breakpoints — design is not deferred to a final pass.

---

## Phase 1 — Foundation

### 01 Project scaffold, design tokens & integrations

Stand up the Next.js app, encode the design system, and wire Supabase +
Cloudinary so everything after this has a runtime and a look.

**UI:**
- Root layout with the Inter font (`next/font`) and a nav shell built to the DESIGN.md `top-nav` spec.

**Logic:**
- Initialize Next.js 16 + TypeScript (strict, ≥5.1) + Tailwind v4 on Node ≥20.9; configure the `@/` → `src/*` path alias.
- Encode DESIGN.md tokens (colors, radii, spacing) and the custom breakpoints (`tablet`/`desktop`/`wide`) in `globals.css` `@theme`.
- Add `src/lib/supabase/{server,client,middleware}.ts` and `src/middleware.ts` (route protection) per `architecture.md` Key Patterns.
- Add `src/lib/cloudinary.ts` and the `/api/sign-cloudinary` route.
- Create `.env.example` + `.env.local` with all seven env vars; add `src/lib/constants.ts` and `src/lib/utils.ts` (`ActionResult`, `formatPrice`, `nightsBetween`).
- Pin the runtime: `.nvmrc` (`20`) + `"engines": { "node": ">=20.9" }`; scaffold Vitest + Playwright configs and the `test` / `test:e2e` scripts.

### 02 Database schema & RLS

Create the full data model and lock down access before any data flows.

**Logic:**
- Migration: `property_type` and `booking_status` enums; tables `profiles`, `listings`, `listing_photos`, `bookings`, `blocked_dates`, `favorites`, `reviews`, `message_threads`, `messages`.
- Constraints: `check_out > check_in`, review `rating` 1–5, unique `reviews.booking_id`, and the `btree_gist` exclusion constraint preventing overlapping `confirmed` bookings per listing (`daterange(check_in, check_out, '[)')`).
- Trigger on `auth.users` insert → create `profiles` row (no email column — email stays in `auth.users`); `is_admin()` and `admin_list_users()` `security definer` helpers.
- `admin_list_users()` must be `security definer` **with a fixed `search_path` (e.g. `set search_path = ''`, fully qualifying `auth.users`/`public.profiles`)**, and must **check `is_admin()` internally and raise/return empty otherwise** before reading `auth.users` — because a definer function bypasses RLS, the guard has to live inside it. `revoke execute ... from public/anon`; grant only to `authenticated`, so the internal `is_admin()` check is the real gate.
- RLS policies on **every** table per the per-table matrix in `architecture.md` (published-vs-owner listing visibility, participant-only messages/threads, no self-booking, one-review-per-booking, admin gate).
- Enable Supabase Realtime on `messages` only. **No Supabase Storage buckets** — images go to Cloudinary (Features 01 + 09).
- Generate `src/types/database.types.ts`.

### 03 Seed data

Populate the database so search and every screen have something to show.

**Logic:**
- `supabase/seed.sql` (or a service-role script): 2 demo users (a host and a guest), ~20–30 published listings across varied cities, property types, prices, and amenities, plus a few sample bookings and reviews.
- Photos are curated direct `images.unsplash.com/photo-…` URLs written to `listing_photos.url` with `public_id = null` (no Cloudinary upload for seeds).

### 04 Google authentication

Let users sign in and enforce protected routes.

**UI:**
- "Sign in with Google" action in the nav; avatar menu with sign out when signed in.
- Signed-out redirect handling with `?signin=required&next=…` and an error toast on `?signin=error`.

**Logic:**
- `signInWithOAuth({ provider:'google' })` from a **server action** (`lib/actions/auth.ts`, `skipBrowserRedirect` + `redirect(data.url)`); `/auth/callback/route.ts` exchanging the code and redirecting to `safeNextPath(next)`.
- `src/proxy.ts` (Next 16's rename of `middleware`) guards `/trips`, `/favorites`, `/messages`, `/host/**`, `/admin/**`; sign-out action.

**As built (deviations worth knowing):**
- Placeholder pages ship for all six protected routes, and `/admin`'s `is_admin` route gate was pulled forward from **F17** — so nothing in the account menu leads to a 404. F17 inherits that guard instead of building it.
- `signInWithGoogle` / `signOut` return `void`, not `ActionResult` — the documented exception for actions whose only outcome is navigation.
- `safeNextPath` (`lib/utils.ts`) sanitizes every post-auth redirect target; a bare `startsWith('/')` check still admits `//evil.com`.
- E2E signs in via the email/password provider (`e2e/auth.setup.ts`) because Google consent cannot be automated; the fixture unlocks signed-in specs for F08 onward.

---

## Phase 2 — Browse & Discover

### 05 Home & listing grid

The primary discovery surface rendered from real listings.

**UI:**
- Responsive grid of `ListingCard`s (cover photo, title, city, price/night, average rating); loading and empty states.

**Logic:**
- `queries/listings.getPublishedListings`; compute average rating from nested `reviews`; resolve cover photo public URL.

**As built (deviations worth knowing):**
- Photos render through **`next/image`**, not `CldImage` — every seed photo is an
  external Unsplash URL with `public_id = null`, so `next-cloudinary` stays uninstalled
  until **F09** adds the `public_id ? CldImage : Image` branch with the first real upload.
- Aggregation is **pure application code** (`averageRating` / `coverPhotoOf` in
  `lib/utils.ts`), not a view or RPC — F05 ships no migration. `averageRating` returns
  `null`, never `0`, for an unreviewed listing; that is the "New" signal.
- The grid streams behind a **`<Suspense>` boundary**, not a route `loading.tsx`, so the
  sign-in banner and heading paint immediately for a proxy-redirected user.
- `getPublishedListings()` takes **no arguments**; F06 adds the filters parameter.
- **`/listings/[id]` shipped as a placeholder** (F04's precedent) so no card is a dead
  end. F07 replaces the file wholesale.
- `app/error.tsx` was added here, since `/` became the first data-backed route.

### 06 Search & filters

Filter the grid by every supported dimension, with the URL as source of truth.

**UI:**
- `SearchBar` (destination, check-in/check-out, guests) and a filter panel (price range, property type, amenities).

**Logic:**
- Read filters from `searchParams`; extend the listings query (`ilike` city, price bounds, `max_guests`, `property_type`, `amenities` contains) and exclude listings unavailable for the chosen dates (overlapping `confirmed` bookings ∪ `blocked_dates`).

**As built (deviations worth knowing):**
- **The date filter is a `security definer` RPC (`0007`), not application code.** RLS
  scopes `bookings` to the guest/host/admin, so an anon visitor reads zero booking rows
  and an app-side check would report the whole catalogue as available. `unavailable_listing_ids()`
  returns published listing ids only. See `architecture.md` → Availability Rules.
- **`min_nights` is part of the date filter**: a stay shorter than a listing's minimum is
  excluded, so search never offers something F12 would refuse to book.
- **URL contract is camelCase with price in whole dollars** (`?city=…&checkIn=…&minPrice=50`);
  dollars→cents conversion happens once, in `lib/validations/listings.ts`. Amenities are
  accepted both comma-separated and as repeated params, so the filter form works without JS.
- **A half-specified date range filters nothing.** `parseListingFilters` only emits a `stay`
  when both dates are valid and ordered — the availability filter cannot be half-applied.
- **The full `date-picker-day` calendar shipped here**, not in F12, with an
  `unavailableRanges` prop F06 leaves empty and F12 fills per listing.
- **The SearchBar replaced the nav placeholder on every route** and is the first client
  component in the nav that reads `useSearchParams()` (layouts do not receive `searchParams`).
- **Zod arrived here** (deferred from F01) — and it is **Zod 4**, whose ISO-date API differs
  from the v3 snippets in `library-docs.md`.
- The filter panel is a **Server Component**: a native `<details>` + `<form method="get">`,
  no JavaScript. It shows no result count, because that would force the page to await the
  query and break F05's streaming shell.

### 07 Listing detail

The full listing page a guest inspects before booking.

**UI:**
- Photo gallery, title/location, description, amenities, house rules, capacity, host info, reviews list with average, and the booking widget shell.

**Logic:**
- `queries/listings.getListingById` with photos, host profile, and reviews; 404 for unpublished listings viewed by non-owners.

### 08 Favorites

Let users save and revisit listings.

**UI:**
- Heart toggle on cards and the detail page; `/favorites` page listing saved stays; empty state.

**Logic:**
- `actions/favorites.toggleFavorite` (auth-guarded, upsert/delete on `favorites`); `queries/favorites.getFavorites`; `revalidatePath('/favorites')`.

---

## Phase 3 — Hosting

### 09 Create listing

Let a user publish a new listing with photos.

**UI:**
- `/host/listings/new` multi-section form (details, location, capacity, pricing, amenities, house rules) with `CldUploadWidget` photo upload + reorderable preview; save-as-draft vs publish.

**Logic:**
- `createListingSchema` (Zod) + react-hook-form; photos upload to Cloudinary via the signed widget; `actions/listings.createListing` inserts the listing + `listing_photos` (`url` + `public_id`), sets one cover.

### 10 Manage listings

Let a host maintain their existing listings.

**UI:**
- `/host/listings` grid of own listings (published + drafts) with edit, publish/unpublish, delete; `/host/listings/[id]/edit` reusing the form.

**Logic:**
- `queries/listings.getOwnListings`; `actions/listings.updateListing`, `setPublished`, `deleteListing` (also `destroy`s each photo's Cloudinary asset where `public_id` is set); ownership enforced by RLS.

### 11 Availability management

Let a host block dates their listing isn't available.

**UI:**
- Availability section on the listing editor: add/remove blocked date ranges; visual calendar of blocked + booked dates (read-only for booked).

**Logic:**
- `actions/blockedDates.addBlock` / `removeBlock` (owner-scoped; block ranges are inclusive `[start, end]`; **reject a range overlapping any confirmed booking**); blocked ranges feed the same availability check used by search and booking (see `architecture.md` → Availability Rules).

---

## Phase 4 — Booking

### 12 Instant Book

The core booking flow: pick dates, see the price, reserve.

**UI:**
- Booking widget on the listing page: date-range picker disabling unavailable dates, guest stepper, live price breakdown (nights × rate + cleaning fee + service fee), "Reserve" → confirmation.

**Logic:**
- `createBookingSchema` (Zod); `actions/bookings.createBooking` rejects self-booking, re-checks availability (bookings ∪ blocks, half-open), enforces `min_nights` and no past dates, computes snapshot totals in cents with half-up fee rounding (`SERVICE_FEE_PCT`), inserts a `confirmed` booking (exclusion constraint is the final guard), revalidates listing + `/trips`. See `architecture.md` → Booking Rules.

### 13 Trips (guest reservations)

Where a guest sees and manages their bookings.

**UI:**
- `/trips` with upcoming and past sections (past = checkout passed); each shows listing summary, dates, guests, total; cancel on upcoming.

**Logic:**
- `queries/bookings.getGuestBookings`; `actions/bookings.cancelBooking` (guest-owned, allowed only while `confirmed` and `check_in >= today`; sets `cancelled` + `cancelled_at`, which frees the dates), revalidate.

### 14 Host reservations

Where a host sees bookings on their listings.

**UI:**
- `/host/reservations` list grouped by listing (upcoming/past), showing guest, dates, guests, total.

**Logic:**
- `queries/bookings.getHostReservations` (bookings where the listing's `host_id = current user`); read-only for the host in this build.

---

## Phase 5 — Engagement

### 15 Reviews & ratings

Let guests review completed stays and show ratings on listings.

**UI:**
- "Leave a review" (star rating + comment) available on a completed trip; reviews and average rating rendered on the listing page and cards.

**Logic:**
- `createReviewSchema`; `actions/reviews.createReview` (guest of the booking only, checkout passed, one per booking via DB unique), revalidate listing.
- Reviews are **immutable** once posted — no edit action; `deleteReview` (reviewer or admin) lets a reviewer remove and re-post if needed.

### 16 Guest ↔ host messaging

In-app conversations with live delivery.

**UI:**
- "Message host" on the listing page; `/messages` inbox (threads ordered by `last_message_at`, unread indicator) and a thread view with a composer.

**Logic:**
- `actions/messages.getOrCreateThread`, `sendMessage` (validate, insert, bump `last_message_at`); client subscribes to Realtime `postgres_changes` on `messages` filtered by `thread_id`; mark-as-read on open.

---

## Phase 6 — Admin & Polish

### 17 Admin dashboard

Internal moderation for users, listings, and bookings.

**UI:**
- `/admin` (admins only; non-admins redirected home) with three tables:
  - **Users** — read-only list (name, join date, listing/booking counts; email via the `admin_list_users()` definer function, not the public `profiles` table). No role editing or user deletion in this build.
  - **Listings** — unpublish (soft, reversible: `is_published = false`) and delete (hard, cascades photos/bookings and `destroy`s Cloudinary assets — confirm dialog).
  - **Bookings** — view and cancel (same `cancelled` status transition as a guest cancel; no hard delete).

**Logic:**
- Admin-only queries/actions guarded by `is_admin()` in **both** the route and RLS; reuse the existing `deleteListing` / `cancelBooking` action logic (they already accept an admin actor via RLS).
- Every admin mutation logs an audit line server-side with an `[admin]` prefix (actor id, action, target id). A dedicated audit table is out of scope for this build.
- Deletes are **hard deletes** (with FK cascade); unpublish is the reversible/soft option — prefer unpublish for moderation, reserve delete for spam/abuse.

### 18 Responsive QA, polish & deploy

Make it feel finished, verified across devices, and live on Render.

**UI:**
- Consistent loading/empty/error states across routes; verify every screen at all four DESIGN.md breakpoints (phone, iPad, laptop, desktop) — including the mobile collapse behaviors (search overlay, sticky reserve bar, hamburger nav); confirm `CldImage` `sizes` deliver right-sized images per breakpoint.

**Logic:**
- Accessibility pass (labels, focus order, keyboard, ≥44px targets); verify all invariants hold end to end.
- Full green suite: `npm run test` (unit) + `npm run test:e2e` (Playwright core flows) + `npx tsc --noEmit` + `npm run lint` all pass.
- Deploy to Render as a Web Service (`npm run build` → `npm start`); set all env vars in the dashboard; register redirect URLs per `architecture.md` → Redirect URL responsibilities (Google → Supabase callback; Supabase → Render `/auth/callback`); set `NEXT_PUBLIC_SITE_URL` to the Render URL.

---

## Feature Count

| Phase | Features |
| ----- | -------- |
| Phase 1 — Foundation | 4 |
| Phase 2 — Browse & Discover | 4 |
| Phase 3 — Hosting | 3 |
| Phase 4 — Booking | 3 |
| Phase 5 — Engagement | 2 |
| Phase 6 — Admin & Polish | 2 |
| **Total** | **18** |
