# Build record

> **Role:** Locate the original 18 completed features, their reasons and completion checks. Read a feature before changing the code it produced; this is not the queue for new work.

## How this file is maintained

Keep the original feature numbers, phases and completion state. These entries describe what shipped rather than treating the original plan as a current instruction. Preserve detailed plans, deviations, failed hypotheses and measurements in the linked historical records. New maintenance belongs in the tracker and work notes.

The full original plan is preserved byte-for-byte within [Original build record](../docs/reference/build-record.md). The [Build journal](build-journal.md#feature-log) retains the original dated implementation history. These links are the detailed source for every summary below. The Verify paragraphs describe expected behavior when revisiting a feature; this rewrite did not rerun those product checks.

## Build order

The application was built foundation first: schema, authorization, authentication and seed data came before feature pages. Each feature then connected its interface to real data and ended with relevant tests. Design and responsive work accompanied features rather than waiting entirely for final polish.

## Phase 1 — Foundation

### 01 Project scaffold, design tokens & integrations

The application shell established Next.js, strict TypeScript, Tailwind tokens, Inter, Supabase factories and upload signing. Integrations were added when first needed rather than installing every runtime package immediately.

Decisions: D-002, D-003, D-020. Detailed source: the matching F01 entry in the journal and original build record.

**Verify:** Run typecheck, lint and the unit suite; the app shell renders and the proxy is listed in a production build.

### 02 Database schema & RLS

Nine tables, database constraints, policies, grants and realtime publication established the access model before pages used it. Column grants closed paths that row policies alone could not restrict. Applied migrations are retained; filename identities were later aligned with the remote history.

Decisions: D-006, D-018, D-019. Detailed source: the matching F02 entry in the journal and original build record.

**Verify:** Run the schema-verification SQL: all 37 assertions pass against the intended test project; compare migrations and generated types.

### 03 Seed data

Five sentinel users, 26 listings, 130 photos, bookings, reviews and blocks create a useful catalogue. Sample dates are relative to seed time, not recalculated every day. No admin, favorite or thread is seeded. Replacement can cascade through manual rows attached to sample listings.

Decisions: D-045, D-047. Detailed source: the matching F03 entry in the journal and original build record.

**Verify:** Run the seed-verification SQL: 46 assertions pass immediately after a correctly provisioned seed, including its in-progress stay. Investigate ageing before re-seeding.

### 04 Google authentication

Server-side Google sign-in, safe return paths, session refresh and protected routes made account flows usable. Placeholder protected pages and the admin route guard were brought forward. Automated fixtures use email/password separately from the Google UI.

Decisions: D-012, D-013, D-017, D-025. Detailed source: the matching F04 entry in the journal and original build record.

**Verify:** Run e2e/auth.spec.ts and e2e/second-user.spec.ts: signed-out gates, safe redirects and non-admin refusal pass. Complete a real Google round trip separately.

## Phase 2 — Browse & Discover

### 05 Home & listing grid

Published listings render as a responsive photo grid with prices and average ratings. Unreviewed listings show New rather than a zero rating. External seed photos originally delayed Cloudinary delivery until real uploads existed.

Decisions: D-015, D-020. Detailed source: the matching F05 entry in the journal and original build record.

**Verify:** Run e2e/home.spec.ts and e2e/home-responsive.spec.ts: published cards and the expected grid are present; account for the separately tracked image assertion race.

### 06 Search & filters

URL filters drive city, dates, capacity, price, type and amenities. Availability moved into a narrow database helper because anonymous bookings reads return no rows. Invalid URL fields degrade independently and a partial date range does not filter availability. Empty exclusion sets skip tuple filters.

Decisions: D-007, D-009, D-051. Detailed source: the matching F06 entry in the journal and original build record.

**Verify:** Run e2e/search.spec.ts and e2e/search-responsive.spec.ts: matching published stays remain, occupied stays are excluded, checkout-day turnover works and malformed URL fields do not crash search.

### 07 Listing detail

Photos, amenities, host details, reviews and a booking shell replaced the placeholder. A real 404 took priority over a route loading skeleton. The gallery uses one responsive tree, and navigation width defects were corrected at breakpoint boundaries.

Decisions: D-021, D-036. Detailed source: the matching F07 entry in the journal and original build record.

**Verify:** Run e2e/listing-detail.spec.ts, e2e/listing-detail-responsive.spec.ts and e2e/nav-responsive.spec.ts: permitted pages render, hidden/missing listings return 404, and the gallery/navigation fit.

### 08 Favorites

Saving sends the desired state instead of toggling an unknown current value. The heart sits outside the card link, saved state travels with reads, and hidden listings are removed from the favorites view. Local state avoids snapping back to stale props.

Decisions: D-022, D-029. Detailed source: the matching F08 entry in the journal and original build record.

**Verify:** Run e2e/favorites.spec.ts and e2e/favorites-responsive.spec.ts: saving does not navigate, removing persists, anonymous users sign in and inaccessible listings disappear.

## Phase 3 — Hosting

### 09 Create listing

The host creates a complete draft before uploading, because the signature route must authorize an existing owned listing. Photos support move controls and a cover, and publishing requires at least one photo. Shared nullable schemas and configuration fallbacks were fixed during the real upload follow-up.

Decisions: D-027, D-044, D-048, D-050. Detailed source: the matching F09 entry in the journal and original build record.

**Verify:** Run e2e/host-listings.spec.ts and e2e/host-listings-responsive.spec.ts: create, ownership, photo management and publication rules pass. Verify a real signed upload separately; fixture rows do not prove delivery.

### 10 Manage listings

The host can edit, publish, unpublish and delete. Deletion refuses while protected reservations exist because cascading would erase stays. Details and photos remain separate surfaces; deletion uses an inline confirmation. Production refresh behavior was corrected later in F19.

Decisions: D-023, D-042, D-049. Detailed source: the matching F10 entry in the journal and original build record.

**Verify:** Run e2e/host-manage.spec.ts and e2e/host-manage-responsive.spec.ts: edits and publication persist, protected deletion refuses, and confirmed permitted deletion removes the listing. Repeat affected refresh checks against production mode.

### 11 Availability management

A sibling availability page reuses the calendar with inclusive block ranges. Known overlaps are refused, blocks are removed through named list controls, and editing means remove/re-add. A booking arriving after the block read remains an accepted cross-table race.

Decisions: D-007, D-028, D-057. Detailed source: the matching F11 entry in the journal and original build record.

**Verify:** Run e2e/host-availability.spec.ts and e2e/host-availability-responsive.spec.ts: one-day inclusive blocks work, booked/blocked overlaps refuse and removal frees the intended dates.

## Phase 4 — Booking

### 12 Instant Book

The listing calendar reads occupied ranges from the database helper. The action enforces minimum nights, capacity, current dates and blocked-date overlap, then stores the confirmed price snapshot. Failed availability disables reservation rather than claiming dates are free. The mobile bar opens a sheet; it never reserves by itself.

Decisions: D-005, D-008, D-009, D-028. Detailed source: the matching F12 entry in the journal and original build record.

**Verify:** Run e2e/booking.spec.ts and e2e/booking-responsive.spec.ts plus pricing/schema unit tests: reserve succeeds for a valid stay, rejects each applicable rule and preserves whole-cent fee rounding.

### 13 Trips (guest reservations)

Trips explicitly filters by guest because RLS also admits hosts and admins. Upcoming includes confirmed stays whose checkout has not passed; a started stay can remain there without a cancel control. Cancelled bookings are Past. A reservation card remains visible even if its listing embed becomes inaccessible.

Decisions: D-010, D-024, D-055. Detailed source: the matching F13 entry in the journal and original build record.

**Verify:** Run e2e/trips.spec.ts and e2e/trips-responsive.spec.ts: role scoping, temporal sections, cancellation refusal/success and retained booking details behave correctly.

### 14 Host reservations

Two flat chronological sections replaced the proposed per-listing grouping so a host can see who arrives next. The page is read-only under the database policy. It distinguishes the guest total, service fee and simulated host earnings, suppressing earnings for cancelled rows. Scope-defining listing IDs are uncapped.

Decisions: D-035, D-043, D-051, D-055. Detailed source: the matching F14 entry in the journal and original build record.

**Verify:** Run e2e/host-reservations.spec.ts and e2e/host-reservations-responsive.spec.ts: only owned listings' stays appear, the order and earnings are correct, and no host cancellation control is offered.

## Phase 5 — Engagement

### 15 Reviews & ratings

Guests rate completed stays using a native radio group and may supply an optional comment. One review per booking is enforced by the unique key; review bodies are immutable. Shared star display moved into a UI primitive, with its naming defect corrected later by F20.

Decisions: D-011, D-027, D-039. Detailed source: the matching F15 entry in the journal and original build record.

**Verify:** Run e2e/reviews.spec.ts and the review-schema unit tests: eligibility, duplicate refusal, delete/re-post behavior and computed display names pass.

### 16 Guest ↔ host messaging

Guests initiate a thread from a listing; repeat clicks converge, possibly leaving an empty thread. Hosts reply. The open thread receives live events; the inbox updates on revisit. Read receipts are best-effort. The policy and thread-uniqueness limitations remain documented.

Decisions: D-030, D-031, D-032, D-058. Detailed source: the matching F16 entry in the journal and original build record.

**Verify:** Run e2e/messages.spec.ts and e2e/messages-responsive.spec.ts: participants exchange messages, strangers cannot read them, receipts are idempotent and inbox ordering waits for its timestamp update.

## Phase 6 — Admin & Polish

### 17 Admin dashboard

Admin users, listings and bookings share one page. Unpublish uses a narrow helper; destructive admin deletion has its own role check and states its cascade. Cancellation reuses the shared transition. One spec file owns the fixture admin flag to avoid parallel races.

Decisions: D-026, D-033, D-034, D-035, D-056. Detailed source: the matching F17 entry in the journal and original build record.

**Verify:** Run e2e/admin.spec.ts: non-admins are refused, moderation has its intended scope and cleanup revokes fixture privilege. Compare the schema and security-advisor baseline after SQL changes.

### 18 Responsive QA, polish & deploy

Existing responsive tests confirmed most layouts; focus management was the main implementation work. Two hooks cover dismissal and two-step controls. Calendar grid navigation, a separate test database and several verification gaps were deferred. Deployment closed only after real Google sign-in and host flows worked.

Decisions: D-014, D-038, D-040, D-041, D-042. Detailed source: the matching F18 entry in the journal and original build record.

**Verify:** Run relevant responsive/keyboard specs and the full appropriate product checks; test a production build and the runbook's real redirect/sign-in checks. A runbook alone does not prove deployment.

## Later maintenance

F19 fixed production host-listing refresh, re-seeded dated fixtures and attributed the inbox-ordering test race. F20 corrected static accessible names and documented the still-needed listening pass. F21 added skip navigation and landmarks. F22 rewrote the original README and captured its assets. F23 added the footer and fixed the regressions it exposed. M1 sanitized callback log input and is merged as PR #6.

Their detailed completion evidence remains in the journal. Current open items are in [Open work](progress-tracker.md#open-work), and work after this rewrite is described in [Work notes](work-notes.md). All 18 original features and six checkpoints remain complete in the tracker.
