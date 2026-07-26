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
- Add `src/lib/supabase/{server,client,middleware}.ts` and `src/proxy.ts` (route protection) per `architecture.md` Key Patterns. (Shipped as `src/middleware.ts`; renamed to `src/proxy.ts` in F04 for Next 16.)
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
- **Two nav sizing defects shipped here and were fixed during F07** (see
  `build-journal.md` → F07): the mobile pill overlapped the logo (`flex-1` cannot shrink
  past `min-width: auto` — needs `min-w-0`), and the row overflowed by 89px across
  744–833. The wordmark is now `tablet:`-only and "Become a host" is `desktop:`-only.
  `nav-responsive.spec.ts` samples each band's **lower boundary** as a result.

### 07 Listing detail

The full listing page a guest inspects before booking.

**UI:**
- Photo gallery, title/location, description, amenities, house rules, capacity, host info, reviews list with average, and the booking widget shell.

**Logic:**
- `queries/listings.getListingById` with photos, host profile, and reviews; 404 for unpublished listings viewed by non-owners.

**As built (deviations worth knowing):**
- **No `loading.tsx`, and that is a correctness choice, not an omission.** A route
  `loading.tsx` wraps the page in an implicit `<Suspense>`, so the response streams and
  the HTTP status commits to **200 before `notFound()` runs** — Next's documented
  behaviour ("a 404 status for non-streamed responses and a 200 for streamed"). Drafts
  would have been indexable as live pages. Measured both ways; the skeleton lost.
- **The booking widget reads no availability at all.** `unavailable_listing_ids()` takes
  a date range and returns listing *ids*; it cannot answer "which dates are taken for
  this listing". F12 owns that RPC, so F07's reservation card is a static shell.
- **RLS is the 404**, not an `is_published` filter: `getListingById` deliberately omits
  one, so the host and admins see their own drafts behind a `DraftNotice` while everyone
  else gets an indistinguishable 404.
- **The gallery is one DOM switched by CSS** — a `flex` scroll-snap strip that becomes a
  `grid` mosaic at `tablet:`. Two trees would put every photo in the document twice, and
  a `display:none` image is still fetched.
- **The 64px `rating-display-card` renders only when reviews exist**; 20 of 24 published
  listings are unrated, so the empty state is the common case.
- `not-found.tsx` is the project's first, scoped to this route so it keeps the nav.
- New `--container-listing: 1080px` token (DESIGN.md → Grid & Container).

### 08 Favorites

Let users save and revisit listings.

**UI:**
- Heart toggle on cards and the detail page; `/favorites` page listing saved stays; empty state.

**Logic:**
- `actions/favorites.setFavorite` (auth-guarded, upsert/delete on `favorites`); `queries/favorites.getFavorites`; `revalidatePath('/favorites')`.

**As built (deviations worth knowing):**
- **The action is `setFavorite({ listingId, saved })`, not `toggleFavorite(id)`.** A flip
  has to read the current row and invert it, so two clicks in flight resolve against the
  same "before" and can land opposite to what the heart shows. Sending the desired state
  makes the write idempotent and converge.
- **No migration.** `favorites` was fully specified in `0001` (composite PK, no surrogate
  id), `0003` (three `to authenticated` policies) and `0006` (UPDATE revoked — a favorite
  is created or removed, never edited). `database.types.ts` untouched.
- **Saved state rides the existing selects** (`favorites(user_id)` nested into
  `getPublishedListings`/`getListingById`), not a second query. RLS scopes the nested rows
  to the viewer. **Not F06's trap:** there, fewer rows inferred a *permission*
  ("everything is available"); here they infer a restriction ("not saved"), which is the
  right answer for anon.
- **`useState`, not `useOptimistic`.** Optimistic state reverts to the server prop once the
  transition settles, and only `/favorites` is revalidated — so on `/` a *successful* save
  would have snapped back to unsaved.
- **`ListingCard` is no longer one `<Link>`.** A `<button>` nested in an `<a>` both toggles
  and navigates (proven by gate proof). The link is scoped to the title and stretched with
  `after:absolute after:inset-0`; the heart is a sibling on `z-10`.
- **The detail-page heart overlays the gallery** via a new `action` slot on `PhotoGallery`,
  rendered as a *sibling* of the scroll container — inside it, the mobile strip would swipe
  the heart off screen. Its mobile offset is percentage-based, because the strip bleeds a
  fixed 24px while its first tile is a percentage of that bleed.
