# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly.

Update this file after every completed feature. Any AI agent reading this should
immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 04 Google authentication
**Next:** 05 Home & listing grid

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

**Remaining F04 loose ends (small):**
- The **admin-side** render of `/admin` is untested automatically — the E2E only
  proves the non-admin redirect. Covering the admin path needs a second test
  user, which belongs to F17 when there is a dashboard worth asserting on.
- Cancelling at the Google consent screen (`access_denied` → home, no error
  banner) has not been exercised.
- The account menu has not been eyeballed at the four DESIGN.md breakpoints.

---

## Progress

### Phase 1 — Foundation
- [x] 01 Project scaffold, design tokens & integrations
- [x] 02 Database schema & RLS
- [x] 03 Seed data
- [x] 04 Google authentication

### Phase 2 — Browse & Discover
- [ ] 05 Home & listing grid
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
- **F01 complete** — hand-authored the Next 16 tree (no `create-next-app`); `lib/supabase/middleware.ts` is config-guarded so the app boots on placeholder Supabase env (real creds deferred to F02/F04); `database.types.ts` is a placeholder until F02; `next-cloudinary`/`zod`/`react-hook-form` deferred to the features that first use them.
- **F03 complete** — **the seed runs as service-role, so RLS enforces nothing while it runs.** Fixture rows that no real user could produce (a review with no matching booking, a host booking their own listing) insert silently. Rows that must obey a rule are therefore *derived* from their parent — bookings select their price snapshot from `listings`, reviews select `listing_id`/`reviewer_id` from `bookings` — and `seed-verification.sql` re-asserts every rule by hand (46/46).
- **F04 complete** — **sessions are shared state; specs that mutate them must own them.** Four signed-in E2E specs reusing one `storageState` meant the sign-out spec deleted that session server-side mid-run, failing its siblings with `session_not_found`. Sign-out specs now mint their own session (`e2e/session.ts`), and `signOut` uses `scope: 'local'` so one browser logging out never revokes another device.
- **F04 complete** — **`@supabase/ssr@0.6.1` silently degraded every typed query to `never`.** The pinned SSR package was ~10 months older than the hoisted `supabase-js`/`postgrest-js` 2.110.8, so the `Database` generic stopped threading through `createServerClient`: `select('*')` on `profiles` returned `never[]`, and the only symptom was one confusing spread error. Upgraded to `0.12.3`. Nothing typed had been written yet, which is why F02/F03 never noticed — F05's first listing query would have hit it head-on.
- **F02 complete** — **RLS filters rows, not columns.** Rules of the form "may update, but only this column" (`profiles.is_admin`, booking price snapshots, message bodies) are enforced by column-level `GRANT`s alongside the policies; "none" cells are revoked outright, because RLS with no matching policy silently updates zero rows and reports success. Verified by `supabase/tests/schema-verification.sql` (37 assertions, all passing).
