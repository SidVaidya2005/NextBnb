# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly.

Update this file after every completed feature. Any AI agent reading this should
immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 4 — Booking (in progress)
**Last completed:** 12 Instant Book
**Next:** 13 Trips (guest reservations)

**F12 is live: a guest can book a stay.** The reservation card is no longer a
shell — pick dates on a calendar that greys out what is taken, step the guest
count, watch the breakdown build, and Reserve writes a `confirmed` booking whose
nights are then gone for everyone else. Confirmation is **in-page** (a link to
Trips, which F13 will make real) rather than a redirect to a placeholder. Below
`tablet:` the bottom bar opens a full-screen sheet and **never books** — the
sheet holds the real Reserve, so the total is on screen before anything is
committed. Gates: `tsc` clean, `lint` clean, **211/211** unit, **295 passed / 3
skipped** E2E, `npm run build` green, **15 routes** (F12 adds none).
`seed-verification.sql` **46/46**, seed back to 26/24/130/17/7/5/0 favorites with
**0 listings and 0 bookings** left by either fixture account.

**Migration `0008` is the feature.** `unavailable_listing_ids()` answers "which
listings are busy in this range"; the widget needed the transpose, so
`listing_occupied_ranges(p_listing_id)` returns **inclusive** occupied spans for
one published listing, with the half-open conversion (`check_out - 1`) done in
SQL so no caller ever gets two range models in one array. **The trap is sharper
than F06's:** not only anon but *any signed-in guest* reads zero `bookings` rows
for a listing they do not host — so the everything-is-free answer was waiting
inside the **write path** as well as the calendar. Proven live: anon
`GET /bookings` still returns `[]` while the RPC returns the real spans, and a
draft id returns `[]`.

**The action is the only thing enforcing four of its seven rules.** The database
covers self-booking, `is_published`, and booking-vs-booking overlap. It covers
**nothing** for `min_nights`, the per-listing `max_guests`, past dates, or a
booking over a host's `blocked_dates` — no constraint spans two tables. The guest
cap was **missing from `build-plan.md`'s F12 line** and has been added; the seed
had been asserting it since F03.

**The past-date floor is strict, and that inverts F10 and F11 on purpose.** Those
widened their cutoffs by a day because refusing was the harmless error. Here
refusing is also harmless and *strictness* is what refuses: a stay accepted with a
past `check_in` can never be cancelled, because the UPDATE policy requires
`check_in >= current_date`. Leniency would hand a guest a reservation they cannot
get out of.

**A real defect was found by a click that could not land.** The calendar popover
hung below the `sticky` reservation rail, which put "Clear dates" and "Done" at
~810px — and because the rail is pinned, **no amount of scrolling brings them
back**. Unreachable for a real user on a 720px-tall laptop screen, not just for
Playwright. The panel now opens to the *left* of the card, top-aligned, the way
DESIGN.md's reference does it. `booking-responsive.spec.ts` samples desktop at
1128×**720** because that is the pair that catches it.

**The advisor baseline is now 7 WARNs**, up from 5: anon and authenticated may
both execute `listing_occupied_ranges`. That is the design — occupancy is public
in this product and the function returns dates for published listings only. An
**eighth is a finding.**

**A Phase 3 close-out ran before F12** (2026-07-26). Phase 3 was already green on
every gate — this pass re-verified that and then closed the **second-test-user**
backlog that had been open since F04. Gates re-run from clean: `tsc` clean,
`lint` clean, **194/194** unit, **269 passed / 3 skipped** E2E (265 + 3 new
specs + 1 setup step), `npm run build` green at 15 routes, **46/46** seed
assertions, advisor baseline **still 5 WARNs**, migrations 7/7 matching remote.
The production build was smoke-tested separately, because `next dev` cannot
prove F07's status codes: draft **404**, malformed id **404**, `/trips` **307**,
unauthenticated `/api/sign-cloudinary` **401**, and the draft title appears
**0** times in anon HTML.

**A second fixture account now exists, and it closed three gaps at once.**
`SECOND_USER` (`e2e-second@nextbnb.test`) is provisioned by `auth.setup.ts`
exactly like the first and stored as its own `storageState`. All three gaps were
the same shape — **RLS answers by who is asking, and one account could only ever
ask the side that returns the reassuring answer**: `toFavoriteCards`' null-embed
drop has now met a real null (host = primary user, viewer = second user, so the
unpublished listing is genuinely invisible to the viewer); `/favorites`' empty
state is asserted; and `/admin`'s admin-side render is covered. All three gate
proofs fire.

**The admin account is temporary by construction.** The spec grants `is_admin`
for one assertion and revokes it in a `finally`, and `global-teardown.ts` resets
it for the run that is killed first — because the fixture password is committed
to this repo, so a standing admin would be a real privilege path into the same
project that holds live data, and F17's moderation includes a hard delete. After
a full suite run the database holds **exactly one admin: the developer's Google
account.**

