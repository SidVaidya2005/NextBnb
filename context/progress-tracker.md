# Progress tracker

> **Role:** Show current work, recorded verification baselines, recent decisions and open questions. Read every session.

## How this file is maintained

Replace Current Status after each completed change. Edit the existing checklist rather than duplicating it. Keep one dated value per baseline, explaining any measured deviation. A local observation, an old measurement and a prediction are different kinds of evidence.

Open work contains unfinished tasks. Remove a completed item after recording its result in the work notes/history. Keep accepted permanent limitations in Standing constraints. Keep unresolved decisions and verification TODOs visible in Open Questions.

Key Decisions shows at most ten references, newest first. The authoritative records live in the declared decision homes. Before removing an old reference, confirm that its reason remains reachable. If moving an authoritative record, classify it by purpose and move its ID and reason together. Never file historical choices as current rules simply to meet the ten-entry limit.

## Current Status

The original 18 features and all six phase checkpoints are complete. The application is in maintenance.

Last completed product change: M1, sanitizing provider error text in the OAuth callback. The checkout contains its merged PR #6 (`7fff5c1`); the previous note calling it uncommitted was stale. GitHub alert closure has not been checked remotely.

Last completed documentation change (2026-10-19): rewrote the README and active guides in plain language, retained `CLAUDE.md` as the sole agent entry point, added 68 decision records and documentation checks, and preserved the journal unchanged. The checker and its 17 failure-detection/acceptance tests passed locally. Completion evidence is in [Documentation rewrite](work-notes.md#documentation-rewrite-2026-10-19). No product behavior, schema, dependency range or deployment is changed.

Latest operations change (2026-10-19): enabled a Supabase keep-alive job in cron-job.org at 09:00 Asia/Kolkata on the 1st, 4th, 7th and subsequent three-day dates through the 31st. It reads at most one published listing directly with a publishable key and emails the account on failure, recovery or automatic disablement. Month boundaries can shorten the interval. Setup and verification are in [Supabase keep-alive](work-notes.md#supabase-keep-alive-2026-10-19).

No new product feature is queued. The four existing maintenance items remain open below. A live check on 2026-10-19 confirmed that [nextbnb-h4ov.onrender.com](https://nextbnb-h4ov.onrender.com) returned HTTP 200 with 24 listings; Supabase reported ACTIVE_HEALTHY and a database count confirmed 24 published listings. This does not replace the historical application test baselines.

## Progress

### Phase 1 — Foundation
- [x] 01 Project scaffold, design tokens & integrations
- [x] 02 Database schema & RLS
- [x] 03 Seed data
- [x] 04 Google authentication
- [x] Phase checkpoint — verification catch-up *(2026-07-25)*

### Phase 2 — Browse & Discover
- [x] 05 Home & listing grid
- [x] 06 Search & filters
- [x] 07 Listing detail
- [x] 08 Favorites
- [x] Phase checkpoint

### Phase 3 — Hosting
- [x] 09 Create listing
- [x] 10 Manage listings
- [x] 11 Availability management
- [x] Phase checkpoint — verification catch-up & the second fixture account *(2026-07-26)*

### Phase 4 — Booking
- [x] 12 Instant Book
- [x] 13 Trips (guest reservations)
- [x] 14 Host reservations
- [x] Phase checkpoint

### Phase 5 — Engagement
- [x] 15 Reviews & ratings
- [x] 16 Guest ↔ host messaging
- [x] Phase checkpoint

### Phase 6 — Admin & Polish
- [x] 17 Admin dashboard
- [x] 18 Responsive QA, polish & deploy
- [x] Phase checkpoint — deploy close-out *(2026-07-29)*

## Live baselines

These are the last recorded application measurements, not results from this documentation session. They remain comparison points. Check their dates and environment before using them as current evidence.

| Check | Last recorded result | Date / qualification |
| --- | --- | --- |
| Typecheck and ESLint | Clean | 2026-07-30; M1 local checks |
| Vitest | 288/288 | 2026-07-30; M1 |
| Playwright, development server | 420 total: 417 passed, 3 skipped, 0 failed; 30 spec files | 2026-07-30, F23; known homepage race did not reproduce on those two runs |
| Playwright, production build | 395 total: 392 passed, 3 skipped, 0 failed | Last recorded at F20; not repeated for F21/F23's added tests |
| Production build | Green; 16 routes and Proxy listed | 2026-07-30, F23 |
| Schema verification | 37 assertions established in F02 | Historical script coverage; not re-run in this rewrite |
| Seed verification | 46/46 after re-seeding | 2026-07-29; relative-date assertions can age out |
| Seed data | 26 listings, 24 published; 130 photos; 17 bookings; 7 reviews; 5 blocks; 0 favorites | 2026-07-29 |
| Whole-table data | 26 listings; 18 bookings; 7 reviews; 1 thread; 1 message; 130 photos; 5 blocks; 0 favorites | 2026-07-30; extra rows were manual testing, not fixture residue |
| Fixture residue | Zero fixture listings, bookings, reviews and threads; one real developer admin | Recorded 2026-07-29; not a fresh database check |
| Security advisors | 8 expected warnings | Last measured 2026-07-29; new warnings require investigation |
| Migrations | 9 local / 9 remote | Last remote comparison 2026-07-29; local count remains 9 |

The eight warnings were recorded as intentional grants to the admin and public-availability helpers, plus the project's password-protection configuration. That is historical evidence about configuration, not a statement that those services or plan limits are unchanged today.

The seed's in-progress booking is relative to the day the seed runs. A later 45/46 result can therefore mean the sample data aged. Inspect the failed assertion before deciding to re-seed. The seed deletes its five sentinel demo users and cascading data, preserving real accounts but removing hand-made rows attached to demo listings. Do not run it merely to refresh a number in this file. See D-045 and the [Original baseline notes](../docs/reference/maintenance-notes.md).

Current documentation checks are separate from these product baselines. Their commands and coverage are in [Documentation checks](documentation-checks.md), with the actual rewrite results in [Work notes](work-notes.md#documentation-rewrite-2026-10-19).

## Open work

1. A human screen-reader pass. F20 fixed static naming problems, but announcements need listening: booking confirmation, incoming messages while another surface is open, and delete/confirm swaps. The seven-step listening procedure is in the journal's F20 entry.
2. A separate Supabase project for E2E, so production can disable the email/password provider used by fixtures. Turning all signups off would also block new Google accounts. This was deliberately outside F18.
3. Check and disable the Supabase GitHub integration through its dashboard, as previously planned. The old branch health state improved without an observed cause. The claimed absence of preview-branch billing is a dated observation, not a check performed here.
4. Fix the homepage image assertion racing parallel listing publishers. It assumes the newest card uses the seed-image branch; a fixture with a fabricated non-null Cloudinary ID can become that newest card. Original candidate fixes were to target a known seed listing, accept either legitimate image branch, or change the fixture default. No fix was chosen or implemented in this rewrite. Reproduce it before claiming the guard works.

The old host-management production refresh defect and message inbox-ordering test race were both closed by F19. They are separate from item 4. Their hypotheses, corrections and measured outcomes remain in the journal and preserved maintenance notes.

## Open Questions

No unanswered product or layout choice was introduced by this rewrite. These verification gaps remain visible:

- [Library evidence TODO](library-docs.md#evidence-and-limits): current API examples cannot be refreshed without Context7. This does not block prose, navigation or local documentation checks; it blocks claiming refreshed vendor API guidance.
- TODO: recheck GitHub alert #1 after the merged M1 change; local code and merge history do not prove the remote alert is closed.
- Cloudinary transform delivery, real asset destruction and human screen-reader behavior remain unverified as described in Standing constraints. The older production-build baseline does not cover the latest added E2E tests.

## Key Decisions

Newest first; these are references to authoritative records in [Decision records](decisions.md), with fuller source explanations preserved. New decisions displace references here without deleting knowledge.

- D-069: query Supabase directly every three calendar days using the existing external scheduler.
- D-068: link to local implementations and keep missing current library evidence explicit.
- D-067: preserve the existing change, verification and commit workflow during the rewrite.
- D-066: preserve detailed pre-rewrite notes as indexed references with byte checks.
- D-065: use stable decision IDs, classify older choices and preserve their reasons.
- D-064: use an automated documentation checker and demonstrate failure detection.
- D-063: keep essential reading under 40,000 estimated tokens.
- D-062: leave the journal unchanged for this rewrite.
- D-061: write plain explanations for all audiences and apply humanizer.
- D-060: retain `CLAUDE.md` as the only agent entry point.
