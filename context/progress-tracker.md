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
**Last completed:** F21 — layout landmarks: `<nav aria-label="Main">` around `TopNav`'s
account cluster, and a skip link whose target is `<main id="main" tabIndex={-1}>`, revealed
on focus above the sticky header and verified at all 7 breakpoints *(2026-07-30, branch
`feat/layout-landmarks`, commits `b72d0af` / `8809c8c` / `88e053d`; 10 new Playwright tests,
4 gate proofs, one of which disproved the plan's own reasoning — see Key Decisions)*. Before
it, F20 — static accessibility audit; two ARIA-on-generic defects fixed (`StarRating` was
announcing nothing on every review) *(2026-07-29, PR #2, merged and **verified live**: 0
div/span elements on `/listings/[id]` carry a name without a role)*.
**Next:** no feature work queued. **Open work item 1 is now down to the screen-reader pass
alone** — F21 shipped the two static findings F20 had left it carrying. Four items are open;
none blocks the build, but item 4 (a newly surfaced, fully attributed `e2e/home.spec.ts`
race) is the one live deviation from the baselines below.

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
database rows are 2026-07-29 and unmoved: **F21 changed no SQL**, so advisors and the
migration count were deliberately *not* re-measured — see the note under the table.
**Treat any deviation as a finding, not a new normal.**

| Gate | Value |
| ---- | ----- |
| `npx tsc --noEmit` / `npm run lint` | clean |
| `npm run test` (unit) | 288/288 |
| `npm run test:e2e` (dev server — the committed config) | **405 total — 401 passed / 3 skipped / 1 failed** *(2026-07-30, F21)*. Was 395 total before F21's 10 new tests; the total is +10 exactly, so both new spec files registered in full. **The 1 failure is item 4 in Open work** — `e2e/home.spec.ts:31`, attributed to a pre-existing parallel-worker race, not to F21 |
| Longest-standing flake | **one open, and it is attributed rather than mysterious.** `e2e/home.spec.ts:31` failed in F21's full run (401/3/1) and passed **8/8 in isolation**. The mechanism is traced to source in four steps — grid order, fixture default, `CldImage` branch — and written up as Open work item 4 with three candidate fixes, none chosen. Pre-existing and latent since the fixture was written; F21 plausibly shifted the timing that exposes it. *(The `messages.spec.ts` inbox-ordering intermittent, open F16→F19, was a test-side read-too-early and is fixed — that one is genuinely closed.)* |
| `npm run test:e2e` against a **production** build | **392 passed / 3 skipped / 0 failed** — last measured at F20, against the 395-test suite; **not re-run for F21**, so this row predates the 10 new tests. Matched the dev baseline exactly at the time. Was 3–4 failed in `host-manage.spec.ts` (Suspense/`router.refresh()`) plus the intermittent `messages.spec.ts` inbox flake; both root-caused and fixed |
| `npm run build` | green, **16 routes**, `ƒ Proxy (Middleware)` printing |
| `seed-verification.sql` | **46/46** — re-seeded 2026-07-29 |
| Seed rows | 26 listings (24 published) / 130 photos / 17 seeded bookings / 7 reviews / 5 blocks / 0 favorites |
| Whole-table counts | 26 listings / 17 bookings / 7 reviews / 0 threads — **identical to the seed counts** since the 2026-07-29 re-seed |
| Fixture residue after a full run | 0 listings, 0 bookings, 0 reviews, 0 fixture-owned threads, **exactly one admin** (developer's Google account) |
| Security advisors | **8 WARNs — a 9th is a finding** |
| Migrations vs remote | 9/9 matching |

**Security advisors and the migration count were deliberately not re-run for F21** (2026-07-30).
That change is three commits of markup and tests — no schema, no route, no server action, no
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
   parallel workers that publish listings.** Surfaced by F21's full run (401 passed / 3 skipped
   / **1 failed**); passed **8/8** when `home.spec.ts` was re-run in isolation. **Not a defect
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

- **F21** — **a plausible mechanical story about *which* assertion is load-bearing is not evidence; only the revert is — and this time the story was the plan's own.** The skip link's gate proof was specified as "delete `tabIndex={-1}` from `<main>`, and the focus test must fail", on the reasoning that a fragment link with a non-focusable target leaves focus on the anchor — which made *"the next Tab moved past the navigation"* the strong assertion and *"`#main` is focused"* the weak one. **It passed with `tabIndex={-1}` deleted.** The implementer refused to rewrite the assertion to manufacture a failure and traced why instead: **Chromium implements the HTML Standard's *sequential focus navigation starting point* fixup**, so activating `href="#main"` moves the Tab **origin** to `#main` whether or not that element can hold focus. Measured with `tabIndex` removed: `activeElement` after Enter was `BODY`, and the next Tab still landed on a `<summary>` inside `<main>`. The ordering was exactly inverted — `expect(page.locator('#main')).toBeFocused()` is the assertion that gates `tabIndex={-1}`; the next-Tab check gates **nothing** in the only browser this suite runs (`playwright.config.ts` has one project, `chromium`). Both now ship, with comments naming which is which, and the rule is in `code-standards.md` rather than only here. **Generalises: F08's rule applies to the plan as much as to the code — a gate proof tests the author's reasoning about an assertion, not just the assertion, and "this is the strong one" is a prediction until the revert is run.** Precision note, because two pieces of evidence get conflated easily: Playwright's `toBeFocused()` failure reports only `Received: inactive` and never names the element that *does* hold focus — the `BODY` finding came from a separate `page.evaluate` probe under identical conditions. Sibling finding, and it is F08 again wearing the geometry costume: **`toBeVisible()` cannot test an `sr-only` element's reveal**, because Tailwind's `sr-only` is a 1×1 clipped box that is still in the layout and Playwright counts it as visible — so the 7 breakpoint tests assert measured geometry (tap target ≥44px, both edges ≥0) plus a real hit test, and the pre-implementation run failed on `height: 1` / `x: -1` / `y: -1` rather than on "element not found". Second sibling, a **fragility rather than a fix**: the design predicted `focus:not-sr-only` (`position: static`, confirmed via Context7 against the Tailwind v4 docs) would fight `focus:fixed`, and it does not — in the compiled output `.focus\:fixed:focus` is emitted *after* `.focus\:not-sr-only:focus` in the same `@layer utilities`, so equal specificity lets `fixed` win (`getComputedStyle` reads `"fixed"`). That rests on Tailwind's emitted property order, **not on anything the CSS guarantees**; if an upgrade reorders those utilities, the fix is the documented off-screen slide (`-top-20 focus:top-4`, which never touches `position`). Third sibling: the full-suite run came back **401 passed / 3 skipped / 1 failed**, which falsifies this file's "longest-standing flake: none open" — a pre-existing `home.spec.ts` race, attributed in four steps and filed as Open work item 4, not absorbed.

- **F20** — **a rule written in the wrong file is a rule that will be broken, and this project broke the same one three times.** F07 shipped `aria-label` on a bare `<div>` latently; F12 found it, fixed it, and wrote the reason into `BookingWidget`'s docblock — *"ARIA ignores an accessible name on a generic element, so `aria-label` on a bare div is announced by nothing"*; then **F15's extraction of `StarRating` reintroduced it verbatim**, because the rule lived in the one place a person building a *different* component would never read. The consequence was not cosmetic: a bare `div` is `role="generic"`, where ARIA *prohibits* a name, and with all five stars `aria-hidden` the rating — the app's central trust signal, and the one element DESIGN.md gives its loudest treatment — was announced as **silence** on every review and every trip card. **Generalises: when a fix turns on a general rule, the fix belongs in the component and the rule belongs in `code-standards.md`; a rule recorded only at its first crime scene is a rule scoped to that crime scene.** Sibling finding, and it is F08's rule wearing a new costume: **two specs asserted the rating's label and both passed the whole time**, because Playwright's `getByLabel()` matches the `aria-label` *attribute* rather than the computed accessible name — so it resolves happily against markup no screen reader can read. The assertion named the right string and tested the wrong layer; `getByRole(role, { name })` is the one that resolves a real name, and swapping to it made the spec fail the moment `role="img"` was removed. Second sibling, from the audit method rather than its findings: **the first sweep produced 14 findings of which 12 were false**, because a grep for `aria-label` on non-button elements flags `<ul>` and `<section>` — both of which legitimately accept a name. An over-broad audit that "finds" a dozen problems in correct markup costs more than no audit, because someone will dutifully edit all twelve.

- **F19** — **a dev-only test strategy is structurally blind to a whole class of production defect, and this project was blind to one for eight features.** `/host/listings` put its grid behind a `<Suspense>` boundary (F05's choice, so the heading paints first). That makes the `router.refresh()` after a mutation a **streamed** RSC response — and against `next build && next start` the stream is aborted after its 200 and before the boundary content arrives, so the transition never commits. `isPending` stays true: every control on the row stays `disabled`, the confirm button reads "Deleting…", and the row keeps showing pre-mutation state for tens of seconds **while the database write has already succeeded**. `next dev` does not stream it that way, so the entire suite was green against the dev server the whole time. **Generalises: "the tests pass" is scoped to the server the tests ran against — and `next dev` and `next start` are different products where streaming, prefetch and caching are concerned.** Three siblings, each worth as much as the fix. First, **the recorded description of a bug can be the thing preventing its diagnosis**: this was documented as needing full-suite concurrency, so every previous attempt paid a 2.3-minute iteration cost for what is a 15-second single-file repro, and it was documented as "points at a test-side race", which is the one conclusion that makes you stop looking at the product. Second, **two confident hypotheses died before the right one** — that the 5s assertion window was too short (re-ran at 20s: still failed, `44 × locator resolved to 1 element`) and that `<Link>` prefetch contention starved the connection pool (added `prefetch={false}` everywhere: still failed) — both reverted, and the discipline that mattered was refusing to stack a third guess on top. Third, **a compelling correlation was a coincidence**: three of four failing tests add photo rows and most passing ones do not, which pointed hard at the 404ing `CldImage` requests — but `:471` fails with zero photos and `:125` passes with one. The invariant was visible in the first five minutes and survived everything: *every failing test asserts on the list re-rendering after `router.refresh()`; no passing test in the file does.* **Fourth sibling, same day, and it makes the first one a pattern rather than an anecdote: the `messages.spec.ts` inbox flake — open since F16, and the project's longest-standing unknown — turned out to be the mirror image.** It had been recorded as *"a product defect… the bump did not land"*, `938c84a` refuted that with a log line, and three fresh candidates were then proposed — all three about the *product*. The answer was none of them: **the spec polled the wrong write.** `sendMessage` INSERTs the message and *then* updates `last_message_at`, and the spec gated on the message row — so it proceeded the instant the first statement committed and read the column ~130–220ms before the second landed. Four features of theorising about a two-statement action, and nobody re-read the eight lines of test around the assertion, because the failure had been *filed* as a product defect at the start and the filing was never reopened. **Generalises: an assertion that fails while its own precondition is provably satisfied is usually reading too early, not reading wrong** — and F17 already held that evidence, in the form of a passing message-count poll it interpreted as "the message sent, so the bump must have too". Taken together with the `<Suspense>` finding, F19's real subject is not either bug: it is that **a written-down diagnosis is load-bearing infrastructure, and a wrong one costs more than no diagnosis**, because it tells every later reader where not to look.
- **F18** — **an accessibility assertion can pass because the behaviour was never exercised, not because it works — and three of five did.** The focus-restore tests opened a surface, pressed Escape, and asserted focus was on the trigger. For a non-modal popover or a menu that passes with **the restore code deleted**, because clicking a trigger leaves focus *on* it and opening moves nothing: the assertion was measuring "focus was never stolen", not "focus was restored". Only moving focus *into* the surface first (`await done.focus()`) makes close-without-restore fall to `<body>` and the test fail. Its twin arrived from the opposite direction: the "this popover is *not* trapped" test passed against a build with the trap wrongly enabled, because a wrapped Tab lands on the popover's **first** control — which is also not the one the assertion named. Asking *containment* ("did focus leave at all") is the only form a trap can fail. **Generalises: for any test of where focus went, ask where focus would be if the feature did nothing — if that is the same place, the test is scenery.** This is F08's rule meeting a state that is invisible in the DOM, which is why seventeen features of responsive specs and screenshots never caught that the project had **no `.focus()` call anywhere in `src/`**. Sibling finding, from reading rather than running: this tracker's own to-do list named "F06's calendar `role="grid"` roving focus" as a surface to audit, and that pattern **was never built** — a to-do describing work as existing is worse than one describing it as missing. **Second sibling, from the deploy: a build-time-inlined variable is invisible to every runtime check, so a configuration error can survive a completely green site.** `NEXT_PUBLIC_SITE_URL` went out as the *callback URL* rather than the origin, making the OAuth `redirect_to` `…/auth/callback/auth/callback` — a 404 — while the grid, every filter, all six route gates, the real-404 behaviour and Render's own health check on `/` stayed green. `NEXT_PUBLIC_*` is compiled into the bundle, so nothing at runtime reads it and nothing can report it stale; the only surface that fails is the one nobody exercises until a user tries to sign in. The generalisation is the verification move, not the variable: **probe the artifact the value produces, never re-read the value** — and that artifact turned out to be shell-reachable, because the sign-in button is a no-JS form post whose action id is a hidden *field name*, so `curl -F` returns a 303 with the whole `redirect_to` on it. One command, no browser, no Google account, and it confirms all three OAuth allow-lists at once. It is now `docs/deploy-render.md` step 5's first item, deliberately placed *above* the human sign-in check it front-runs.
- **F17** — **an OR-shaped policy can be *wider* than the action it backs, and then the action is the only guard — the inverse of this project's usual arrangement.** F17 met it twice in one feature, in opposite directions. `listings_delete_own_or_admin` is `host_id = uid OR is_admin()`, so `adminDeleteListing` — which deliberately drops F10's upcoming-booking guard to keep the spam escape hatch — would otherwise let any *host* route their own listing through it and erase live reservations. Proved by impersonation in SQL, not argued: non-admin host, one upcoming confirmed stay, `delete` returned OK and left zero rows. Meanwhile `listings_update_own` is `host_id = uid` with **no admin branch at all**, so an admin unpublish was an UPDATE matching zero rows and returning `{ error: null }` — F13's trap, sitting in the verb this dashboard is meant to *prefer*, and the build plan had asserted the opposite. **Generalises: for every admin write, ask both halves — "who else does this policy admit?" and "does it admit the admin at all?" The answers are independent, and neither is visible from the action.** The fix for the second was a narrow definer function rather than `or is_admin()` on the policy, because **no column grant restricts listing writes** — widening would have handed an admin `host_id`, i.e. the power to reassign someone's listing. Sibling finding, from actually running the suite: `second-user.spec.ts` had been asserting on `FeaturePlaceholder` copy since F04, so the only test of `/admin` was pinned to scaffolding rather than to behaviour.
- **F16** — **F13's zero-row rule is about what emptiness can *only* mean, not about row counts.** F15 predicted this would be the next place the INSERT/UPDATE distinction bites, and it was — but the answer inverted. `cancelBooking` must treat a zero-row UPDATE as a refusal because that is the only thing it can be. `markThreadRead` filters `sender_id <> me AND read_at is null`, so **zero rows is the ordinary outcome** — every open of an already-read thread legitimately matches nothing — making it the one RLS-scoped UPDATE in the project with **no** zero-row branch. **Generalises: before reusing F13's guard, ask whether the statement's own filters make emptiness normal.** Two siblings from the same feature. First, **an authorization failure in a push channel arrives as silence, not as an error**: Realtime evaluates the table's SELECT policy against the token the *socket* carries, and the browser client adopts its session from cookies asynchronously — so a channel opened on mount connects as `anon`, matches nothing, and reports success, which is indistinguishable from a feature nobody wired up. `setAuth` before `subscribe` is the fix, and a standalone probe is what separated "Realtime is broken" from "our client is anonymous". Second, **an OR-shaped INSERT policy can be looser than the app that uses it**: `message_threads_insert_participant` admits `guest_id = uid OR host_id = uid`, so it would accept a thread naming an arbitrary stranger as the guest — the action derives both participants and never builds such a row, but RLS is not the backstop here, it is the gap.
- **F15** — **"RLS refuses by filtering, not raising" is true of UPDATE and DELETE and false of INSERT — and one feature can need both.** F13's rule sent `cancelBooking` looking for a zero row count, because a refused UPDATE returns `{ error: null }` and looks like success. A refused INSERT does not: a failed `WITH CHECK` **raises `42501`**. So F15's two actions are deliberately opposite shapes — `createReview` maps error codes to sentences (`23505` → already reviewed, `42501` → not finished yet) and has no zero-row branch, while `deleteReview` has the zero-row branch and no code mapping. Writing them alike would have left one silently broken. **Generalises: before reusing a write-path pattern, ask which verb it was learned from** — the three DML verbs fail in genuinely different ways, and only DELETE/UPDATE fail quietly. Its sibling finding came from actually *running* a gate proof: the one for "a stay cannot be reviewed twice" **passed**, because `TripReview` tested `review` before `canReview` and was enforcing one-per-booking a second time, leaving `canReviewBooking`'s `hasReview` argument unreachable. Nothing misbehaved — but the rule had quietly moved out of the function that documents it, and only a proof that was *executed* rather than assumed could show that.
- **F14** — **a policy that admits three principals answers a question none of them asked.** `bookings_select_participant_or_admin` is `guest OR host OR is_admin()`, so the *same row* is legitimately readable by two screens that must never show it to each other — and every query over that table has to say which reader it is for. F13 filtered `guest_id`; F14 filters `listing_id` to owned listings, and its gate proof is F13's inverted: a stay where the fixture user is the **guest** must not surface among their reservations. It failed exactly as intended with the filter deleted, and RLS never would have caught it. **Generalises: RLS scopes to a union of principals, not to a role — so "which of these principals am I rendering for?" is a question the query must answer, never the policy.** Corollary found the same way: read the policy before deciding what a screen *can't* do. "Read-only for the host" looked like scope, but the UPDATE policy names only the guest and `is_admin()`, so a host has no write path to `bookings` at all and a cancel button would need a migration, not a component.
- **F13** — **RLS refuses a write by filtering, not by raising — so a refused UPDATE is indistinguishable from a successful one.** The cancellation window lives entirely in `bookings_update_cancel_own_or_admin`'s USING clause, so `cancelBooking` re-checking it would buy nothing; what only the action can do is notice that **zero rows changed**, because Postgres returns `{ error: null }` either way. Gate-proved: with the `!data` branch removed, cancelling an in-progress stay showed the guest no refusal at all while the row stayed `confirmed`. **Generalises: after any RLS-scoped UPDATE or DELETE, the row count *is* the authorization result — `.select()` it and treat empty as refusal.** Its sibling finding: `/trips` needed an explicit `guest_id` filter because the `bookings` SELECT policy also admits hosts and admins — **the inverse of `getFavorites`, where leaning on RLS is correct** — so "does the policy answer exactly my question?" has to be asked per table, not per project.
- **F12** — **a guard the database also enforces cannot be gated by a test, and the test will pass anyway.** The spec proving `createBooking` refuses taken dates was written against a *booking* overlap — and it **passed with the availability check deleted**, because `bookings_no_overlap` refused the insert and `23P01` maps to the same sentence the guard produces. The gate had to move to the case no constraint can reach: a booking over a host's `blocked_dates`, where nothing in Postgres expresses a rule spanning two tables. **Generalises: when writing a gate proof, first ask which layer would catch the defect if this layer were missing** — if a lower one would, the spec is measuring that instead. The same reasoning re-priced F12's fixture listing: at $123.00 the service fee is 51660 cents whether you round or truncate, so the cents assertion passed against `Math.floor`; at $123.33 the two answers differ and the spec gates the rounding rule end to end.