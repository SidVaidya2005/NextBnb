# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly.

Update this file after every completed feature. Any AI agent reading this should
immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 01 Project scaffold, design tokens & integrations
**Next:** 02 Database schema & RLS

---

## Progress

### Phase 1 — Foundation
- [x] 01 Project scaffold, design tokens & integrations
- [ ] 02 Database schema & RLS
- [ ] 03 Seed data
- [ ] 04 Google authentication

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
- Seed photos are curated Unsplash direct URLs (`public_id = null`); the deprecated `source.unsplash.com/random` is not used.
- Deployment target is **Render** (Web Service). Redirect URLs live in three places: Google console → Supabase `/auth/v1/callback`; Supabase → Render `/auth/callback`; `NEXT_PUBLIC_SITE_URL` = Render URL.
- Targets **Next.js 16** → requires Node ≥20.9 (LTS) and TS ≥5.1; `params`/`cookies`/`headers` are async-only.
- Testing is **Vitest (unit) + Playwright (E2E)**; a feature is "done" only when its tests pass. E2E runs against the seeded DB with a seed-verification step.
- Availability/booking rules are fixed: bookings half-open `[check_in, check_out)`, `blocked_dates` inclusive; no self-booking; fees round half-up in cents; RLS is a per-table matrix in `architecture.md`.
- **F01 complete** — hand-authored the Next 16 tree (no `create-next-app`); `lib/supabase/middleware.ts` is config-guarded so the app boots on placeholder Supabase env (real creds deferred to F02/F04); `database.types.ts` is a placeholder until F02; `next-cloudinary`/`zod`/`react-hook-form` deferred to the features that first use them.
