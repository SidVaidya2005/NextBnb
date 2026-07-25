# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly.

Update this file after every completed feature. Any AI agent reading this should
immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 2 — Browse & Discover
**Last completed:** 05 Home & listing grid
**Next:** 06 Search & filters

**F05 is live: the app renders real data for the first time.** `/` now shows all
24 published listings as a responsive card grid (1 / 2 / 4-up), read through
`lib/queries/listings.getPublishedListings()` and streamed behind a `<Suspense>`
skeleton. Verified against the database: 24 cards, 24 unique detail links, the 2
drafts absent (RLS), 20 "New" badges and 4 real averages (2× 4.5, 2× 4.0) exactly
matching `avg(reviews.rating)`. Gates: `tsc` clean, `lint` clean, **23/23** unit,
**32/32** E2E, `npm run build` green with `/listings/[id]` in the route table.

Supabase project **NextBnb** (`mbrcgzpmqhmdfhjqytnq`, ap-south-1, free plan) is
live with 6 migrations applied and seeded: 5 demo users, 26 listings (24
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

**Remaining loose ends (small):**
- **Disable the GitHub integration** in the Supabase dashboard (Project Settings
  → Integrations) — a dashboard action, no MCP tool for it. The Supabase branch
  `main` is parked at `MIGRATIONS_FAILED`; it is inert and the production
  database is unaffected.
- The **admin-side** render of `/admin` is untested automatically — the E2E only
  proves the non-admin redirect. Covering the admin path needs a second test
  user, which belongs to F17 when there is a dashboard worth asserting on.
- Cancelling at the Google consent screen (`access_denied` → home, no error
  banner) has not been exercised — it needs a human to click Cancel.
- **The security advisor baseline is 3 WARNs, not F02's 2.** The third is
  leaked-password protection, disabled because it is **Pro-plan-only**. It
  appeared when F04 enabled email/password auth for the Playwright fixture,
  which also leaves email registration reachable via the Auth API
  (`disable_signup: false`) despite the app offering Google only. Low severity,
  no privilege path; the fix is a separate Supabase project for E2E in F18.

---

## Progress

### Phase 1 — Foundation
- [x] 01 Project scaffold, design tokens & integrations
- [x] 02 Database schema & RLS
- [x] 03 Seed data
- [x] 04 Google authentication

### Phase 2 — Browse & Discover
- [x] 05 Home & listing grid
- [ ] 06 Search & filters
- [ ] 07 Listing detail
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
- **Phase 1 close-out** — **a "verify it looks right" to-do is a defect waiting to happen; make it a spec.** F04 deferred the account-menu breakpoint check to a manual eyeball. Converting it to `e2e/nav-responsive.spec.ts` immediately exposed a 40px tap target against the project's own 44px floor — present at *every* breakpoint, invisible from reading the JSX, and only findable by measuring the rendered box. Responsive checks are now assertions, not intentions.
- **F05** — **listing photos render through `next/image`, not `CldImage`, and that is not yet a violation.** Every photo in the database is a seed Unsplash URL with `public_id = null`, so the "never a bare `<img>` for a Cloudinary asset" invariant has nothing to bite on and `next-cloudinary` stays uninstalled. **F09 owns the debt**: the first real upload makes `ListingCard` need a `public_id ? CldImage : Image` branch. Until then the card passes `sizes` + `priority` on the first row and gets responsive delivery from the Next optimizer.
