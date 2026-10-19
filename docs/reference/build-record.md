Historical snapshot of `context/build-plan.md`, preserved during the documentation rewrite on 2026-10-19.

These are the previous notes, including their old reading instructions and any dated claims. Use `CLAUDE.md` for the current layout. Read this file only for the original detail or reasoning; examples here have not been revalidated against current library documentation. Paths in the preserved text are relative to the original file location, not this snapshot.

---

# Build Plan

> **Role:** The build record — the 18 features in the order they were built, each with what
> was planned and how it actually shipped.
> **All 18 are complete.** Read a feature's entry before changing the code it produced: the
> **As built** blocks are the shortest explanation of why that code is shaped as it is.
> **Relates to:** features come from `project-overview.md`; live status in `progress-tracker.md`;
> full narrative in `build-journal.md`.

**This file is finished and is now read backwards.** It was written as a forward plan and
built in order; every box in `progress-tracker.md` is ticked. What makes it still worth
reading is the two annotation blocks each feature carries — **Planned shape (agreed before
build)** and **As built (deviations worth knowing)** — because the gap between them is where
the real constraints surfaced. Several entries record the plan being *wrong*: F17's is the
sharpest, where this file asserted that the existing actions "already accept an admin actor
via RLS" and two of the three verbs did not. Those corrections are left in place deliberately.

New work does not belong here. It goes in `progress-tracker.md` → Open work, and once it
constrains something, in `build-journal.md` → Standing Constraints.

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

**As built (deviations worth knowing):**
- **`getGuestBookings` filters `guest_id` explicitly, and this is the one query in
  the project where leaning on RLS would be wrong.** `getFavorites` deliberately omits
  its `user_id` filter because the `favorites` policy *is* `user_id = auth.uid()`. The
  `bookings` SELECT policy is broader — guest **OR** the listing's host **OR**
  `is_admin()` — so the same pattern would put F14's screen inside F13's and hand an
  admin the whole table, with nothing erroring. Gate-proved: deleting the filter makes
  a host see a stranger's booking in their own Trips.
- **`cancelBooking` enforces none of the cancellation rules, on purpose.** Ownership,
  `status = 'confirmed'` and `check_in >= current_date` all live in
  `bookings_update_cancel_own_or_admin`'s USING clause, and the writable-column list in
  `0006`. What the action alone can do is notice the update **changed nothing**: RLS
  filters rather than raising, so a refused cancel returns `{ error: null }` and zero
  rows. `.select(...).maybeSingle()` plus a `!data` branch is the entire feature.
- **Two sections, but four temporal states.** "Upcoming" means *still going to happen*
  (`confirmed` **and** `check_out >= today`), so an **in-progress** stay sits there with
  no control and a stated reason, while **every cancelled booking** is Past whatever its
  dates say. `tripSection` / `canCancelBooking` are pure and unit-tested against all
  four states the seed carries.
