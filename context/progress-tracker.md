# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly.

Update this file after every completed feature. Any AI agent reading this should
immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2 — Browse & Discover
**Last completed:** 07 Listing detail
**Next:** 08 Favorites

**F07 is live: `/listings/[id]` is a real page.** Photo gallery (1+4 mosaic from
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
- **`DraftNotice` has never been rendered by a browser.** RLS returns drafts to
  their owner (proven by SQL impersonation), but both seed drafts belong to fake
  users who cannot sign in and the Playwright fixture user owns nothing. F09/F10
  close it for free by creating a listing owned by a real account.
- **Disable the GitHub integration** in the Supabase dashboard (Project Settings
  → Integrations) — a dashboard action, no MCP tool for it. The Supabase branch
  `main` is parked at `MIGRATIONS_FAILED`; it is inert and the production
  database is unaffected.
- The **admin-side** render of `/admin` is untested automatically — the E2E only
  proves the non-admin redirect. Covering the admin path needs a second test
  user, which belongs to F17 when there is a dashboard worth asserting on.
- Cancelling at the Google consent screen (`access_denied` → home, no error
  banner) has not been exercised — it needs a human to click Cancel.
- **The security advisor baseline is 5 WARNs.** Three are inherited: `authenticated`
  must hold EXECUTE on `is_admin()` and `admin_list_users()` (both load-bearing),
  and leaked-password protection is disabled because it is **Pro-plan-only** — it
  appeared when F04 enabled email/password auth for the Playwright fixture, which
  also leaves email registration reachable via the Auth API (`disable_signup: false`)
  despite the app offering Google only. Low severity, no privilege path; the fix is
  a separate Supabase project for E2E in F18. **F06 added the other two**: anon and
  authenticated can both execute the `unavailable_listing_ids()` definer function.
  That is the design — anon search must filter by dates — and the function is
  narrowed to published listing ids. **A sixth WARN is a finding, not a baseline.**

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
- [ ] 08 Favorites

### Phase 3 — Hosting
- [ ] 09 Create listing
- [ ] 10 Manage listings
- [ ] 11 Availability management

### Phase 4 — Booking
- [ ] 12 Instant Book
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

- Visual design system is fixed by `context/DESIGN.md` (Airbnb-style: Rausch `#ff385c` on white, `#222222` ink, Inter as the Cereal VF substitute, soft radii, one shadow tier). Tokens live in `globals.css @theme`.
- Fully responsive is a hard requirement — custom Tailwind breakpoints (`tablet:744` / `desktop:1128` / `wide:1440`) map phone/iPad/laptop/desktop; mobile-first, grids drop columns.
- Images use **Cloudinary** (signed uploads + `CldImage` responsive delivery), **not** Supabase Storage. `listing_photos` stores `url` + `public_id`.
- Deployment target is **Render** (Web Service). Redirect URLs live in three places: Google console → Supabase `/auth/v1/callback`; Supabase → Render `/auth/callback`; `NEXT_PUBLIC_SITE_URL` = Render URL.
- Targets **Next.js 16** → requires Node ≥20.9 (LTS) and TS ≥5.1; `params`/`cookies`/`headers` are async-only.
- Testing is **Vitest (unit) + Playwright (E2E)**; a feature is "done" only when its tests pass. E2E runs against the seeded DB with a seed-verification step.
- Availability/booking rules are fixed: bookings half-open `[check_in, check_out)`, `blocked_dates` inclusive; no self-booking; fees round half-up in cents; RLS is a per-table matrix in `architecture.md`.
- **F02 complete** — **RLS filters rows, not columns.** Rules of the form "may update, but only this column" (`profiles.is_admin`, booking price snapshots, message bodies) are enforced by column-level `GRANT`s alongside the policies; "none" cells are revoked outright, because RLS with no matching policy silently updates zero rows and reports success. Verified by `supabase/tests/schema-verification.sql` (37 assertions, all passing).
- **F06** — **RLS can make a feature impossible in application code without ever raising an error.** The date filter looked like ordinary app logic until the `bookings` SELECT policy was read carefully: anon reads *zero* booking rows, so a nested select returns `[]` and every listing reads as available — a wrong answer that arrives as a success. It is now the `unavailable_listing_ids()` definer function (`0007`), returning published ids only. **Generalises: before computing anything from a table, check what the *least* privileged reader of that table can see.** The same trap waits in F12's booking widget.
- **F07** — **a route `loading.tsx` and a real HTTP 404 cannot coexist.** The implicit `<Suspense>` it creates makes the response stream, and the status commits to **200 before `notFound()` runs** (Next: "a 404 status for non-streamed responses and a 200 for streamed"). Drafts would have been indexable as live pages. `loading.tsx` was dropped; the specs gate against restoring it. **Applies to every future route that can 404** — F13 `/trips`, F14, F17 — so choose the status over the skeleton unless the route can never 404.