**A note for anyone adding users by hand: a Google account cannot serve as a
fixture user.** Playwright cannot drive a consent screen — the same reason F04
provisions through email/password. Adding a Google account to the project does
not unblock any E2E gap.

**F11 is live: a host controls when their place is free.**
`/host/listings/[id]/availability` shows one calendar of everything already
taken, a "Blocked by you" list with an Unblock on each range, and a "Reserved"
list that is deliberately read-only — freeing those nights is a cancellation
(F13), not an unblock. Blocking a range refuses if it overlaps a confirmed stay
**or** an existing block, with a different message for each. **No migration** —
`0001`/`0003`/`0005`/`0006` already permitted every write, and
`database.types.ts` is untouched. Gates: `tsc` clean, `lint` clean, **194/194**
unit, **265 passed / 3 skipped** E2E, `npm run build` green, **15 routes**.
Advisor baseline unchanged at 5 WARNs; seed intact at 26/24/130/17/7/**5
blocks**/0 favorites with **0** listings owned by the fixture user.

**A third route, not a section on the editor.** `build-plan.md` put availability
"on the listing editor"; it shipped as a sibling of `/edit` and `/photos`
instead, because `/edit` is one large react-hook-form carrying the hydration
window F10 documented, and a second set of mutations on it would re-render the
whole form per block. Recorded as an as-built deviation rather than left to read
as drift.

**`DateRangePicker` was widened, not forked** — a `bounds: 'half-open' |
'inclusive'` prop. Exactly two rules differ: inclusive completes a **one-day**
range on a second click of the same day, and counts the end day in the straddle
test. Named for the range model rather than `'stay' | 'block'` because
`components/ui/` may not learn what a block is; its value fields moved from
`checkIn`/`checkOut` to `start`/`end` for the same reason, with `SearchBar` now
mapping the URL contract at its own boundary. **F12 inherits the primitive** and
the empty `unavailableRanges` prop it has carried since F06.

**The finding that shaped F11: a negative assertion needs a positive control, or
it passes for the wrong reason.** The spec asserting `/availability` 404s for a
non-owner named a hand-written listing id in the wrong sentinel namespace
(`a000`, the schema-verification range) — so **no such listing existed**, the
route 404'd because the row was missing rather than because the viewer was not
its host, and the spec **passed with `host_id` scoping deleted from the query**.
Only the gate proof disagreed. It now uses a real seeded listing and asserts
that same listing returns **200** on its public page, so the 404 can only mean
"not yours". Generalises: pair every "this is refused" with a proof the same
thing succeeds when it should — F03 learned it from a deliberately invalid
Unsplash URL, F09's follow-up from a control probe on the Cloudinary
credentials.

**RLS is the real guard on blocks, and that was proven by impersonation** rather
than assumed from the action's check: an authenticated non-host insert into
`blocked_dates` is refused, while the **same probe as the listing's host
succeeds** — the control that makes the refusal mean something. The action's
overlap guard, by contrast, is honestly only UX: no constraint can span two
tables, so a guest booking between the host's render and the insert can still
land a stay under a block. That race is accepted and benign —
`unavailable_listing_ids` unions both halves, so search excludes the listing
either way and nobody's stay is lost.

**F10 remains green: a host can maintain what they own.** `/host/listings` lists every
listing they host — published and drafts, newest first — with Edit, Photos,
Publish/Unpublish and Delete on each row, and
`/host/listings/[id]/edit` reuses `ListingForm` through a discriminated `mode`
prop rather than a second copy. `publishListing` was **replaced** by the
idempotent `setListingPublished({ listingId, published })` (F08's `setFavorite`
shape) instead of being joined by a second writer of `is_published`. **No
migration** — `0001`/`0003`/`0006` already permitted host update and delete.
Gates: `tsc` clean, `lint` clean, **157/157** unit, **237 passed / 3 skipped**
E2E, `npm run build` green, 14 routes. Advisor baseline unchanged at 5 WARNs;
seed back to 26/24/130/17/7/5 with **0** listings owned by the fixture user.

**Delete refuses while a stay is still coming.** `bookings.listing_id` is
`on delete cascade`, so deleting a listing does not cancel its reservations — it
**erases** them: no `cancelled` status, no `cancelled_at`, no row, nothing left
in the guest's Trips. `deleteListing` refuses while any confirmed booking has yet
to check out and steers to unpublish; the row disables the control **and states
why**. Said plainly: this is a UX guard, not an authorization one —
`listings_delete_own_or_admin` still permits it, deliberately, because F17's
admin moderation needs a hard delete for spam. The cutoff is widened by a day so
the JS/`current_date` boundary can only ever refuse a delete, never erase a stay
still in progress.