- **A booking whose listing is no longer visible keeps its card.** RLS returns a null
  `listings` embed once a host unpublishes — and postgrest-js types that embed as
  **never-null**, so TypeScript never asks (F08's trap, verified again by probe here).
  `/favorites` drops such rows; a reservation must not be, or the guest loses sight of a
  stay they still hold *and* the cancel control that lives on that card.
- **No migration, and no new route** — `/trips` was already a placeholder route, so the
  build stays at **15 routes**. `database.types.ts` untouched; advisors still 7 WARNs.
- **The cancel control is DESIGN.md `button-secondary` at 48px**, not the host row's
  44px `HOST_CONTROL`. That compromise exists because four controls share one row at
  320px; a trip card has one.
- **F13 exposed a latent race in two `search.spec.ts` assertions.** Both compared live
  grid counts taken across two navigations, which any concurrently-published fixture
  listing can change between. Re-based onto the seeded catalogue (`snapshot.listings`),
  which no spec mutates, and re-gate-proved against a spurious filter.

### 14 Host reservations

Where a host sees bookings on their listings.

**UI:**
- `/host/reservations` list grouped by listing (upcoming/past), showing guest, dates, guests, total.

**Logic:**
- `queries/bookings.getHostReservations` (bookings where the listing's `host_id = current user`); read-only for the host in this build.

**As built (deviations worth knowing):**
- **Not grouped by listing — two flat chronological sections, `/trips`' shape,** with the
  listing named on each row. The UI line above says "grouped by listing", but a host holding
  one or two stays across several places would have "what is next" scattered over as many
  headings; a host arriving here is asking *who is coming*, which is one ordering, not N.
  Agreed with the developer before build.
- **Read-only is a schema fact, not a scope decision, and that was checked rather than
  assumed.** `bookings_update_cancel_own_or_admin`'s USING clause admits only `is_admin()`
  or `guest_id = auth.uid()`, and its WITH CHECK would reject a host-authored row anyway —
  a host has **no write path to `bookings` at all**. F17's admin cancel works only because
  an admin is named in that policy; a *host* cancel or decline needs a migration. A spec
  asserts the page renders zero buttons, rather than leaving read-only to the absence of one.
- **Money shows two figures, because the stored `total` is the guest's.** It includes the
  14% service fee, which is the platform's — printing it bare on a host surface reads as a
  payout. The card renders "Guest paid / Service fee / Your earnings" off a new pure
  `hostEarnings({ total, serviceFee })`. Presentational arithmetic over the existing
  snapshot only; NextBnb still moves no money. **Cancelled rows suppress the earnings
  line** — a cancelled stay earns nothing, and a figure under a "Cancelled" pill is money
  never arriving.
- **Two queries, not an embedded filter.** The scope is a condition on the *joined* table,
  so own listing ids are read first and bookings filtered `.in('listing_id', ids)` — the
  ordinary filters used everywhere else — rather than PostgREST embedded-column filtering
  (`listings!inner(...)` + `.eq('listings.host_id', …)`), which appears nowhere in this
  project. The id read is **deliberately unlimited**: it defines the scope, so a ceiling
  there would drop whole listings' reservations rather than truncate a list. Zero ids
  short-circuits, because `.in('listing_id', [])` renders as `in.()` — the syntax error
  `library-docs.md` already records for the availability `.not(...)`.
- **`MAX_RESERVATIONS` orders `check_in` DESCENDING at the database.** Ascending would make
  the ceiling keep the oldest history and drop the arrivals the page exists for; the
  sections are then sorted in JS, upcoming ascending and past descending, as `/trips` does.
- **Reservations on unpublished listings render, marked.** The `bookings` SELECT policy's
  host branch carries no `is_published` condition, so a host who unpublishes a place still
  sees the stays they owe on it — F13's posture from the other side. A second
  `Unpublished` pill (the existing `HostListingCard` "Draft" pill style) states it, so the
  row is not read as evidence the listing is still bookable.
- **Listings with no reservations do not render at all**, otherwise the page becomes a
  partial duplicate of `/host/listings`. The two empty states are told apart by a
  `hostsNothing` flag, and the **failed-read path reports `hostsNothing: false`** — a
  broken query says "nothing booked yet" rather than inviting a host with live
  reservations to list their first place.
- **No migration, no new route, and no client component.** `/host/reservations` was
  already a placeholder and already in the proxy's `PROTECTED` prefix list and
  `AccountMenu`, so the build stays at **15 routes**; `database.types.ts` untouched;
  advisors still 7 WARNs. Nothing on the page mutates, so unlike `/trips` there is no
  client leaf except `ListingImage`.
- **`createBooking` and `cancelBooking` both gained `revalidatePath('/host/reservations')`.**
  Neither touched it, so a new booking or a guest's cancellation left the host's page stale.
- **`createBookingRow` gained an optional `cleaningFee`** (default 0, so F10/F13 call sites
  are unchanged). At a zero fee, earnings (`total - service_fee`) collapse onto
  `nights × price_per_night`, so the money assertion would have passed against an
  implementation that ignored the cleaning fee entirely — F12's rule about asking what a
  green assertion would *still* pass against.

---

## Phase 5 — Engagement

### 15 Reviews & ratings

Let guests review completed stays and show ratings on listings.

**UI:**
- "Leave a review" (star rating + comment) available on a completed trip; reviews and average rating rendered on the listing page and cards.

**Logic:**
- `createReviewSchema`; `actions/reviews.createReview` (guest of the booking only, checkout passed, one per booking via DB unique), revalidate listing.
- Reviews are **immutable** once posted — no edit action; `deleteReview` (reviewer or admin) lets a reviewer remove and re-post if needed.

**As built (deviations worth knowing):**
- **The UI line above was already true before F15 started.** `averageRating`,
  `toListingCard` and `ReviewsSection` have rendered ratings on the listing page and the
  cards since F05/F07. F15 built the **write** path and made a trip card aware of its own
  review state; nothing about how a rating displays changed.
- **Both halves live inline on the `/trips` past card**, not on the listing page and not on
  a new route. The booking is the unit of review and `getGuestBookings` already loaded
  exactly those rows in exactly that order (F13 sorted `past` newest-first for this). Build
  stays at **15 routes**, so F07's no-`loading.tsx` rule is untouched.
- **An INSERT raises where an UPDATE filters, so the two actions are opposite shapes.**
  F13's rule — RLS refuses a write by filtering, so check the row count — holds for UPDATE
  and DELETE but **not** INSERT, where a failed `WITH CHECK` raises `42501`. `createReview`
  therefore maps error codes (`23505` → already reviewed, `42501` → not finished yet) and
  has no zero-row branch; `deleteReview` has the zero-row branch and no code mapping.
- **`canReviewBooking` mirrors the INSERT policy exactly** (`confirmed` **and**
  `check_out < current_date`, **and** not already reviewed), inverting F10/F11's widened
  cutoffs: refusing is the harmless error here, so widening is what would offer a form the
  database rejects.
- **`listing_id` is derived from the booking, never sent by the client** — the policy
  requires the two to match, so a supplied value could only match or be refused. Reading
  the booking for it is not F06's trap: a non-participant reads zero rows and is refused.
- **The comment is optional, capped at 1 000 chars, and blank normalises to `null`** (F09's
  accept-its-own-output rule; the schema is unit-tested against `parse(parse(x))`).
  `MAX_REVIEW_COMMENT` is **exported** from the validations module because the textarea's
  `maxLength` comes from it — there is no resolver here to catch an overlong comment.
- **`useState`/`useTransition`, not react-hook-form**, matching `CancelTripButton` on the
  same card and `BookingWidget`. A radio group cannot emit an out-of-range rating.
- **`RatingInput` is a native radio group** (visually hidden, focusable inputs + 44px star
  labels): arrow-key navigation, one tab stop and `radiogroup` semantics for free, which is
  the cheapest way not to add a ninth feature to F18's keyboard debt. DESIGN.md specs a
  star *display* but no star *input*.
- **`StarRating` was extracted to `components/ui/` and `ReviewsSection` rewired to it** —
  the trip card reads a review back, so the five-star loop would otherwise exist twice and
  be two places to drift on the ink-not-gold rule.
- **Gate proof found a redundancy, not a bug.** `TripReview` originally tested `review`
  before `canReview`, so the component was enforcing one-per-booking a second time and
  `canReviewBooking`'s `hasReview` argument was unreachable — the proof passed when it
  should have failed. Order reversed so one implementation owns the rule.
- **No migration, no new route, no seed change**, `database.types.ts` untouched, advisors
  still 7 WARNs. `seed-verification.sql` reads **45/46** — seeded booking 14 has aged out
  of the in-progress window (its own section-9 documented failure mode), which predates
  F15 and needs a seed re-run, not a code fix. See `build-journal.md` → F15.

### 16 Guest ↔ host messaging

In-app conversations with live delivery.

**UI:**
- "Message host" on the listing page; `/messages` inbox (threads ordered by `last_message_at`, unread indicator) and a thread view with a composer.

**Logic:**
- `actions/messages.getOrCreateThread`, `sendMessage` (validate, insert, bump `last_message_at`); client subscribes to Realtime `postgres_changes` on `messages` filtered by `thread_id`; mark-as-read on open.

**Planned shape (agreed before build, 2026-07-28):**
- **The database half already exists; F16 is application code only.** `message_threads`
  and `messages` shipped in `0001` with their indexes, all six policies in `0003`, the
  column grants (`last_message_at` / `read_at`) alongside them, and `0004` put
  **`messages` and only `messages`** in the `supabase_realtime` publication.
  `schema-verification.sql` already proves send / read-receipt / non-participant-hidden /
  body-not-editable. **No migration, no seed change, `database.types.ts` untouched.**
- **A conversation is its own route — `/messages/[threadId]`**, taking the build to
  **16 routes**. A thread that is not yours returns zero rows under RLS and must
  `notFound()`, so **F07's rule applies and this route gets no `loading.tsx`**.
- **The guest initiates, from the listing page only** — the UI line above, no wider.
  The control hides when the viewer is the host (`isOwnListing` is already computed
  there; `guest_id <> host_id` is a table check regardless). **Accepted consequence: a
  host can never start a conversation**, only reply. Widening it would re-open
  `/host/reservations`, which F14 deliberately shipped with zero interactive controls.
- **The thread row is created on click, not on first send.** The unique
  `(guest_id, host_id, listing_id)` constraint (`nulls not distinct`) makes
  `getOrCreateThread` idempotent for free, so two clicks converge the way F08's
  `setFavorite` does. **Accepted cost: a guest who clicks and never types leaves an
  empty thread in both inboxes**, rendered as "No messages yet".
- **Realtime covers the open thread only** (`filter: thread_id=eq.<id>`, `removeChannel`
  on unmount). The inbox stays server-rendered and revalidated. **Known limitation: a
  new message does not reorder or badge the inbox until it is revisited.**
- **Mark-as-read inverts F13's rule, and this is the feature's most useful line.** F15
  flagged this as the next place the INSERT/UPDATE distinction bites, and the answer is
  the *opposite* of `cancelBooking`'s. `markThreadRead` filters `sender_id <> me and
  read_at is null`, so **zero rows is the common case — "nothing was unread" — and must
  be silent**. A genuine Supabase error logs and is swallowed: a failed receipt must not
  stop the thread rendering. F13's shape here would false-alarm on most opens.
- **`getThreads` leans on RLS and does *not* re-filter by participant — the inverse of
  `/trips`.** `message_threads_select_participant` is exactly `guest_id = uid or
  host_id = uid`, which is precisely the question the inbox asks. That is
  `getFavorites`' situation, not `getGuestBookings`' (guest **OR** host **OR** admin).
  F13's rule is "ask per table, not per project" — asked, answered no filter.
- **Desktop keeps the inbox as a rail**: thread full-width below `desktop:` with a back
  link, thread list returning beside it at 1128px. The thread route re-runs the list
  query rather than sharing it through a `layout.tsx`, which cannot know whether a child
  route is active.
- **No seed change.** E2E builds its own threads through fixtures (F15's posture), and an
  empty inbox is an honest first-run state — which also avoids `seed.sql`'s opening
  cascading `delete from auth.users`, already parked for the developer to schedule.
- **`global-teardown.ts` needs a new thread sweep, and this was checked rather than
  assumed** (F10's read-the-FK-actions rule): threads do **not** cascade with listings —
  `listing_id` is `on delete set null` and the participants cascade from `profiles`. The
  existing teardown sweeps listings only, so fixture threads would survive every run.
- **Two schema hazards recorded, neither fixed here** (both need a migration): the
  `message_threads` INSERT policy admits `guest_id = uid OR host_id = uid`, so a forged
  request could name an arbitrary counterpart as guest (the action never does); and
  `on delete set null` can collide with `nulls not distinct` — a guest with threads about
  two listings by one host sees the *second* listing delete raise a unique violation once
  both rows collapse to `(guest, host, null)`. **F17's admin delete has the same exposure.**
- **Admins cannot read threads** (`0003` says so deliberately), so F17's moderation
  excludes messages.

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

**Planned shape (agreed before build, 2026-07-29):**
- **The Logic line above is wrong for two verbs of three, and F17 is the first Phase 6
  feature needing a migration.** "Reuse the existing `deleteListing` / `cancelBooking`
  logic (they already accept an admin actor via RLS)" holds only for `cancelBooking`,
  which carries no `guest_id` filter. `deleteListing` is `.eq('host_id', user.id)` in
  **three** places, so RLS permits an admin the action's own filter refuses. And
  `listings_update_own` is `using (host_id = uid) with check (host_id = uid)` with **no
  admin branch in any of the eight migrations** — so an admin unpublish is an UPDATE
  matching zero rows that returns `{ error: null }`. **F13's exact trap**: moderation
  reported as successful that did nothing. `architecture.md`'s RLS matrix was right; this
  plan's F17 entry was not.
- **Unpublish gets a narrow definer function, not a widened policy.** `0009` adds
  `admin_unpublish_listing(p_listing_id uuid) returns uuid`, self-guarded on `is_admin()`,
  writing `is_published = false` and nothing else, returning the id so the caller keeps
  F13's zero-row branch. Mirrors `admin_list_users()` — *the one function that bypasses
  RLS exposes only the one thing RLS cannot reach*. Adding `or is_admin()` to
  `listings_update_own` was rejected: **no column grant restricts listing writes**, so it
  would also let an admin rewrite `title`, `price_per_night` or **`host_id`** —
  reassigning a listing to another user. F16 already recorded one policy looser than its
  app as a hazard; this would have been a second, deliberately. One direction only: the
  admin has no republish, and the host's own republish keeps its ≥1-photo guard.
- **`adminDeleteListing` is a separate action, and its own `is_admin` check is
  load-bearing rather than defence in depth.** `listings_delete_own_or_admin` admits
  *host **OR** admin*, so without that check an ordinary host could call the admin action
  on their own listing and walk straight past F10's upcoming-booking guard — RLS would
  permit it and nothing would error. It is not a widened `deleteListing` because the two
  differ in their *central rule*, not their filter: the host action refuses while an
  upcoming stay exists and this one must not. Merging them means a boolean that inverts
  the guard the function exists for (F15: ask which verb a write pattern was learned from).
- **Delete allows but states the blast radius**, rather than refusing. F10 left
  `listings_delete_own_or_admin` open deliberately so moderation keeps a hard-delete
  escape hatch for spam. The confirm step names what disappears ("also erases 3 upcoming
  reservations and 7 reviews") and offers **Unpublish** as a third control beside
  Confirm/Keep — F10's own state-the-reason pattern, applied to the thing F10's Key
  Decision calls invisible: *an FK cascade is a destructive path with no error, no test
  and no type pointing at it.*
- **`cancelBooking` is reused unchanged as the transition**, gaining one line
  (`revalidatePath('/admin')`, exactly as F14 added `/host/reservations` for the same
  staleness reason). `adminCancelBooking` verifies admin, writes the audit line and
  delegates, so one implementation owns the status transition. Note the admin branch of
  `bookings_update_cancel_own_or_admin`'s USING carries **no** `status`/`check_in`
  conditions — an admin can cancel an in-progress stay a guest could not.
- **One route, three sections** — `/admin` stays a single page, so the build holds at
  **16 routes** and F07's no-`loading.tsx` rule is untouched. Every read is an ordinary
  RLS-scoped select, which makes these **the queries with nothing but intent to scope
  them** (F14): an admin satisfies every SELECT policy on every table.
- **Semantic `<table>` inside `overflow-x-auto`.** `code-standards.md`'s "grids drop
  columns, never reflow rows" governs *card grids*; this is genuinely tabular data, so
  `<caption>`/`<th scope>` earn their keep. Stated in the docblock so it does not later
  read as a violation.
- **`ui/Pill.tsx` is extracted** and `HostListingCard` + `ReservationCard` rewired. The
  pill class string is already duplicated twice; F17 needs Draft / Cancelled / Unpublished
  and would make it five. Same reasoning that extracted `StarRating` in F15.
- **Advisor baseline moves 7 → 8 WARNs** (`authenticated` EXECUTE on the new definer
  function). A ninth is a finding.
- **`second-user.spec.ts` breaks and must be repointed**: its
  `getByText('your profile has is_admin set')` asserts on the *placeholder's* copy.

**As built (deviations from the plan above):**
- **The `is_admin` check inside `adminDeleteListing` was proved load-bearing, not
  assumed.** By impersonation in SQL (`set role authenticated` +
  `request.jwt.claims`, `schema-verification.sql`'s technique): a **non-admin host**
  with one upcoming confirmed stay ran `delete from listings` and it returned **OK**,
  leaving **zero** rows. So the policy really does admit the caller the action refuses.
- **The route-gate spec *moved* out of `second-user.spec.ts` rather than being
  repointed there, and the responsive assertions live in `admin.spec.ts` rather than a
  conventional `admin-responsive.spec.ts`.** `profiles.is_admin` is global per-user
  state and `playwright.config.ts` sets `fullyParallel: true`, which orders nothing
  *between* files — `mode: 'serial'` only orders tests within one. Two files granting
  and revoking the same flag would race, and the failure would read as a flaky
  redirect. One file owns the flag; the naming convention lost to the race.
- **`Pill` found a fourth copy** — `TripCard` as well as `HostListingCard` and
  `ReservationCard`.
- **`destroyAsset` moved to `lib/cloudinary.ts`, and it had to.** A `'use server'`
  module turns every export into a callable endpoint, so exporting it from
  `actions/listings.ts` to share it would have published an unauthenticated route that
  destroys any asset in the account given its `public_id`.
- **Six parallel queries, not four.** The Users counts are read separately and
  **uncapped**, because counting from the capped display reads would report "3 listings"
  for a host holding 300 once the catalogue outgrows the cap — F14's scope-defining-read
  rule, applied to a counting read.
- **A pre-existing, unrelated spec bug surfaced and was fixed.**
  `host-availability-responsive.spec.ts` measured `todayISO() + 3` with a bare
  `dayCell`; on the last three days of any month that date is in the *next* month, which
  only renders at `desktop:` and up. It timed out at 320/375/744 on 2026-07-29 and
  passed at 1128/1440. `calendar.ts`'s `revealDay` already existed for exactly this.
- **Verified:** unit 288/288, build green at **16 routes**, migrations **9/9**, advisors
  **8 WARNs** (the 8th predicted before it appeared, and the absence of a matching `anon`
  WARN is what confirms the revoke landed). E2E is **387 total — 383 passed / 3 skipped /
  1 intermittent**: `messages.spec.ts`' inbox-ordering test failed in 2 of 3 full runs
  while passing 12/12 isolated on both trees. **Not conclusively attributed** — see
  `progress-tracker.md` and `build-journal.md` → F17 for the measurements and the
  understood mechanism (`sendMessage`'s unguarded, error-swallowing `last_message_at`
  bump, the one write in the project without F13's zero-row check).

### 18 Responsive QA, polish & deploy

Make it feel finished, verified across devices, and live on Render.

**UI:**
- Consistent loading/empty/error states across routes; verify every screen at all four DESIGN.md breakpoints (phone, iPad, laptop, desktop) — including the mobile collapse behaviors (search overlay, sticky reserve bar, hamburger nav); confirm `CldImage` `sizes` deliver right-sized images per breakpoint.

**Logic:**
- Accessibility pass (labels, focus order, keyboard, ≥44px targets); verify all invariants hold end to end.
- Full green suite: `npm run test` (unit) + `npm run test:e2e` (Playwright core flows) + `npx tsc --noEmit` + `npm run lint` all pass.
- Deploy to Render as a Web Service (`npm run build` → `npm start`); set all env vars in the dashboard; register redirect URLs per `architecture.md` → Redirect URL responsibilities (Google → Supabase callback; Supabase → Render `/auth/callback`); set `NEXT_PUBLIC_SITE_URL` to the Render URL.

**Planned shape (agreed before build, 2026-07-29):**
- **Two of the three workstreams above are not in the state this entry implies, and
  exploration is what said so.** *Responsive QA is largely already banked* — 11
  `*-responsive.spec.ts` files already sample the four DESIGN.md bands at their lower
  boundaries, so that half is confirmation rather than construction. *The accessibility
  half is worse than the tracker's Outstanding-actions list reads*: there is *no
  `.focus()` call anywhere in `src/`*, so the project has **zero focus management**, and
  both `aria-modal="true"` surfaces have no trap, no Escape and no focus restore. Only
  `AccountMenu` handles Escape at all. *Deploy is entirely undone* — no `render.yaml`, no
  Dockerfile, no CI.
- **Two items this plan and the tracker assign to F18 needed re-basing.**
  `sendMessage`'s zero-row bump guard is **already done** (commit `938c84a`, 6.17.5,
  landed after F17 closed), and `README.md` still says *"Status: Pre-build … application
  code has not been written yet"* with 17 features shipped.
- **`DateRangePicker`'s day cells stay plain buttons — no `role="grid"`, no roving
  tabindex.** The tracker's phrase *"F06's calendar `role="grid"` roving focus"* reads as
  though that exists; it does not — there is no `role`, no `tabIndex` and no `onKeyDown`
  in the primitive. Adding the correct ARIA grid pattern is a rewrite of a component
  sitting under **three** features (`SearchBar`, `BookingWidget`, `AvailabilityManager`)
  and ~6 spec files, at the finish line. A botched roving tabindex is worse for a keyboard
  user than verbose-but-working buttons, so the ~60-tab-stop cost across two months is
  **recorded as a known limitation instead of fixed**. Deliberately inverts nothing: the
  cells are already operable, which is what makes deferring legitimate rather than lazy.
- **The two calendar *popovers* do get Escape + focus restore**, separable from the
  decision above because they are non-modal positioned `div`s — the change is a keydown
  handler and a trigger ref, touching no day-cell rendering and no existing spec selector.
  Today a keyboard user who opens the calendar and clicks "Done" is returned to the top of
  the document.
- **Verification is hand-written Playwright focus specs, not `@axe-core/playwright`.** No
  new dependency, and the choice is not only about dependency count: axe finds *static*
  ARIA violations and **structurally cannot see** "the dialog never restores focus", which
  is the entirety of the debt here. The trap test asserts the *cycle* (focus last element
  → Tab → back at the first), because asserting focus is merely *somewhere* would pass
  against no trap at all — F08's rule.
- **A focus trap is hand-rolled, not Radix.** `code-standards.md` pre-authorises the
  conversation about a headless a11y primitive; it is declined on churn grounds — adopting
  Radix at feature 18 means restyling two working dialogs to DESIGN.md and re-verifying the
  33 responsive tests that drive them.
- **Two hooks, not one** (`src/lib/hooks/`): `useDismissable` (Escape + focus restore +
  optional Tab trap) for the 5 dismissable surfaces, and `useFocusWhen` for the 5 two-step
  confirm controls, which otherwise repeat the same two-line effect five times. Extracting
  at five copies follows this project's own precedent — `Pill` was extracted at four,
  `StarRating` at two.
- **The production build gets one verification run.** All 387 tests have only ever run
  against `npm run dev` (`playwright.config.ts`'s `webServer`), so a deploy feature closes
  that gap once against `npm run build && npm start`; the committed config stays on dev so
  every future run does not pay for a build.
- **Scope explicitly excludes** the separate Supabase project for E2E (large enough to
  rival the rest of F18 — it stays an open tracker action, so the open-signup finding stays
  open), admin pagination, inbox live-update, and any dedicated investigation of the
  `messages.spec.ts` flake. The full-suite runs will show whatever they show post-`938c84a`
  and that gets **recorded, not explained away**.
- **F18 closes only when the live Render URL works**, Google sign-in included — not when
  the runbook lands. The three redirect allow-lists and the eight env vars are entered by
  the developer; the dashboards are not reachable from the build session.
- **No migration, no new route, no new dependency.** The build stays at **16 routes**, so
  F07's no-`loading.tsx` rule is untouched, and advisors should stay at **8 WARNs**.

**As built (deviations from the plan above):**
- **The accessibility half was the feature; the responsive half was confirmation.** Exactly
  as the plan predicted. Ten surfaces gained focus management via two new shared hooks
  (`src/lib/hooks/useDismissable.ts`, `useFocusWhen.ts`) — the first `.focus()` calls in the
  project — and `e2e/keyboard.spec.ts` gate-proves each. The 11 existing `*-responsive.spec.ts`
  files needed no structural change.
- **Three of the five focus-restore tests passed against a build with the restore deleted.**
  For a non-modal popover, focus never leaves the trigger, so the assertion was measuring
  "focus was never stolen" rather than "focus was restored". Its twin failed from the other
  direction: the "not trapped" test passed against a build with the trap wrongly enabled.
  Both rewritten; this is F18's Key Decision and the single most useful thing the feature
  produced.
- **The `role="grid"` calendar the tracker said to audit had never been built.** No `role`,
  no `tabIndex`, no `onKeyDown` in `DateRangePicker` — the to-do described work as existing.
  Recorded as a known limitation rather than fixed, for the reasons the plan gave.
- **The deploy shipped broken and a green site hid it.** `NEXT_PUBLIC_SITE_URL` was set to the
  *callback URL* rather than the origin, making the OAuth `redirect_to`
  `…/auth/callback/auth/callback` — a 404 — while every other surface passed. Fixed by setting
  the bare origin and **redeploying**, which is the load-bearing half: `NEXT_PUBLIC_*` is
  inlined at build time. `docs/deploy-render.md` step 5 gained a `curl` check that reads
  `redirect_to` straight off the OAuth hand-off without spending a Google consent — one
  command that confirms all three allow-lists.
- **The production-build run found three pre-existing `host-manage.spec.ts` failures**, proved
  not-F18's by reverting `src/` to `938c84a` and re-running. Mechanism unidentified; recorded
  unresolved in `progress-tracker.md` → Open work rather than tidied away.
- **A pre-existing date-fragility class was swept**, beyond the one spec F17 handed forward:
  six more bare `dayCell` assertions in `host-availability.spec.ts` and a
  `search-responsive.spec.ts` test that silently skipped its only assertion on the 1st of
  every month. The suspected `todayISO()`/`addDay()` timezone mismatch was investigated and
  is **not** a defect — reasoning recorded in the function's docblock so it is not
  "simplified" into a real bug later.
- **Scope held.** No migration, no new route, no new dependency; 16 routes, 8 WARNs.
- **Verified:** unit 288/288, e2e **395 total — 392 passed / 3 skipped / 0 failed** against
  the dev server, build green at 16 routes, live at https://nextbnb-h4ov.onrender.com with
  Google sign-in and the full host mutation flow hand-verified against the deployment.

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