- **The heart is 44px**, overriding DESIGN.md's 32px `icon-button-circle`, per
  `code-standards.md`'s hard tap-target floor.
- Signed-out hearts render as sign-in forms carrying `pathname + search` (minus the
  banner's own `signin`/`next` params), per `project-overview.md`.

---

## Phase 3 — Hosting

### 09 Create listing

Let a user publish a new listing with photos.

**UI:**
- `/host/listings/new` multi-section form (details, location, capacity, pricing, amenities, house rules) with `CldUploadWidget` photo upload + reorderable preview; save-as-draft vs publish.

**Logic:**
- `createListingSchema` (Zod) + react-hook-form; photos upload to Cloudinary via the signed widget; `actions/listings.createListing` inserts the listing + `listing_photos` (`url` + `public_id`), sets one cover.

**Planned shape (agreed before build, 2026-07-25):**
- **Two steps, both owned by F09** — `/host/listings/new` (details) → `createListing`
  inserts a **draft** → redirect to `/host/listings/[id]/photos` (upload + publish).
  Forced by the sign route: `/api/sign-cloudinary` signs only
  `nextbnb/listings/<uuid>` for a listing the caller **already owns**, so the row must
  exist before any upload. F10's `/host/listings/[id]/edit` stays untouched.
- **One schema, not draft-vs-publish.** Every DB-NOT NULL column is required either
  way, so a lenient draft is not actually possible. **Publish additionally requires
  ≥1 photo** — that is what makes "exactly one cover" true, which `coverPhotoOf` and
  `orderedPhotos` have been documenting as F09's job since F05.
- **Reorder is move buttons + "Make cover"**, not drag-and-drop: no new dependency,
  keyboard-accessible for free, works on touch. Reorder writes `position`.
- **Landing is `/listings/[id]`**, not `/host/listings` (still F10's placeholder). A
  draft lands on `DraftNotice` — closing the gap open since F07, where no real account
  owned a draft.
- **Upload proof is manual once + fixture rows in E2E**, per `code-standards.md`
  ("mock Cloudinary — never call real external services in CI") and F04's
  Google-round-trip precedent.
- **No migration.** `listings`/`listing_photos` policies and grants (`0001`/`0003`/
  `0006`) already permit exactly this, and `listings_set_updated_at` already maintains
  `updated_at`.
- **Prerequisite:** all three Cloudinary env vars were **empty**, so
  `/api/sign-cloudinary` had never signed anything. They must be provisioned before
  the photo half can be built or verified.

### 10 Manage listings

Let a host maintain their existing listings.

**UI:**
- `/host/listings` grid of own listings (published + drafts) with edit, publish/unpublish, delete; `/host/listings/[id]/edit` reusing the form.

**Logic:**
- `queries/listings.getOwnListings`; `actions/listings.updateListing`, `setListingPublished`, `deleteListing` (also `destroy`s each photo's Cloudinary asset where `public_id` is set); ownership enforced by RLS.

**Planned shape (agreed before build, 2026-07-26):**
- **Delete refuses while an upcoming confirmed booking exists.** `bookings.listing_id` is
  `on delete cascade`, so an unguarded delete silently erases a guest's stay — no
  cancellation, no `cancelled_at`, nothing left in `/trips`. The action refuses and steers
  to unpublish, which is already this plan's stated preference for F17. **It is a UX guard,
  not a database one:** `listings_delete_own_or_admin` still permits the delete, deliberately,
  so F17's admin delete keeps its escape hatch for spam. Accepted consequence: a listing whose
  bookings are all past still deletes, and that cascade takes its reviews with it.
- **The delete cutoff is widened by one day.** The comparison happens in JS, and `todayISO()`
  can sit either side of the DB's `current_date` near midnight — where the wrong side deletes
  a stay the database still considers in progress. `subDays(today, 1)` makes the guard err
  only toward refusing.
- **`publishListing` is replaced by `setListingPublished({ listingId, published })`**, not
  joined by a second `unpublishListing`. Idempotent like F08's `setFavorite`, so two clicks
  converge; the `>= 1 photo` guard moves onto the publish branch. `PhotoManager` is the one
  call site to repoint.
- **`/edit` and `/photos` stay separate routes.** F09's photo surface is verified end to end
  against the live Cloudinary account; `/edit` links across rather than absorbing it.
- **Delete confirms inline in two steps**, not via `window.confirm` or a new modal primitive —
  no dependency, keyboard-accessible for free, and DESIGN.md specs no dialog.
- **`getOwnListingForEdit` is a second query, not a widened `getOwnListing`.** It returns a
  form-ready shape via a pure `toListingFormValues` helper — cents to dollars, **nulls to `''`**.
  That last mapping is load-bearing and TypeScript will not ask for it: `optionalText` is
  `.nullish()`, so `null` type-checks as a valid default and then goes uncontrolled in React.
- **Reading `bookings` here is safe, and it was checked.** The `bookings` SELECT policy admits
  the listing's host, and every reader of this page is that host by construction. **Not F06's
  trap** — there, missing rows inferred a *permission*; here they cannot, because a non-host
  never reaches the query.
- **No migration.** `0001`/`0003`/`0006` already permit host update and delete, and no column
  grant restricts which listing columns a host may write.

### 11 Availability management

Let a host block dates their listing isn't available.

**UI:**
- Availability section on the listing editor: add/remove blocked date ranges; visual calendar of blocked + booked dates (read-only for booked).

**Logic:**
- `actions/blockedDates.addBlock` / `removeBlock` (owner-scoped; block ranges are inclusive `[start, end]`; **reject a range overlapping any confirmed booking**); blocked ranges feed the same availability check used by search and booking (see `architecture.md` → Availability Rules).

**Planned shape (agreed before build, 2026-07-26):**
- **Its own route — `/host/listings/[id]/availability`**, a third sibling to `/edit`
  and `/photos`, not a section on the editor as the UI line above says. F10 kept those
  two apart deliberately; `/edit` is one large react-hook-form whose hydration window
  F10 documented as a real hazard, and hanging a second set of mutations off it makes
  every block write re-render the whole editor. `HostListingCard` gains a third link
  and `/edit` cross-links across, the way it already does to `/photos`.
- **`DateRangePicker` is widened, not forked** — a new `bounds: 'half-open' | 'inclusive'`
  prop, defaulting to `'half-open'` so `SearchBar` is untouched. Exactly two rules differ:
  in `'inclusive'` a second click on the same day completes a **one-day** range, and the
  end day counts in the straddle test. Named for the range model rather than
  `mode: 'stay' | 'block'` because `components/ui/` holds presentational primitives with
  no business rules — it must not learn what a "block" is. **F12 inherits the same
  primitive** instead of a second calendar drifting from DESIGN.md's one `date-picker-day`.
- **An overlapping block is refused — not merged, not allowed.** Blocks never overlap a
  confirmed booking (the line above) *or* each other, with a different message for each so
  the host knows which. Merging would silently rewrite a range the host never touched and
  would be an UPDATE — the one `blocked_dates` verb this feature never issues, leaving
  `blocked_dates_update_own_listing` deliberately unused. Allowing overlaps is harmless for
  the availability union but reads as broken: removing one of two coincident rows leaves the
  nights blocked with no explanation.
- **Removal is a named list control, not a calendar click.** Clicking a day would mean
  splitting a range on partial removal — an UPDATE plus an INSERT, and a second way to
  write blocks. The list follows F10's every-control-names-its-target rule.
- **Reading `bookings` directly is safe, and it was checked.** The `bookings` SELECT policy
  admits the listing's host and the query is `host_id`-scoped, so the reader is always
  privileged for the rows being counted — F10's `getOwnListings` reasoning, **not F06's
  trap**, where missing rows inferred a *permission*. **This does not solve F12's problem:**
  the guest-facing per-listing calendar still needs its own `security definer` function,
  because an anon visitor reads zero bookings.
- **The past-date floor is strict in the UI and lenient in the action** — the calendar
  offers today onward, and the action refuses only a block whose *end* is before today.
  A strict `start >= today` on both sides is evaluated twice at two moments, so a submit at
  23:59:59 could be refused at 00:00:01: F09's "a shared schema must accept its own output",
  date-shaped. Same spirit as F10's `subDays(today, 1)` — pick the harmless error.
- **`removeBlock` needs no cascade guard, and that was read first.** `blocked_dates.listing_id`
  cascades *from* `listings`; nothing references `blocked_dates`, so deleting a block erases
  only itself. Recorded because F10's key decision says to read the FK actions before writing
  any delete.
- **Accepted race:** a guest can book between the host's render and the insert, so a block can
  still land over a booking created moments later. No database constraint expresses a
  cross-table rule, and the consequence is benign — `unavailable_listing_ids` unions both, so
  search excludes the listing either way and the booking stands. Same shape as F10's delete guard.
- **No migration.** `0001` has the table and `end_date >= start_date`, `0003` all four
  host-scoped policies, `0005` the split anon SELECT, `0006` the anon revokes.
  `database.types.ts` is untouched.

---

## Phase 4 — Booking

### 12 Instant Book

The core booking flow: pick dates, see the price, reserve.

**UI:**
- Booking widget on the listing page: date-range picker disabling unavailable dates, guest stepper, live price breakdown (nights × rate + cleaning fee + service fee), "Reserve" → confirmation.

**Logic:**
- `createBookingSchema` (Zod); `actions/bookings.createBooking` rejects self-booking, re-checks availability (bookings ∪ blocks, half-open), enforces `min_nights` and no past dates, computes snapshot totals in cents with half-up fee rounding (`SERVICE_FEE_PCT`), inserts a `confirmed` booking (exclusion constraint is the final guard), revalidates listing + `/trips`. See `architecture.md` → Booking Rules.

**As built (deviations worth knowing):**
- **Migration `0008` — `listing_occupied_ranges(p_listing_id)`.** `0007` answers "which
  listings are busy in this range"; the widget needs the transpose. One definer function
  returning **inclusive** spans, with the half-open → inclusive conversion (`check_out - 1`)
  done **in SQL**, so no caller ever receives two range models in one array. Published
  listings only. The trap here is sharper than F06's: not only anon but **any signed-in
  guest** reads zero `bookings` rows for a listing they do not host, so the same
  everything-is-free answer arrives inside the *write* path too.
- **The action is the only enforcement for four of its seven rules.** The database
  independently covers self-booking, `is_published`, and booking-vs-booking overlap. It
  covers **nothing** for `min_nights`, the per-listing `max_guests`, past dates, or a
  booking over `blocked_dates` — no constraint spans two tables. **The guest cap was not in
  this plan's F12 logic line and has been added**; `seed-verification.sql` had been
  asserting it since F03.
- **The past-date floor is strict, inverting F10/F11 deliberately.** Those widened their
  cutoffs by a day because refusing was the harmless error. Here refusing is *also*
  harmless and strictness is what refuses: a booking accepted with a past `check_in` can
  never be cancelled (`bookings_update_cancel_own_or_admin` requires
  `check_in >= current_date`), so leniency would hand the guest a stay they cannot exit.
- **A failed availability read fails closed.** `getListingOccupiedRanges` returns
  `InclusiveRange[] | null`, where `null` means "the check failed" — distinct from `[]`,
  "verified free". The widget then disables Reserve and says why, and the action refuses.
  F06's rule: showing unverified availability is worse than showing none.
- **Confirmation is in-page, not a redirect.** `/trips` is F13's placeholder, so the widget
  swaps to a success panel reporting the **stored** total (which differs from the widget's
  own arithmetic only if the host edited the price mid-decision).
- **The mobile bar opens a full-screen sheet and never books.** The sheet holds the real
  Reserve, so the total is on screen before anything is committed. `SearchBar`'s overlay
  pattern.
- **The calendar popover opens to the LEFT of the card, and that fixed a real defect.**
  Hanging it below a `sticky` rail put "Clear dates" and "Done" at ~810px with no way to
  scroll them into view — unreachable for a real user on a 720px-tall screen. Found by a
  Playwright click that could not land.
- **The widget prefills from `?checkIn/checkOut/guests`** through the existing
  `parseListingFilters`, and signed-out Reserve is a sign-in form carrying that selection
  (F08's heart). `getCurrentUserId` is new in `queries/profiles.ts` — the page needs the
  *identity* to spot self-booking — and `isSignedIn` is redefined on it.
- **`ReservationCard.tsx` was deleted**, not left inert beside its replacement. The mobile
  bar became an `<aside>` on the way: ARIA drops an accessible name on a generic element,
  so F07's `<div aria-label="Reservation summary">` was announced by nothing and matchable
  by nothing.
- **Known limitation, recorded rather than fixed:** a guest can check *in* on another
  stay's checkout day (the documented invariant, and what the SQL `- 1` delivers) but
  cannot check *out* on another stay's check-in day, because `DateRangePicker.isSelectable`
  disables every occupied day outright. One bookable night at each boundary is unreachable.
- **Advisor baseline moves 5 → 7 WARNs** (anon + authenticated EXECUTE on the new definer
  function). An eighth is still a finding.

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