**Two false results were caught before they could be trusted, both by the
database oracle.** `getByRole` matches an accessible name as a **substring**, so
`{ name: 'Publish <title>' }` matched the *Unpublish* button still on screen and
resolved instantly against the pre-click state — the spec passed while the
listing was still published, and only `readListing()` disagreed. And clicking
before React hydrates does nothing at all, while a value typed into a field React
is about to re-assert from `defaultValues` is silently reverted — clearing the
title and submitting *saved the original and navigated away*, which read exactly
like "the editor accepts a blank title". Specs now wait on React's own
`__reactProps$` hydration marker rather than on a sleep.

**F09 remains green: anyone can list a place.** `/host/listings/new` collects the
details and creates a **draft**, then `/host/listings/[id]/photos` takes uploads,
reordering, cover selection and publish. Two steps, not one, because
`/api/sign-cloudinary` signs only for a listing the caller **already owns** — the
row has to exist before a photo can attach to it. Publish refuses without a photo,
which is what finally makes "exactly one cover" true (the guarantee
`coverPhotoOf` has been documenting since F05). **No migration** —
`0001`/`0003`/`0006` already permitted all of it. Gates: `tsc` clean, `lint`
clean, **122/122** unit, **204 passed / 3 skipped** E2E, `npm run build` green,
13 routes. `$249` in the form is **24900** in the column; blanks land as `null`;
a non-owner gets a real 404; advisor baseline unchanged at 5 WARNs; the seed is
back to 26/24/130 with **0** listings owned by the fixture user.

**F09 finally rendered `DraftNotice` in a browser** — open since F07, because
both seed drafts belong to fake users who cannot sign in. A draft owned by the
Playwright account renders it at 200 while anon still gets a 404.

