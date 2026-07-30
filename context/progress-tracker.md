# Progress Tracker

> **Role:** Live status — what is shipped, what the current baselines are, and what work is still open.
> **Read at the start of every session**; **update after every completed change.**
> **Relates to:** mirrors `build-plan.md`. Narrative — decisions, gotchas, verification —
> lives in `build-journal.md`; this file stays short enough to read in full at session start.

## How this file is maintained

- **Current Status is overwritten, never appended.** It describes only the latest state. The record of what happened lives in `build-journal.md` → Feature Log.
- **Progress checkboxes are edited in place.** Never restate, duplicate, or re-list the checklist.
- **Live baselines are replaced, not accumulated.** One row per gate, holding the current number. A deviation from a baseline is a finding to investigate, not a new number to write down.
- **Open work is a worklist, not an archive.** An item leaves this file when it is done or when it is reclassified as permanent — a limitation that will not be fixed belongs in `build-journal.md` → Standing Constraints, filed under its topic.
- **Key Decisions holds the 10 most recent, newest first.** When adding an 11th, file the oldest bullet under its topic in `build-journal.md` → **Standing Constraints**. Eviction is a move, never a delete — an old decision can still bind.

---

## Current Status

**Phase:** All six phases complete — the project is **shipped and in maintenance**.
**Last completed:** F23 — the site footer, which `DESIGN.md` had specified as `footer-light`
since F01 and nothing had ever built: a `contentinfo` landmark with a `<nav aria-label="Footer">`
of six real routes, attribution, source link and a simulated-bookings notice, plus
`flex-1` on `<main>` so it sits at the floor of a short page, plus portfolio / LinkedIn / email
attribution. 15 new Playwright tests, **9 gate proofs**, two regressions it caused in the
existing suite and one latent flake in its own new spec — all three found by full-suite runs and
all three fixed *(2026-07-30, branch `feat/site-footer`, PR #5 — **open**)*. Before it, F22 — `README.md`
rewritten from a 98-line developer note into a 370-line layered document, plus
`docs/screenshots/`: 8 screenshots and a 13-second booking-flow GIF, captured by a temporary
Playwright harness that deleted itself and its rows afterwards *(2026-07-30, branch
`docs/readme-rewrite`, **merged** as PR #4)*.
**Next:** no feature work queued. Four items open in Open work; none blocks the build.
**One live deviation from the baselines below:** the whole-table-counts row, which was stale
rather than moved and is now corrected with its cause attached. Item 4's `e2e/home.spec.ts`
race did **not** fire on either F23 full run — that is consistent with an intermittent, not
evidence it is gone.

Live at **https://nextbnb-h4ov.onrender.com**, with Google sign-in completing and the
host create → publish → unpublish → delete flow hand-verified against the deployment.
F18 closed on its own stated criterion — the live URL works, sign-in included — not on
the runbook landing.

**F19 closed F18's largest open item, and the answer was a product defect rather
than the suspected test-side race.** A `<Suspense>` boundary on `/host/listings`
made `router.refresh()`'s RSC response streamed, and against a production build
that stream is aborted before the boundary content arrives — so the transition
never commits and the row shows pre-mutation state, with disabled controls, long
after the database write has landed. `next dev` does not stream it that way,
which is why the suite was green for eight features. Removing the boundary takes
the production-build suite to **392 passed / 0 failed, matching the dev baseline
exactly** *(both numbers are the 395-test suite as it stood at F19–F20; F21 has since
taken the dev suite to 405 tests and the production run has not been repeated — see
Live baselines)*. Full detail, including the two rejected hypotheses and the 15-second
repro recipe: `build-journal.md` → F19.

**Deployed 2026-07-29 (PR #1).** Verified anonymously against the live URL after the
merge: `/` 200, all protected routes 307, a missing listing a true 404, **24 published
listings** matching the re-seed baseline, `?city=Kyoto` 3, zero "Airbnb" strings.
**Not verified, and it is the one that matters most for F19:** `/host/listings` is behind
auth, so an anonymous probe cannot see the route the fix actually changed. Confirming it
needs a signed-in publish/unpublish against the deployment — the runbook's step 5 check,
still outstanding.

---

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

---

## Live baselines

Current as of 2026-07-30 for the five gates F21 re-ran (tsc, lint, unit, e2e, build). The
database rows are 2026-07-29 and not re-measured for F21: **F21 changed no SQL**, so advisors
and the migration count are carried forward by that reasoning — see the note under the table.
The seed count, whole-table counts, and fixture-residue rows below are also from 2026-07-29;
they were not re-checked either, and F21's full 405-test run (including one failure) is
exactly the kind of run that can leave fixture residue behind.
**Treat any deviation as a finding, not a new normal.**

| Gate | Value |
| ---- | ----- |
| `npx tsc --noEmit` / `npm run lint` | clean |
| `npm run test` (unit) | 288/288 |
| `npm run test:e2e` (dev server — the committed config) | **420 total — 417 passed / 3 skipped / 0 failed** across **30 spec files** *(2026-07-30, F23, measured on the final tree)*. Was 405 before F23's 15 new footer tests; +15 exactly, so both new spec files registered in full. **The `e2e/home.spec.ts:31` race (Open work item 4) did not fire on either F23 run.** It remains open: two green runs are what an intermittent looks like, not a fix. If that test fails on a future run, it is that race, not a new regression |
| Longest-standing flake | **one open, attributed rather than mysterious.** `e2e/home.spec.ts:31` failed on one F21 full run (401/3/1), then passed on a later run of the same suite (402/3/0) **and 8/8 in isolation** — the signature of a race, not a break. Nothing between those runs touched that spec, its query, or the fixture it collides with. Mechanism traced to source in four steps — grid `created_at DESC`, `addListingPhotoRow`'s non-null `public_id` default, the `CldImage` branch — and written up as Open work item 4 with three candidate fixes, none chosen. Pre-existing and latent since the fixture was written; F21 plausibly shifted the timing that exposes it. *(The `messages.spec.ts` inbox-ordering intermittent, open F16→F19, was a test-side read-too-early and is fixed — that one is genuinely closed.)* |
| `npm run test:e2e` against a **production** build | **392 passed / 3 skipped / 0 failed** — last measured at F20, against the 395-test suite; **not re-run for F21**, so this row predates the 10 new tests. Matched the dev baseline exactly at the time. Was 3–4 failed in `host-manage.spec.ts` (Suspense/`router.refresh()`) plus the intermittent `messages.spec.ts` inbox flake; both root-caused and fixed |
| `npm run build` | green, **16 routes**, `ƒ Proxy (Middleware)` printing |
| `seed-verification.sql` | **46/46** — re-seeded 2026-07-29 |
| Seed rows | 26 listings (24 published) / 130 photos / 17 seeded bookings / 7 reviews / 5 blocks / 0 favorites |
| Whole-table counts | 26 listings / **18** bookings / 7 reviews / **1** thread / **1** message / 130 photos / 5 blocks / 0 favorites — measured 2026-07-30. **Every seed-derived count matches**; the three extra rows are the developer's own hand-testing (Google account `127c885a…`, stamped 2026-07-29 18:45–18:46 UTC, message body `hello`), not fixture residue. The former claim "identical to the seed counts" was false within hours of being written — this row drifts with manual use, unlike the code gates. See `build-journal.md` → F22 |
| Fixture residue after a full run | 0 listings, 0 bookings, 0 reviews, 0 fixture-owned threads, **exactly one admin** (developer's Google account) |
| Security advisors | **8 WARNs — a 9th is a finding** |
| Migrations vs remote | 9/9 matching |

**Security advisors and the migration count were deliberately not re-run for F21** (2026-07-30).
The change touched no SQL anywhere in the `6.21.x` series — no schema, no route, no server action, no
dependency — and both numbers are functions of the database schema and its grants, which it
structurally cannot move. They are carried forward from the 2026-07-29 baseline **by reasoning,
not by measurement**; treat them as unchecked-since-2026-07-29 rather than as re-verified.

**The 8 WARNs are all intentional:** `authenticated` EXECUTE on `is_admin()`,
`admin_list_users()` and `admin_unpublish_listing()` (all three load-bearing, all three
self-guarded on `is_admin()`); leaked-password protection off (Pro-plan only); and
anon + authenticated EXECUTE on each of `unavailable_listing_ids()` (F06) and
`listing_occupied_ranges()` (F12) — occupancy is public in this product and both are
narrowed to published listings.

**`seed-verification.sql` is 46/46 as of the 2026-07-29 re-seed.** It had been 45/46 since
2026-07-27: seeded booking 14 is written `current_date - 2 → current_date + 3`, so the
`temporal: at least one in-progress stay exists` assertion ages out a few days after every
run. That is the file's own documented failure mode (section 9), not a code defect — **and
it will age out again.** Re-running the seed is the fix, and it is cheap; see below.

**Re-seeding is safer than this file used to imply.** The note that it "begins with a
cascading `delete from auth.users`" was true but incomplete: the delete is
`where id in (…)` naming **five sentinel ids** on the `b000` prefix, and the script says so
itself — *"A real Google account has neither prefix and is never touched."* Confirmed
against the live database before running: 5 sentinel users deleted, **4 real users survived,
the single `is_admin` account kept its flag**. What it does erase is any hand-made row
hanging off seeded data — the developer's 2 bookings and 1 empty message thread went with
it, which is why whole-table counts now equal seed counts exactly for the first time. Those
were throwaway test artifacts; if you want to keep such rows, take ownership of a host's
listings first (the recipe is at the bottom of `supabase/seed.sql`).

Verification of the deployment itself — anon route gates, the real-404 rule, the anon
availability RPC, search filters, branding — is recorded in
`build-journal.md` → F18 → *Verified against production*, which is the fuller copy.

---

## Open work

Four items. **None blocks the build**; all are recorded rather than tidied away.

> **Closed 2026-07-29** — *"`messages.spec.ts` › a reply moves its conversation to the top
> of the inbox fails intermittently"*, open since F16 and unattributed through F17 and F18.
> **The spec polled the wrong write.** `sendMessage` INSERTs the message and *then* UPDATEs
> `last_message_at`; the spec gated on the message row, so it proceeded the instant the
> first statement committed and read the column before the second landed — measured
> settling ~130–220ms later. A **test defect, not a product defect**, and `sendMessage` is
> unchanged. The poll now gates on the condition being asserted; gate-proved both
> directions (bump removed → the spec fails; restored → 12/12 on `--repeat-each=10`).
> Detail: `build-journal.md` → F19 follow-up 2.

> **Done 2026-07-29** — *"re-run `supabase/seed.sql` to restore `seed-verification.sql` to
> 46/46"*. Run via the Supabase MCP; verification is **46/46, no failures**, including the
> `temporal: in-progress stay` assertion that had aged out. It will age out again in a few
> days — that is the seed's design (all dates are relative to `current_date`), so treat a
> 45/46 as "re-run the seed", not as a defect.

> **Closed by F19** (2026-07-29) — *"three `host-manage.spec.ts` tests fail against a
> production build under load"*, F18's largest open item. It was **not** a flaky suite and
> **not** load-dependent: a `<Suspense>` boundary made `router.refresh()`'s RSC response
> streamed, and against a production build that stream is aborted before the boundary
> content arrives, so the transition never commits. Removing the boundary from
> `/host/listings` takes the production-build suite to 392 passed / 0 failed. Three things
> this file said about it were wrong — it does not need concurrency (the single file fails
> in ~15s, and serialized still fails one), it was not a test-side race, and the failing set
> is four tests whose membership varies. `hydratedRowFor` remains in the suite, still not
> the fix, still strictly more correct. Full detail: `build-journal.md` → F19.

1. **No screen-reader pass — narrowed by F20's static audit, not closed.** The ARIA half is
   now audited and two real defects are fixed (`StarRating` announced *nothing* on every
   review; `PhotoGallery`'s strip was unnamed). What remains needs a human with VoiceOver,
   because source cannot decide it: whether `BookingWidget`'s confirmation panel announces
   at all (it is the project's only live region that mounts *with* its content), how F16's
   asynchronous message announcement behaves while a focus trap is open, and whether the
   two-step delete/confirm swaps say anything. A seven-step listening script is in
   `build-journal.md` → F20.
2. **A separate Supabase project for E2E**, so production can disable the email/password
   provider outright. This is the real fix for the open-signup finding; F18 scoped it out as
   large enough to rival the rest of the feature. Detail in Standing Constraints → Auth.
3. **Disable the GitHub integration** in the Supabase dashboard (Project Settings →
   Integrations); no MCP tool exists for it. The branch now reports
   `FUNCTIONS_DEPLOYED`/`ACTIVE_HEALTHY` rather than F02's `MIGRATIONS_FAILED`, but what
   changed it was not observed, so the F02 migration rename remains documented-correct and
   unverified. No preview-branch billing is accruing.
4. **`e2e/home.spec.ts:31` — "a card shows a cover photo, a price and a location" — races the
   parallel workers that publish listings.** Surfaced by one F21 full run (401 passed / 3 skipped
   / **1 failed**); a later run of the same suite came back **402 / 3 / 0**, and `home.spec.ts`
   passed **8/8** re-run in isolation. It is **intermittent, not fixed** — nothing between those
   runs touched the spec, its query, or the fixture. **Not a defect
   in F21** — it adds no listing-creating spec — but plausibly surfaced *by* it, because the 3
   new keyboard tests live in `keyboard.spec.ts`, itself one of the 13 spec files that publish
   a listing with a photo row, so that file's timing shifted. The mechanism is confirmed from
   source, not inferred:
   1. The test asserts the **first** card's image `src` matches `/\/_next\/image/`, i.e. the
      `next/image` branch that seed data takes.
   2. `src/lib/queries/listings.ts:192` orders the grid `created_at DESC`, so the **newest**
      published listing holds slot one.
   3. `e2e/fixtures.ts:602` — `addListingPhotoRow` defaults `public_id` to a **non-null**
      fabricated value (`nextbnb/listings/<id>/<hex>`), and **17 spec files call it, 13 of
      which also call `publishFixtureListing`** — those 13 are the ones that can reach slot
      one. *(Counted 2026-07-30 with a call-site grep. F21's own working notes said "ten spec
      files"; that number was never measured and is wrong — recorded rather than silently
      corrected, because a plausible count is how the last two bad greps got in.)*
   4. A non-null `public_id` routes `ListingImage` to `CldImage`, so the `src` is a Cloudinary
      URL and the assertion fails.

   Any worker that publishes a listing with a photo row therefore takes slot one and breaks
   that assertion. **Three candidate fixes, none chosen:** assert against a known *seeded*
   listing rather than "first"; accept either image branch; or default `addListingPhotoRow`'s
   `public_id` to `null` (closest to reality — all 24 seeded listings have `public_id = null`,
   see Standing Constraints → Images). **Deliberately not fixed inside F21**: `CLAUDE.md` says
   not to widen a change, and this is its own change with its own gate proof — the fix must be
   shown to fail without it, which means reproducing the race on demand. The unit, tsc, lint
   and build gates were all unmoved by F21, so this is the only baseline deviation.

---

## Key Decisions

The 10 most recent, newest first. Older decisions are filed by topic in
`build-journal.md` → **Standing Constraints**.

- **F23** — **a whole-suite run is the only thing that can price site chrome, because "global" means every assertion anyone ever wrote against every page.** The footer passed its own 15 tests and both gate-proof batches, then broke two unrelated specs — and neither was a defect in the footer's own terms. First, its `Browse stays` link duplicated the **empty-state CTA** on `/messages`, `/favorites` and `/trips`, so `second-user.spec.ts` hit a strict-mode violation on a locator that had been unambiguous for nineteen features. The label changed rather than the spec: two links with one accessible name is a real defect for anyone listening to a link list, and `getByRole` matches names by **substring**, so only a genuinely different word fixes it. Second, `listing-detail-responsive.spec.ts` asserted the reviews section was in view after `End` on the stated premise that it "is the last thing on the page" — true when written, false the moment anything was rendered after `<main>`. **Generalises: adding chrome to a layout invalidates every spec whose premise was "X is last/first/only", and those premises are recorded in prose comments that no type checker reads.** Sibling finding, and the more useful half: replacing that assertion with a real occlusion check exposed that **the original could never have caught the thing it was named for** — `toBeInViewport()` is satisfied by an element sitting *underneath* a fixed bar, so "the bottom bar never hides the end of the page" was measuring reachability by scroll, not occlusion. Its replacement compares boxes, and gate-proving it (footer `pb-24` → `pb-12`) produced a 25.2px overlap that matches the arithmetic exactly. Third sibling, a trap inside the fix: `boundingBox()` **does not retry**, so the first version of that comparison sampled mid-scroll and reported a 56px overlap that settled to zero a frame later — a fake failure that looked precisely like a real one, and would have been "fixed" by loosening the tolerance. `expect.poll()` is the difference between measuring the layout and measuring the scroll animation. **And the same trap then produced a fake *pass* in F23's own new spec for four consecutive runs**: `footer-responsive.spec.ts` took its three heading positions in three separate `boundingBox()` round trips, which is three different moments — an image finishing above the footer between the first and the third shifts it underneath them, so "groups should share a row" failed at `desktop` under full-suite contention on a layout that was correct. Fixed by reading all three in one `page.evaluate()`. **The rule that covers all three instances: any assertion comparing measured positions must take them in a single frame, and a position read that does not retry is a race whether it currently passes or not.** Fourth sibling, about reading a suite rather than writing one: that same contended run emitted **fifteen-plus 30-second `page.goto` timeouts** across five unrelated spec files, none of them real — a stray dev server still bound to port 3000 plus a machine at load ~6. A clean re-run was 417/3/0. **A wall of `goto` timeouts across unrelated specs is an environment signal, and the genuine failures were the only two that failed fast (0.9s and 2.1s) while every spurious one burned its full timeout.**

- **F22** — **F08's rule extends past tests to any artifact a tool writes for you: the GIF was the right size, the right dimensions and the right frame count, and six of its seven frames had a zero delay.** `sharp().gif({ delay: 1150 })` applies a scalar delay to the **first page only**; every later page gets 0 and renders as fast as the decoder can go. Read back, the file said `delay: [1150,0,0,0,0,0,0]` — a 1.15-second opening frame followed by six frames flashing past in under a second. Nothing about the write failed, no error was raised, and the file would have shipped as a "13-second demo" that is really one frame and a stutter. Its twin arrived from the same inspection: **libvips merges byte-identical consecutive frames into a single page**, so the standard trick of duplicating a frame to hold a beat on screen does *nothing* — 12 captured frames became `pages: 7`. Holds have to be per-frame delays, which means deduplicating first so the delay array lines up with the pages that survive. The build script now asserts `pages === distinct.length` and that no delay is 0, which is the artifact equivalent of a gate proof. **Generalises: when a tool writes a binary you cannot read at a glance, verifying it means parsing it back — file size and dimensions are the two properties that look right in exactly the failure modes that matter.** Sibling finding, and the reason the assets took four passes rather than one: **fixture data is correct and unusable in a screenshot.** `createDraftListing` hardcodes `property_type: 'other'`, `country: 'Testland'` and `amenities: []`, so the first pass produced a perfectly accurate listing page reading "Other in Big Sur, Testland" over "No amenities listed for this stay" — and `addListingPhotoRow` cannot express `public_id = null` (it is `options.publicId ?? <fabricated>`), so a non-null public_id routed `ListingImage` to `CldImage` and every image resolved to a Cloudinary asset that was never uploaded. Every visual moved onto **seeded** data, leaving fixture rows only where the surface structurally requires them, which is the host dashboard alone. That last detail is also independent evidence for Open work item 4's third candidate fix: with `public_id = null` the stored Unsplash URL renders through `next/image` exactly as all 24 seeded listings do — evidence, not a fix, because nothing here reproduces the race. Second sibling, from the baseline check rather than the change: **this tracker's whole-table-counts row was stale, not moved** — 18 bookings / 1 thread / 1 message against a recorded 17 / 0 / 0, all three traced to the developer's own Google account and timestamped the previous evening. **A baseline that is a side effect of manual use has a shelf life; a baseline that only moves when code is edited does not, and the two were sitting in the same table being read the same way.**

- **F21** — **a plausible mechanical story about *which* assertion is load-bearing is not evidence; only the revert is — and this time the story was the plan's own.** The skip link's gate proof was specified as "delete `tabIndex={-1}` from `<main>`, and the focus test must fail", on the reasoning that a fragment link with a non-focusable target leaves focus on the anchor — which made *"the next Tab moved past the navigation"* the strong assertion and *"`#main` is focused"* the weak one. **It passed with `tabIndex={-1}` deleted.** The implementer refused to rewrite the assertion to manufacture a failure and traced why instead: **Chromium implements the HTML Standard's *sequential focus navigation starting point* fixup**, so activating `href="#main"` moves the Tab **origin** to `#main` whether or not that element can hold focus. Measured with `tabIndex` removed: `activeElement` after Enter was `BODY`, and the next Tab still landed on a `<summary>` inside `<main>`. The ordering was exactly inverted — `expect(page.locator('#main')).toBeFocused()` is the assertion that gates `tabIndex={-1}`; the next-Tab check gates **nothing** in the only browser this suite runs (`playwright.config.ts` has one project, `chromium`). Both now ship, with comments naming which is which, and the rule is in `code-standards.md` rather than only here. **Generalises: F08's rule applies to the plan as much as to the code — a gate proof tests the author's reasoning about an assertion, not just the assertion, and "this is the strong one" is a prediction until the revert is run.** Precision note, because two pieces of evidence get conflated easily: Playwright's `toBeFocused()` failure reports only `Received: inactive` and never names the element that *does* hold focus — the `BODY` finding came from a separate `page.evaluate` probe under identical conditions. Sibling finding, and it is F08 again wearing the geometry costume: **`toBeVisible()` cannot test an `sr-only` element's reveal**, because Tailwind's `sr-only` is a 1×1 clipped box that is still in the layout and Playwright counts it as visible — so the 7 breakpoint tests assert measured geometry (tap target ≥44px, both edges ≥0) plus a real hit test, and the pre-implementation run failed on `height: 1` / `x: -1` / `y: -1` rather than on "element not found". Second sibling, a **fragility rather than a fix**: the design predicted `focus:not-sr-only` (`position: static`, confirmed via Context7 against the Tailwind v4 docs) would fight `focus:fixed`, and it does not — in the compiled output `.focus\:fixed:focus` is emitted *after* `.focus\:not-sr-only:focus` in the same `@layer utilities`, so equal specificity lets `fixed` win (`getComputedStyle` reads `"fixed"`). That rests on Tailwind's emitted property order, **not on anything the CSS guarantees**; if an upgrade reorders those utilities, the fix is the documented off-screen slide (`-top-20 focus:top-4`, which never touches `position`). Third sibling: one full-suite run came back **401 passed / 3 skipped / 1 failed** while a later run of the identical suite gave **402 / 3 / 0**, which falsifies this file's "longest-standing flake: none open" — a pre-existing `home.spec.ts` race, attributed in four steps and filed as Open work item 4, not absorbed. **Both numbers are on the record deliberately: the failing run alone reads as a regression this change caused, the green run alone reads as a clean bill of health, and only the pair shows a race.**

- **F20** — **a rule written in the wrong file is a rule that will be broken, and this project broke the same one three times.** F07 shipped `aria-label` on a bare `<div>` latently; F12 found it, fixed it, and wrote the reason into `BookingWidget`'s docblock — *"ARIA ignores an accessible name on a generic element, so `aria-label` on a bare div is announced by nothing"*; then **F15's extraction of `StarRating` reintroduced it verbatim**, because the rule lived in the one place a person building a *different* component would never read. The consequence was not cosmetic: a bare `div` is `role="generic"`, where ARIA *prohibits* a name, and with all five stars `aria-hidden` the rating — the app's central trust signal, and the one element DESIGN.md gives its loudest treatment — was announced as **silence** on every review and every trip card. **Generalises: when a fix turns on a general rule, the fix belongs in the component and the rule belongs in `code-standards.md`; a rule recorded only at its first crime scene is a rule scoped to that crime scene.** Sibling finding, and it is F08's rule wearing a new costume: **two specs asserted the rating's label and both passed the whole time**, because Playwright's `getByLabel()` matches the `aria-label` *attribute* rather than the computed accessible name — so it resolves happily against markup no screen reader can read. The assertion named the right string and tested the wrong layer; `getByRole(role, { name })` is the one that resolves a real name, and swapping to it made the spec fail the moment `role="img"` was removed. Second sibling, from the audit method rather than its findings: **the first sweep produced 14 findings of which 12 were false**, because a grep for `aria-label` on non-button elements flags `<ul>` and `<section>` — both of which legitimately accept a name. An over-broad audit that "finds" a dozen problems in correct markup costs more than no audit, because someone will dutifully edit all twelve.

- **F19** — **a dev-only test strategy is structurally blind to a whole class of production defect, and this project was blind to one for eight features.** `/host/listings` put its grid behind a `<Suspense>` boundary (F05's choice, so the heading paints first). That makes the `router.refresh()` after a mutation a **streamed** RSC response — and against `next build && next start` the stream is aborted after its 200 and before the boundary content arrives, so the transition never commits. `isPending` stays true: every control on the row stays `disabled`, the confirm button reads "Deleting…", and the row keeps showing pre-mutation state for tens of seconds **while the database write has already succeeded**. `next dev` does not stream it that way, so the entire suite was green against the dev server the whole time. **Generalises: "the tests pass" is scoped to the server the tests ran against — and `next dev` and `next start` are different products where streaming, prefetch and caching are concerned.** Three siblings, each worth as much as the fix. First, **the recorded description of a bug can be the thing preventing its diagnosis**: this was documented as needing full-suite concurrency, so every previous attempt paid a 2.3-minute iteration cost for what is a 15-second single-file repro, and it was documented as "points at a test-side race", which is the one conclusion that makes you stop looking at the product. Second, **two confident hypotheses died before the right one** — that the 5s assertion window was too short (re-ran at 20s: still failed, `44 × locator resolved to 1 element`) and that `<Link>` prefetch contention starved the connection pool (added `prefetch={false}` everywhere: still failed) — both reverted, and the discipline that mattered was refusing to stack a third guess on top. Third, **a compelling correlation was a coincidence**: three of four failing tests add photo rows and most passing ones do not, which pointed hard at the 404ing `CldImage` requests — but `:471` fails with zero photos and `:125` passes with one. The invariant was visible in the first five minutes and survived everything: *every failing test asserts on the list re-rendering after `router.refresh()`; no passing test in the file does.* **Fourth sibling, same day, and it makes the first one a pattern rather than an anecdote: the `messages.spec.ts` inbox flake — open since F16, and the project's longest-standing unknown — turned out to be the mirror image.** It had been recorded as *"a product defect… the bump did not land"*, `938c84a` refuted that with a log line, and three fresh candidates were then proposed — all three about the *product*. The answer was none of them: **the spec polled the wrong write.** `sendMessage` INSERTs the message and *then* updates `last_message_at`, and the spec gated on the message row — so it proceeded the instant the first statement committed and read the column ~130–220ms before the second landed. Four features of theorising about a two-statement action, and nobody re-read the eight lines of test around the assertion, because the failure had been *filed* as a product defect at the start and the filing was never reopened. **Generalises: an assertion that fails while its own precondition is provably satisfied is usually reading too early, not reading wrong** — and F17 already held that evidence, in the form of a passing message-count poll it interpreted as "the message sent, so the bump must have too". Taken together with the `<Suspense>` finding, F19's real subject is not either bug: it is that **a written-down diagnosis is load-bearing infrastructure, and a wrong one costs more than no diagnosis**, because it tells every later reader where not to look.
- **F18** — **an accessibility assertion can pass because the behaviour was never exercised, not because it works — and three of five did.** The focus-restore tests opened a surface, pressed Escape, and asserted focus was on the trigger. For a non-modal popover or a menu that passes with **the restore code deleted**, because clicking a trigger leaves focus *on* it and opening moves nothing: the assertion was measuring "focus was never stolen", not "focus was restored". Only moving focus *into* the surface first (`await done.focus()`) makes close-without-restore fall to `<body>` and the test fail. Its twin arrived from the opposite direction: the "this popover is *not* trapped" test passed against a build with the trap wrongly enabled, because a wrapped Tab lands on the popover's **first** control — which is also not the one the assertion named. Asking *containment* ("did focus leave at all") is the only form a trap can fail. **Generalises: for any test of where focus went, ask where focus would be if the feature did nothing — if that is the same place, the test is scenery.** This is F08's rule meeting a state that is invisible in the DOM, which is why seventeen features of responsive specs and screenshots never caught that the project had **no `.focus()` call anywhere in `src/`**. Sibling finding, from reading rather than running: this tracker's own to-do list named "F06's calendar `role="grid"` roving focus" as a surface to audit, and that pattern **was never built** — a to-do describing work as existing is worse than one describing it as missing. **Second sibling, from the deploy: a build-time-inlined variable is invisible to every runtime check, so a configuration error can survive a completely green site.** `NEXT_PUBLIC_SITE_URL` went out as the *callback URL* rather than the origin, making the OAuth `redirect_to` `…/auth/callback/auth/callback` — a 404 — while the grid, every filter, all six route gates, the real-404 behaviour and Render's own health check on `/` stayed green. `NEXT_PUBLIC_*` is compiled into the bundle, so nothing at runtime reads it and nothing can report it stale; the only surface that fails is the one nobody exercises until a user tries to sign in. The generalisation is the verification move, not the variable: **probe the artifact the value produces, never re-read the value** — and that artifact turned out to be shell-reachable, because the sign-in button is a no-JS form post whose action id is a hidden *field name*, so `curl -F` returns a 303 with the whole `redirect_to` on it. One command, no browser, no Google account, and it confirms all three OAuth allow-lists at once. It is now `docs/deploy-render.md` step 5's first item, deliberately placed *above* the human sign-in check it front-runs.
- **F17** — **an OR-shaped policy can be *wider* than the action it backs, and then the action is the only guard — the inverse of this project's usual arrangement.** F17 met it twice in one feature, in opposite directions. `listings_delete_own_or_admin` is `host_id = uid OR is_admin()`, so `adminDeleteListing` — which deliberately drops F10's upcoming-booking guard to keep the spam escape hatch — would otherwise let any *host* route their own listing through it and erase live reservations. Proved by impersonation in SQL, not argued: non-admin host, one upcoming confirmed stay, `delete` returned OK and left zero rows. Meanwhile `listings_update_own` is `host_id = uid` with **no admin branch at all**, so an admin unpublish was an UPDATE matching zero rows and returning `{ error: null }` — F13's trap, sitting in the verb this dashboard is meant to *prefer*, and the build plan had asserted the opposite. **Generalises: for every admin write, ask both halves — "who else does this policy admit?" and "does it admit the admin at all?" The answers are independent, and neither is visible from the action.** The fix for the second was a narrow definer function rather than `or is_admin()` on the policy, because **no column grant restricts listing writes** — widening would have handed an admin `host_id`, i.e. the power to reassign someone's listing. Sibling finding, from actually running the suite: `second-user.spec.ts` had been asserting on `FeaturePlaceholder` copy since F04, so the only test of `/admin` was pinned to scaffolding rather than to behaviour.
- **F16** — **F13's zero-row rule is about what emptiness can *only* mean, not about row counts.** F15 predicted this would be the next place the INSERT/UPDATE distinction bites, and it was — but the answer inverted. `cancelBooking` must treat a zero-row UPDATE as a refusal because that is the only thing it can be. `markThreadRead` filters `sender_id <> me AND read_at is null`, so **zero rows is the ordinary outcome** — every open of an already-read thread legitimately matches nothing — making it the one RLS-scoped UPDATE in the project with **no** zero-row branch. **Generalises: before reusing F13's guard, ask whether the statement's own filters make emptiness normal.** Two siblings from the same feature. First, **an authorization failure in a push channel arrives as silence, not as an error**: Realtime evaluates the table's SELECT policy against the token the *socket* carries, and the browser client adopts its session from cookies asynchronously — so a channel opened on mount connects as `anon`, matches nothing, and reports success, which is indistinguishable from a feature nobody wired up. `setAuth` before `subscribe` is the fix, and a standalone probe is what separated "Realtime is broken" from "our client is anonymous". Second, **an OR-shaped INSERT policy can be looser than the app that uses it**: `message_threads_insert_participant` admits `guest_id = uid OR host_id = uid`, so it would accept a thread naming an arbitrary stranger as the guest — the action derives both participants and never builds such a row, but RLS is not the backstop here, it is the gap.
- **F15** — **"RLS refuses by filtering, not raising" is true of UPDATE and DELETE and false of INSERT — and one feature can need both.** F13's rule sent `cancelBooking` looking for a zero row count, because a refused UPDATE returns `{ error: null }` and looks like success. A refused INSERT does not: a failed `WITH CHECK` **raises `42501`**. So F15's two actions are deliberately opposite shapes — `createReview` maps error codes to sentences (`23505` → already reviewed, `42501` → not finished yet) and has no zero-row branch, while `deleteReview` has the zero-row branch and no code mapping. Writing them alike would have left one silently broken. **Generalises: before reusing a write-path pattern, ask which verb it was learned from** — the three DML verbs fail in genuinely different ways, and only DELETE/UPDATE fail quietly. Its sibling finding came from actually *running* a gate proof: the one for "a stay cannot be reviewed twice" **passed**, because `TripReview` tested `review` before `canReview` and was enforcing one-per-booking a second time, leaving `canReviewBooking`'s `hasReview` argument unreachable. Nothing misbehaved — but the rule had quietly moved out of the function that documents it, and only a proof that was *executed* rather than assumed could show that.
- **F14** — **a policy that admits three principals answers a question none of them asked.** `bookings_select_participant_or_admin` is `guest OR host OR is_admin()`, so the *same row* is legitimately readable by two screens that must never show it to each other — and every query over that table has to say which reader it is for. F13 filtered `guest_id`; F14 filters `listing_id` to owned listings, and its gate proof is F13's inverted: a stay where the fixture user is the **guest** must not surface among their reservations. It failed exactly as intended with the filter deleted, and RLS never would have caught it. **Generalises: RLS scopes to a union of principals, not to a role — so "which of these principals am I rendering for?" is a question the query must answer, never the policy.** Corollary found the same way: read the policy before deciding what a screen *can't* do. "Read-only for the host" looked like scope, but the UPDATE policy names only the guest and `is_admin()`, so a host has no write path to `bookings` at all and a cancel button would need a migration, not a component.
*(F13's decision — "after any RLS-scoped UPDATE or DELETE the row count *is* the authorization
result" — was moved to `build-journal.md` → Standing Constraints → RLS & authorization in F23,
at the 10-bullet cap. It still binds, and F16 already refined it: check first whether the
statement's own filters make a zero-row result the ordinary outcome.)*
*(F12's decision — "ask which layer would catch the defect if this layer were missing" — was
moved to `build-journal.md` → Standing Constraints → Testing & verification in F22, at the
10-bullet cap. It still binds; it is filed beside F08's rule, which is its companion.)*