**Cloudinary is live and the real round trip is verified** (2026-07-26). Signature
route 200 → **Cloudinary accepted that signature for a real upload** → asset
present under `nextbnb/listings/<id>/` → `CldImage` delivering with `f_auto`/
`q_auto` and a nine-width `srcset` → clicking Remove destroyed the asset. All six
negative cases hold (403 for a signed `public_id`, `upload_preset`, another
host's folder, an out-of-namespace folder, no folder; 401 signed out). Nothing
leaked: 0 assets under `nextbnb/`, 0 photo rows with a `public_id`. The suite
still never calls Cloudinary — it inserts photo rows directly, per
`code-standards.md`.

**Two defects only the real credentials could expose.** `CldUploadWidget` needs
the api_key **in the browser** and throws without it — during render, so the
whole photos route 500'd rather than the button failing. Added
`NEXT_PUBLIC_CLOUDINARY_API_KEY` (the api_key is a public identifier; the
**secret** is what authorises, and `architecture.md`'s invariant names the secret,
never the key). And both `CldImage` and `CldUploadWidget` **throw rather than
degrade** on missing config, so each is now guarded and falls back instead of
taking the route down. Detail in `build-journal.md` → F09 follow-up.

**The finding that shaped F09: a schema shared by client and server must accept
its own output.** The form validates with `createListingSchema` and posts the
*result* to the action, which re-validates with the same schema — but the
optional-text fields emitted `null` while accepting only `string | undefined`.
Every listing with a blank description passed on the client and was refused by
the server with "Please check the highlighted fields", pointing at no field at
all. `.nullish()` fixed it and two unit tests now assert `parse(parse(x))`
succeeds. The schema was correct in each direction *separately*; sharing it is
what made the gap reachable.

**F08 is live: stays can be saved.** A heart sits on every card and over the
listing gallery; `/favorites` lists saved stays newest-first with an empty state.
Signed out the heart is not hidden — it is a sign-in form carrying the current
path *and* query string, so hearting a filtered search returns to those results.
`setFavorite({ listingId, saved })` is **idempotent** (it renames
`build-plan.md`'s `toggleFavorite`): the client sends the state it wants, so two
clicks converge instead of racing. **No migration** — `favorites` was fully
specified back in `0001`/`0003`/`0006`. Gates: `tsc` clean, `lint` clean,
**75/75** unit, **169 passed / 3 skipped** E2E, `npm run build` green. Anon `/`
serves 24 cards, 24 sign-in hearts and **0** togglable controls; the advisor
baseline is unchanged at 5 WARNs; `favorites` is back to 0 rows after a full
suite run, so the per-spec cleanup works.

**The finding that shaped F08: a passing spec proved nothing, and only the gate
proof caught it.** `await expect(page).toHaveURL('/')` matches *instantly* when
the page is already at `/` — so the spec asserting "hearting a card does not
navigate" passed against markup with the button nested inside the card's `<a>`.
Rewritten to wait on a real signal (the row appearing in the table) and only then
read `page.url()`, it fails with the listing URL — which also proves the
`ListingCard` restructure was necessary, not cosmetic. **F04's journal records
the identical trap from the other direction.** Every new assertion in this
feature was run against a deliberately broken build before being trusted.

**A second F08 trap, this one in the types:** `favorites.listing_id` is a NOT
NULL FK, so postgrest-js types the `listings` embed as always-present — verified
by probe. RLS disagrees at runtime and returns a null embed for a listing the
viewer may not see. The filter in `toFavoriteCards` is load-bearing and the type
system would never have asked for it.

**F07 remains green: `/listings/[id]` is a real page.** Photo gallery (1+4 mosaic from
`tablet:`, full-bleed swipe strip below — one DOM, switched by CSS), description,
18-amenity icon list, house rules, capacity, host card, reviews with DESIGN.md's
64px `rating-display-card`, and a static reservation card (sticky rail ≥744px,
sticky bottom bar below). Content verified against the database, not against
itself: listing 1 renders 4.5 / 2 reviews / 7 amenities / 5 photos and
`Alfama, Lisbon, Portugal` with the null state dropped; listing 4 shows
`1.5 baths` and singular `(1 review)`; listing 8 (`cleaning_fee = 0`,
`house_rules` null) omits both rows and shows no rating number. Gates: `tsc`
clean, `lint` clean, **70/70** unit, **117/117** E2E, `npm run build` green.

**The finding that shaped F07: `loading.tsx` and a real 404 are mutually
exclusive.** A route `loading.tsx` wraps the page in an implicit `<Suspense>`, so
the response streams and the HTTP status commits to **200 before `notFound()`
runs** — Next's documented behaviour. With it, every draft and dead link returned
200 and would have been indexable; without it, 404. Measured both ways on a
production build. **`loading.tsx` was dropped** and the 404 specs now gate against
exactly that regression (restoring the file fails 4 of them).

**RLS is the 404.** `getListingById` deliberately omits `.eq('is_published',
true)`: the `listings` SELECT policy already returns a draft to its host and to
admins and nothing to anyone else. Proven four ways by SQL impersonation — anon
0 rows, authenticated non-owner 0 rows, owner 1 row, admin 1 row.

**F06 remains green: `/` is a real search-results page.** All six dimensions
(destination, dates, guests, price, property type, amenities) read from
`searchParams`, with a `SearchBar` in the nav (3-segment pill from `tablet:`, a
full-screen overlay below it), a JS-free `FilterPanel`, and a DESIGN.md
`date-picker-day` calendar. Counts verified against the database, not just
against themselves: Kyoto 3, `pool` 3 → `pool,hot_tub` 2 (the AND proof),
treehouse 1, a 5-night window +12→+17 excludes exactly 3, a 2-night window
excludes 4 more on `min_nights`, and a garbage URL still renders all 24. Gates:
`tsc` clean, `lint` clean, **53/53** unit, **73/73** E2E, `npm run build` green.

**The finding that shaped F06: availability cannot be computed in application
code.** RLS scopes `bookings` to the guest, host and admins, so an anon visitor
reads **zero** booking rows — a nested select returns `[]` and every listing
looks free, silently. The date filter is therefore the `security definer` RPC
`unavailable_listing_ids()` (migration `0007`), returning published listing ids
only. Confirmed through the live anon REST API: `GET /bookings` still returns
`[]` while the RPC returns 3 ids — the bypass is the function, not the table.

**F05 remains green:** `/` renders 24 published listings as a responsive grid
(1 / 2 / 4-up) through `getPublishedListings()`, streamed behind `<Suspense>`,
with the 2 drafts hidden by RLS and 4 real averages matching `avg(reviews.rating)`.

Supabase project **NextBnb** (`mbrcgzpmqhmdfhjqytnq`, ap-south-1, free plan) is
live with 7 migrations applied and seeded: 5 demo users, 26 listings (24
published + 2 drafts) across 8 cities, 130 Unsplash photos, 17 bookings, 7
reviews, 5 blocked ranges. Re-run `supabase/seed.sql` any time; verify with
`supabase/tests/seed-verification.sql` (46 assertions). The E2E suite now fails
fast via `e2e/global-setup.ts` if the seed is missing.

Auth is live: `npm run test:e2e` is **11/11** across signed-out and signed-in
flows, using a Playwright fixture (`e2e/session.ts`) that mints sessions through
the email/password provider. `SUPABASE_SERVICE_ROLE_KEY` now holds a real
`sb_secret_…` key (verified by reading draft listings, which RLS hides from the
publishable key).

**The live Google round trip is verified.** The provider is enabled, a real
Google sign-in completed, and the `handle_new_user()` trigger created the
matching `profiles` row with name and avatar — so the F02 metadata coalesce
matches what Google actually sends.

**The first admin exists.** `is_admin` was flipped by hand on the developer's
Google profile (F02's deliberate no-bootstrap-code decision); the project has
exactly one admin. `/admin` and the account menu's Admin entry now open for that
account.

**A Phase 1 close-out pass ran before F05** (2026-07-25). Phase 1 was already
green on all four gates — this closed F04's open *verifications*, not a defect
list. It re-ran `schema-verification.sql` (**37/37**, the re-execution F03 never
did) and confirmed the seed survived it intact, and it replaced the manual
"eyeball the account menu" to-do with `e2e/nav-responsive.spec.ts` (8 specs).
That spec immediately caught a real defect: **every account-menu row was 40px
against the project's own 44px tap-target floor**, at every breakpoint — fixed
with `py-3`. E2E is now **19/19**. Full detail in `build-journal.md`.

**Supabase branching is being switched off until F18** (2026-07-25). The GitHub
integration failed with *"Remote migration versions not found in local
migrations directory"*: F02 applied migrations via the MCP, which stamps
**timestamp** versions server-side, while the repo files were named `0001_`…
`0006_` — and the CLI reconciles on version, not name. The six files are now
renamed to their remote versions (`20260724191157_0001_…` etc., content
untouched, `git mv`), and `supabase/config.toml` exists for the first time
(`supabase init` — the repo was never initialised). Branching stays off because
nothing in `build-plan.md` needs it, branches bill **~$9.70/mo each**, and it
gates every PR on a migration workflow we are not yet using. **The rename is
documented-correct but not observed-working** — confirming it needs `supabase
link` or a push. Detail in `build-journal.md` → F02 follow-up.

**Two F06 nav defects were found and fixed during F07's responsive pass.** Both
predated F07 and were invisible to the suite because `nav-responsive.spec.ts`
sampled only the *middle* of each band. (1) The mobile search pill overlapped the
logo — **59px at 320, 32px at 375, 12px at 414** — because `flex-1` cannot shrink
past `min-width: auto`, so the pill overflowed its centred wrapper. (2) The nav
row overflowed the viewport by **89px across 744–833** (iPad mini, iPad portrait)
because "Become a host" turned on at `tablet:` beside the full 3-segment pill.
Fixes: `min-w-0` on the pill, the wordmark hidden below `tablet:`, and the host
link moved to `desktop:`. The spec now samples each band's **lower boundary** and
asserts nothing overlaps the logo and the row fits — proven to gate by reverting
both fixes (6 failures). Clean at 22 widths from 320 to 1920 on `/` and
`/listings/[id]`.

**Remaining loose ends (small):**
- **A guest cannot check *out* on the day another guest checks *in*.**
  `DateRangePicker.isSelectable` disables every occupied day outright, so although
  the range model permits an unavailable day as a half-open *end* (its straddle
  test says so explicitly), the cell cannot be clicked. One bookable night at each
  boundary is unreachable. The documented invariant — check *in* on another's
  checkout day — does work, and is covered by a spec. Left alone rather than
  widening a `components/ui/` primitive mid-feature.
- **`createBooking`'s past-date branch ships reasoned, not exercised.** The
  calendar never offers a past day, so reaching it needs a forged request. The
  strict floor is unit-reasoned and the message is written.
- **The `23P01` (exclusion constraint) branch never runs in a normal suite.** The
  app-side availability check fires first, so the constraint's own refusal is only
  reachable in a true race — or, as the gate proof showed, by deleting the check.
- **A signed-in third-party guest is unreachable.** F12's "these nights are now
  taken to someone else" is proven against **anon**, which is the stronger
  principal (zero booking rows, no session at all). Proving it for a *signed-in*
  guest who is neither host nor booker needs a third fixture account, since F12's
  listing host and its booker use both.
- **The block-over-booking race has been guarded but never actually *landed*.**
  The spec inserts a booking while the host is deciding and proves `addBlock`
  refuses; what has never been produced is the outcome when the booking arrives
  in the microseconds *after* the guard's read — a block genuinely overlapping a
  confirmed stay. It is benign by design and reachable only by contriving the
  interleaving, so it is documented rather than tested.
- **`addBlock`'s and `removeBlock`'s `{ ok: false }` Supabase-error branches have
  never run** — the guard refusals and the not-found paths are covered; a genuine
  database error is not. The same shape as F10's `updateListing`/`deleteListing`,
  F08's `setFavorite` revert and F05's untriggered `error.tsx`.
- **The 365-day block ceiling is unit-tested only.** Reaching it through the
  calendar means ~365 "Next month" clicks, so the E2E leaves it alone.
- **`blocked_dates_update_own_listing` is now a knowingly unused policy.** F11
  only ever inserts and deletes — widening a block is remove-and-re-add by
  design — so the UPDATE policy is live in the database with no caller. Worth
  knowing before someone reads it as evidence that editing a block is supported.
- **No keyboard or screen-reader pass on the availability calendar.** It inherits
  F06's gap exactly: the day cells are real buttons and tabbable, but the
  `role="grid"` arrow-key roving-focus pattern is not implemented, and a 40-cell
  tab sequence per month is not a usable path. F18 owns it.
- **F08's failure path has never run.** `SaveButton`'s revert-and-announce branch
  needs `setFavorite` to return `{ ok: false }`, which needs an induced Supabase
  error. Same shape as F05's never-triggered `error.tsx`.
- ~~`toFavoriteCards`' null-embed drop, `/favorites`' empty state, and `/admin`'s
  admin-side render~~ — **all three closed by the Phase 3 close-out's second
  fixture account** (2026-07-26). Open since F04.
- **`updateListing`'s and `deleteListing`'s failure paths have never run** — the
  `{ ok: false }` branches after a genuine Supabase error, as opposed to the
  guard refusals, which are covered. Same shape as F08's `setFavorite` revert and
  F05's untriggered `error.tsx`.
- **`deleteListing`'s Cloudinary `destroy` has only ever run against fabricated
  public_ids.** The suite never uploads (`code-standards.md`), so every fixture
  photo row points at an asset that does not exist — the destroy is called, fails,
  and is logged exactly as designed, but a *successful* multi-asset destroy on a
  listing delete has only been reasoned about. The same fabricated ids also make
  `CldImage` log "Resource not found" through the host grid during E2E runs; it is
  test-data noise, not a defect, and it appeared only because F09's follow-up gave
  the project real Cloudinary credentials.
- **Editing before hydration loses the edit, for a real user too.** Clearing a
  field and submitting inside the hydration window saves the server-rendered
  default instead — inherent to an SSR'd RHF form seeded from `defaultValues`,
  narrow enough to leave alone, and worth knowing before it is reported as a bug.
- **Disable the GitHub integration** in the Supabase dashboard (Project Settings
  → Integrations) — a dashboard action, no MCP tool for it. **The branch status
  has moved on since F02 recorded it:** the Supabase branch `main` now reports
  `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`, not `MIGRATIONS_FAILED`. What changed
  it was not observed, so this is **not** evidence that the F02 migration rename
  works — that remains documented-correct and unverified. It is the default
  branch on the project's own ref (`persistent: false`), so no preview-branch
  billing is accruing, and the production database is unaffected either way.
- **`/admin`'s admin-side render is now covered, but only as a placeholder.** The
  spec proves the route gate opens and closes with `is_admin`; F17 still owns
  asserting on a dashboard once there is one.
- Cancelling at the Google consent screen (`access_denied` → home, no error
  banner) has not been exercised — it needs a human to click Cancel.
- **The security advisor baseline is 7 WARNs** (5 before F12). Three are inherited: `authenticated`
  must hold EXECUTE on `is_admin()` and `admin_list_users()` (both load-bearing),
  and leaked-password protection is disabled because it is **Pro-plan-only** — it
  appeared when F04 enabled email/password auth for the Playwright fixture, which
  also leaves email registration reachable via the Auth API (`disable_signup: false`)
  despite the app offering Google only. Low severity, no privilege path; the fix is
  a separate Supabase project for E2E in F18. **F06 added two**: anon and
  authenticated can both execute the `unavailable_listing_ids()` definer function.
  That is the design — anon search must filter by dates — and the function is
  narrowed to published listing ids. **F12 added the last two**, the same pair for
  `listing_occupied_ranges()`: a guest's calendar must render occupancy, and RLS
  shows `bookings` to neither anon nor a non-host guest. It too is narrowed to
  dates on published listings. **An eighth WARN is a finding, not a baseline.**

---

## Progress

### Phase 1 — Foundation
- [x] 01 Project scaffold, design tokens & integrations
- [x] 02 Database schema & RLS
- [x] 03 Seed data
- [x] 04 Google authentication

### Phase 2 — Browse & Discover
- [x] 05 Home & listing grid
- [x] 06 Search & filters
- [x] 07 Listing detail
- [x] 08 Favorites

### Phase 3 — Hosting
- [x] 09 Create listing
- [x] 10 Manage listings
- [x] 11 Availability management

### Phase 4 — Booking
- [x] 12 Instant Book
- [ ] 13 Trips (guest reservations)
- [ ] 14 Host reservations

### Phase 5 — Engagement
- [ ] 15 Reviews & ratings
- [ ] 16 Guest ↔ host messaging

### Phase 6 — Admin & Polish
- [ ] 17 Admin dashboard
- [ ] 18 Responsive QA, polish & deploy

---

## Key Decisions

- **F02 complete** — **RLS filters rows, not columns.** Rules of the form "may update, but only this column" (`profiles.is_admin`, booking price snapshots, message bodies) are enforced by column-level `GRANT`s alongside the policies; "none" cells are revoked outright, because RLS with no matching policy silently updates zero rows and reports success. Verified by `supabase/tests/schema-verification.sql` (37 assertions, all passing).
- **F06** — **RLS can make a feature impossible in application code without ever raising an error.** The date filter looked like ordinary app logic until the `bookings` SELECT policy was read carefully: anon reads *zero* booking rows, so a nested select returns `[]` and every listing reads as available — a wrong answer that arrives as a success. It is now the `unavailable_listing_ids()` definer function (`0007`), returning published ids only. **Generalises: before computing anything from a table, check what the *least* privileged reader of that table can see.** The same trap waits in F12's booking widget.
- **F08** — **a green assertion is not a gating assertion; run every new spec against a deliberately broken build.** `toHaveURL('/')` passes instantly when the page is already at `/`, so the spec guarding "the heart must not navigate" passed against the exact markup it existed to reject. Two further F08 traps rhyme with it: postgrest-js types a to-one embed on a NOT NULL FK as never-null while RLS returns null at runtime (the `toFavoriteCards` filter is load-bearing and TS would never demand it), and a spec that snapshots whole-user state races the parallel workers sharing that user. **Generalises: prove the test fails before trusting that it passes** — and F12/F15's write paths get the same treatment.
- **F07** — **a route `loading.tsx` and a real HTTP 404 cannot coexist.** The implicit `<Suspense>` it creates makes the response stream, and the status commits to **200 before `notFound()` runs** (Next: "a 404 status for non-streamed responses and a 200 for streamed"). Drafts would have been indexable as live pages. `loading.tsx` was dropped; the specs gate against restoring it. **Applies to every future route that can 404** — F13 `/trips`, F14, F17 — so choose the status over the skeleton unless the route can never 404.
- **F09** — **a library that throws on missing config turns a misconfiguration into a 500.** `CldImage` throws without a cloud name and `CldUploadWidget` throws without a *browser-visible* api_key — both during render, so one unset env var took down `/listings/[id]` and `/host/listings/[id]/photos` entirely rather than degrading to a broken image or a dead button. Both are now guarded and fall back. It also surfaced that the Cloudinary **api_key is public** (it rides along with every browser upload) while the **secret** authorises — `NEXT_PUBLIC_CLOUDINARY_API_KEY` is therefore correct and `architecture.md`'s invariant, which names only the secret, still holds. **Generalises: before trusting an integration, render it once with the config absent** — F16's Realtime and F18's deploy have the same shape.
- **F09** — **a validation schema used on both sides of a boundary must accept its own output.** The form validates with `createListingSchema`, posts the *result* to the server action, and the action re-validates with the same schema — so `parse(parse(x))` has to succeed. It did not: the optional-text fields emitted `null` but accepted only `string | undefined`, and every listing with a blank description passed on the client then failed on the server with a message naming no field. **Generalises: whenever one schema guards both a form and the action behind it, test it against its own output** — the two directions are each correct in isolation, which is exactly why nothing else catches it. F12's booking widget shares a schema the same way.
- **F10** — **an FK cascade is a destructive path with no error, no test and no type pointing at it.** `bookings.listing_id` is `on delete cascade`, so a host deleting a listing does not *cancel* its reservations — it erases them, leaving the guest nothing in `/trips` and no record a stay ever existed. Nothing surfaces it: the delete succeeds, RLS permits it, and no assertion covered a table the feature never mentions. It is now guarded in the action (refuse while a confirmed stay is still coming, steer to unpublish), stated in the UI rather than only disabled, and the cutoff is widened by a day so the JS/`current_date` boundary can only ever err toward refusing. **Generalises: before shipping a delete, read the FK actions on every table that references the row — the blast radius is in the schema, not in the feature.** F17's admin delete is the same cascade with the guard deliberately absent, and F11's `blocked_dates` is next.
- **Phase 3 close-out** — **a suite with one account can only ask RLS half of every question, and the half it can ask returns the reassuring answer.** Three gaps stayed open from F04 to F11 for one reason: the Playwright fixture user was the only principal that could sign in, so it was always the host of anything it unpublished, always the sole writer of its own favorites, and never safely flippable to admin. Each gap therefore looked *fine* — the embed was populated, the row count was unassertable, the redirect was the only branch covered. A second account closed all three at once, and the shape generalises past testing: **whenever behaviour depends on who is asking, one identity cannot verify it.** F14's host reservations need a guest who is not the host, and F16's messaging needs two participants — both are this same requirement arriving as a feature. Corollary learned here: a fixture account granted `is_admin` must give it back in a `finally` **and** in global teardown, because fixture passwords are committed and a timeout skips the `finally`.
- **F11** — **a negative assertion needs a positive control, or it passes for the wrong reason.** The spec proving `/host/listings/[id]/availability` 404s for a non-owner named a listing id that did not exist, so the route 404'd because the row was missing — and the spec **passed with `host_id` scoping deleted from the query**. Nothing but the gate proof disagreed. It now uses a real seeded listing and additionally asserts that listing serves **200** on its public page, so the 404 can only mean "not yours"; the RLS half was proven the same way, by checking that the *host* can insert a block with the very probe that refused a non-host. **Generalises: every "X is refused" needs a paired proof that X succeeds when it should — otherwise the refusal may be measuring the setup, not the rule.** F03 learned it from a deliberately invalid Unsplash URL and F09's follow-up from a control probe on the Cloudinary credentials; F12's no-self-booking and past-date refusals, and F15's one-review-per-booking, are the next places it applies.

---

- **F12** — **a guard the database also enforces cannot be gated by a test, and the test will pass anyway.** The spec proving `createBooking` refuses taken dates was written against a *booking* overlap — and it **passed with the availability check deleted**, because `bookings_no_overlap` refused the insert and `23P01` maps to the same sentence the guard produces. The gate had to move to the case no constraint can reach: a booking over a host's `blocked_dates`, where nothing in Postgres expresses a rule spanning two tables. **Generalises: when writing a gate proof, first ask which layer would catch the defect if this layer were missing** — if a lower one would, the spec is measuring that instead. The same reasoning re-priced F12's fixture listing: at $123.00 the service fee is 51660 cents whether you round or truncate, so the cents assertion passed against `Math.floor`; at $123.33 the two answers differ and the spec gates the rounding rule end to end. F13's cancel window (also DB-enforced, via the UPDATE policy) is the next place this applies.

---

## Pruned from Key Decisions (kept for the record)

> - Availability/booking rules are fixed: bookings half-open `[check_in, check_out)`,
>   `blocked_dates` inclusive; no self-booking; fees round half-up in cents; RLS is a
>   per-table matrix in `architecture.md`. *(Pruned in F12 at the ~10-bullet cap — a
>   standing rule rather than a pending decision, and specified in far more detail in
>   `architecture.md` → Availability Rules, Booking Rules and the RLS matrix. F12 is
>   the feature that finally exercised all of it end to end.)*

> - Fully responsive is a hard requirement — custom Tailwind breakpoints
>   (`tablet:744` / `desktop:1128` / `wide:1440`) map phone/iPad/laptop/desktop;
>   mobile-first, grids drop columns. *(Pruned in the Phase 3 close-out at the
>   ~10-bullet cap — a standing rule rather than a pending decision, and stated
>   in three places already: `CLAUDE.md` → Standing rules, `code-standards.md` →
>   Design System & Responsive Standards, and `architecture.md`'s invariants.
>   Every feature since F05 has verified it at each band's lower boundary.)*

> - Visual design system is fixed by `context/DESIGN.md` (Airbnb-style: Rausch
>   `#ff385c` on white, `#222222` ink, Inter as the Cereal VF substitute, soft
>   radii, one shadow tier). Tokens live in `globals.css @theme`. *(Pruned in F11
>   at the ~10-bullet cap — a standing rule rather than a pending decision, and
>   stated in three places already: `CLAUDE.md` → Standing rules, `DESIGN.md`
>   itself, and `code-standards.md` → Design System & Responsive Standards.)*

> - Targets **Next.js 16** → requires Node ≥20.9 (LTS) and TS ≥5.1;
>   `params`/`cookies`/`headers` are async-only. *(Pruned in F09 at the ~10-bullet
>   cap — now stable and fully documented in `architecture.md` → Stack and
>   `CLAUDE.md` → Runtime & Commands.)*
> - Testing is **Vitest (unit) + Playwright (E2E)**; a feature is "done" only
>   when its tests pass. E2E runs against the seeded DB with a seed-verification
>   step. *(Pruned in F10 at the ~10-bullet cap — a standing rule, not a pending
>   decision, and `code-standards.md` → Testing specifies it in far more detail,
>   down to which logic is unit-tested and which flows are E2E.)*
> - Images use **Cloudinary** (signed uploads + `CldImage` responsive delivery),
>   **not** Supabase Storage; `listing_photos` stores `url` + `public_id`.
>   *(Pruned in the F09 follow-up — no longer a pending decision: it is built,
>   verified end to end against the live account, and fully specified in
>   `architecture.md` → Image Storage & Delivery and `library-docs.md` →
>   Cloudinary.)*
