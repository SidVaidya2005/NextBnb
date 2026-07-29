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
**Last completed:** 18 Responsive QA, polish & deploy *(2026-07-29)*.
**Next:** no feature work queued. See **Open work** below for the five items still outstanding; none blocks the build.

Live at **https://nextbnb-h4ov.onrender.com**, with Google sign-in completing and the
host create → publish → unpublish → delete flow hand-verified against the deployment.
F18 closed on its own stated criterion — the live URL works, sign-in included — not on
the runbook landing.

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

Current as of 2026-07-29. **Treat any deviation as a finding, not a new normal.**

| Gate | Value |
| ---- | ----- |
| `npx tsc --noEmit` / `npm run lint` | clean |
| `npm run test` (unit) | 288/288 |
| `npm run test:e2e` (dev server — the committed config) | **395 total — 392 passed / 3 skipped / 0 failed** |
| `npm run test:e2e` against a **production** build | **3 failed**, all in `host-manage.spec.ts`. Pre-existing, not F18's; root cause unidentified — see Open work |
| `npm run build` | green, **16 routes**, `ƒ Proxy (Middleware)` printing |
| `seed-verification.sql` | **45/46** — the seed has aged out, see below |
| Seed rows | 26 listings (24 published) / 130 photos / 17 seeded bookings / 7 reviews / 5 blocks / 0 favorites |
| Whole-table counts | 26 listings / 19 bookings / 7 reviews / 1 thread — the extras are the developer's own, see below |
| Fixture residue after a full run | 0 listings, 0 bookings, 0 reviews, 0 fixture-owned threads, **exactly one admin** (developer's Google account) |
| Security advisors | **8 WARNs — a 9th is a finding** |
| Migrations vs remote | 9/9 matching |

**The 8 WARNs are all intentional:** `authenticated` EXECUTE on `is_admin()`,
`admin_list_users()` and `admin_unpublish_listing()` (all three load-bearing, all three
self-guarded on `is_admin()`); leaked-password protection off (Pro-plan only); and
anon + authenticated EXECUTE on each of `unavailable_listing_ids()` (F06) and
`listing_occupied_ranges()` (F12) — occupancy is public in this product and both are
narrowed to published listings.

**`seed-verification.sql` is 45/46 and it is not a code defect.** `temporal: at least one
in-progress stay exists` fails because seeded booking 14 was written
`current_date - 2 → current_date + 3` on 2026-07-24, fixing it at 2026-07-22 → 2026-07-27.
It has aged out of the window. This is the file's own documented failure mode (section 9),
it predates F15, and the E2E suite is unaffected because `trips.spec.ts` builds its own
in-progress row. Fixing it means re-running `supabase/seed.sql` — see Open work.

**Why whole-table counts exceed seed counts.** `seed-verification.sql` scopes every
assertion to the `30000000-…` id prefix, so it still reads 17 bookings and passes; a
whole-table count does not, and should not be read as leakage. Verified row by row at F17
close and unchanged since: two bookings by the developer (one in progress, one cancelled
through the UI), and one message thread with zero messages — a "Message host" click with
nothing typed, which is exactly F16's documented accepted cost. `global-teardown.ts` sweeps
only fixture-user threads, correctly, so that thread survives by design.

Verification of the deployment itself — anon route gates, the real-404 rule, the anon
availability RPC, search filters, branding — is recorded in
`build-journal.md` → F18 → *Verified against production*, which is the fuller copy.

---

## Open work

Five items. **None blocks the build**; all are recorded rather than tidied away.

1. **Three `host-manage.spec.ts` tests fail against a production build under load.**
   `badges a draft…` (:172), `unpublishing takes a live listing out of search and back`
   (:222), `deleting removes the listing and its photo rows` (:348). **Pre-existing** —
   proved by `git stash push -- src/` back to `938c84a`, rebuilding and re-running.
   **Production-only** — the dev-server suite is 392/0. **Not deterministic** — each passes
   in isolation; it needs concurrency. **The product is not demonstrably broken**: a
   diagnostic drove the real publish flow against a production build under load and reported
   `is_published=true` with the Unpublish control rendered, and the developer has since
   hand-verified create → publish → unpublish → delete against the live deployment. So this
   is now a **flaky-suite problem, not a suspected product problem** — but the mechanism is
   still unidentified. `hydratedRowFor` was tried and is *not* the fix; it is kept only
   because it is strictly more correct, and its docblock says so.
2. **No screen-reader pass.** Keyboard operability and focus are done and gate-proved (F18);
   how the live regions *announce* is unverified. Detail in Standing Constraints →
   Accessibility.
3. **A separate Supabase project for E2E**, so production can disable the email/password
   provider outright. This is the real fix for the open-signup finding; F18 scoped it out as
   large enough to rival the rest of the feature. Detail in Standing Constraints → Auth.
4. **Re-run `supabase/seed.sql`** to restore `seed-verification.sql` to 46/46. Deferred
   because the file opens with a cascading `delete from auth.users` — a destructive action
   left for the developer to schedule.
5. **Disable the GitHub integration** in the Supabase dashboard (Project Settings →
   Integrations); no MCP tool exists for it. The branch now reports
   `FUNCTIONS_DEPLOYED`/`ACTIVE_HEALTHY` rather than F02's `MIGRATIONS_FAILED`, but what
   changed it was not observed, so the F02 migration rename remains documented-correct and
   unverified. No preview-branch billing is accruing.

---

## Key Decisions

The 10 most recent, newest first. Older decisions are filed by topic in
`build-journal.md` → **Standing Constraints**.

- **F18** — **an accessibility assertion can pass because the behaviour was never exercised, not because it works — and three of five did.** The focus-restore tests opened a surface, pressed Escape, and asserted focus was on the trigger. For a non-modal popover or a menu that passes with **the restore code deleted**, because clicking a trigger leaves focus *on* it and opening moves nothing: the assertion was measuring "focus was never stolen", not "focus was restored". Only moving focus *into* the surface first (`await done.focus()`) makes close-without-restore fall to `<body>` and the test fail. Its twin arrived from the opposite direction: the "this popover is *not* trapped" test passed against a build with the trap wrongly enabled, because a wrapped Tab lands on the popover's **first** control — which is also not the one the assertion named. Asking *containment* ("did focus leave at all") is the only form a trap can fail. **Generalises: for any test of where focus went, ask where focus would be if the feature did nothing — if that is the same place, the test is scenery.** This is F08's rule meeting a state that is invisible in the DOM, which is why seventeen features of responsive specs and screenshots never caught that the project had **no `.focus()` call anywhere in `src/`**. Sibling finding, from reading rather than running: this tracker's own to-do list named "F06's calendar `role="grid"` roving focus" as a surface to audit, and that pattern **was never built** — a to-do describing work as existing is worse than one describing it as missing. **Second sibling, from the deploy: a build-time-inlined variable is invisible to every runtime check, so a configuration error can survive a completely green site.** `NEXT_PUBLIC_SITE_URL` went out as the *callback URL* rather than the origin, making the OAuth `redirect_to` `…/auth/callback/auth/callback` — a 404 — while the grid, every filter, all six route gates, the real-404 behaviour and Render's own health check on `/` stayed green. `NEXT_PUBLIC_*` is compiled into the bundle, so nothing at runtime reads it and nothing can report it stale; the only surface that fails is the one nobody exercises until a user tries to sign in. The generalisation is the verification move, not the variable: **probe the artifact the value produces, never re-read the value** — and that artifact turned out to be shell-reachable, because the sign-in button is a no-JS form post whose action id is a hidden *field name*, so `curl -F` returns a 303 with the whole `redirect_to` on it. One command, no browser, no Google account, and it confirms all three OAuth allow-lists at once. It is now `docs/deploy-render.md` step 5's first item, deliberately placed *above* the human sign-in check it front-runs.
- **F17** — **an OR-shaped policy can be *wider* than the action it backs, and then the action is the only guard — the inverse of this project's usual arrangement.** F17 met it twice in one feature, in opposite directions. `listings_delete_own_or_admin` is `host_id = uid OR is_admin()`, so `adminDeleteListing` — which deliberately drops F10's upcoming-booking guard to keep the spam escape hatch — would otherwise let any *host* route their own listing through it and erase live reservations. Proved by impersonation in SQL, not argued: non-admin host, one upcoming confirmed stay, `delete` returned OK and left zero rows. Meanwhile `listings_update_own` is `host_id = uid` with **no admin branch at all**, so an admin unpublish was an UPDATE matching zero rows and returning `{ error: null }` — F13's trap, sitting in the verb this dashboard is meant to *prefer*, and the build plan had asserted the opposite. **Generalises: for every admin write, ask both halves — "who else does this policy admit?" and "does it admit the admin at all?" The answers are independent, and neither is visible from the action.** The fix for the second was a narrow definer function rather than `or is_admin()` on the policy, because **no column grant restricts listing writes** — widening would have handed an admin `host_id`, i.e. the power to reassign someone's listing. Sibling finding, from actually running the suite: `second-user.spec.ts` had been asserting on `FeaturePlaceholder` copy since F04, so the only test of `/admin` was pinned to scaffolding rather than to behaviour.
- **F16** — **F13's zero-row rule is about what emptiness can *only* mean, not about row counts.** F15 predicted this would be the next place the INSERT/UPDATE distinction bites, and it was — but the answer inverted. `cancelBooking` must treat a zero-row UPDATE as a refusal because that is the only thing it can be. `markThreadRead` filters `sender_id <> me AND read_at is null`, so **zero rows is the ordinary outcome** — every open of an already-read thread legitimately matches nothing — making it the one RLS-scoped UPDATE in the project with **no** zero-row branch. **Generalises: before reusing F13's guard, ask whether the statement's own filters make emptiness normal.** Two siblings from the same feature. First, **an authorization failure in a push channel arrives as silence, not as an error**: Realtime evaluates the table's SELECT policy against the token the *socket* carries, and the browser client adopts its session from cookies asynchronously — so a channel opened on mount connects as `anon`, matches nothing, and reports success, which is indistinguishable from a feature nobody wired up. `setAuth` before `subscribe` is the fix, and a standalone probe is what separated "Realtime is broken" from "our client is anonymous". Second, **an OR-shaped INSERT policy can be looser than the app that uses it**: `message_threads_insert_participant` admits `guest_id = uid OR host_id = uid`, so it would accept a thread naming an arbitrary stranger as the guest — the action derives both participants and never builds such a row, but RLS is not the backstop here, it is the gap.
- **F15** — **"RLS refuses by filtering, not raising" is true of UPDATE and DELETE and false of INSERT — and one feature can need both.** F13's rule sent `cancelBooking` looking for a zero row count, because a refused UPDATE returns `{ error: null }` and looks like success. A refused INSERT does not: a failed `WITH CHECK` **raises `42501`**. So F15's two actions are deliberately opposite shapes — `createReview` maps error codes to sentences (`23505` → already reviewed, `42501` → not finished yet) and has no zero-row branch, while `deleteReview` has the zero-row branch and no code mapping. Writing them alike would have left one silently broken. **Generalises: before reusing a write-path pattern, ask which verb it was learned from** — the three DML verbs fail in genuinely different ways, and only DELETE/UPDATE fail quietly. Its sibling finding came from actually *running* a gate proof: the one for "a stay cannot be reviewed twice" **passed**, because `TripReview` tested `review` before `canReview` and was enforcing one-per-booking a second time, leaving `canReviewBooking`'s `hasReview` argument unreachable. Nothing misbehaved — but the rule had quietly moved out of the function that documents it, and only a proof that was *executed* rather than assumed could show that.
- **F14** — **a policy that admits three principals answers a question none of them asked.** `bookings_select_participant_or_admin` is `guest OR host OR is_admin()`, so the *same row* is legitimately readable by two screens that must never show it to each other — and every query over that table has to say which reader it is for. F13 filtered `guest_id`; F14 filters `listing_id` to owned listings, and its gate proof is F13's inverted: a stay where the fixture user is the **guest** must not surface among their reservations. It failed exactly as intended with the filter deleted, and RLS never would have caught it. **Generalises: RLS scopes to a union of principals, not to a role — so "which of these principals am I rendering for?" is a question the query must answer, never the policy.** Corollary found the same way: read the policy before deciding what a screen *can't* do. "Read-only for the host" looked like scope, but the UPDATE policy names only the guest and `is_admin()`, so a host has no write path to `bookings` at all and a cancel button would need a migration, not a component.
- **F13** — **RLS refuses a write by filtering, not by raising — so a refused UPDATE is indistinguishable from a successful one.** The cancellation window lives entirely in `bookings_update_cancel_own_or_admin`'s USING clause, so `cancelBooking` re-checking it would buy nothing; what only the action can do is notice that **zero rows changed**, because Postgres returns `{ error: null }` either way. Gate-proved: with the `!data` branch removed, cancelling an in-progress stay showed the guest no refusal at all while the row stayed `confirmed`. **Generalises: after any RLS-scoped UPDATE or DELETE, the row count *is* the authorization result — `.select()` it and treat empty as refusal.** Its sibling finding: `/trips` needed an explicit `guest_id` filter because the `bookings` SELECT policy also admits hosts and admins — **the inverse of `getFavorites`, where leaning on RLS is correct** — so "does the policy answer exactly my question?" has to be asked per table, not per project.
- **F12** — **a guard the database also enforces cannot be gated by a test, and the test will pass anyway.** The spec proving `createBooking` refuses taken dates was written against a *booking* overlap — and it **passed with the availability check deleted**, because `bookings_no_overlap` refused the insert and `23P01` maps to the same sentence the guard produces. The gate had to move to the case no constraint can reach: a booking over a host's `blocked_dates`, where nothing in Postgres expresses a rule spanning two tables. **Generalises: when writing a gate proof, first ask which layer would catch the defect if this layer were missing** — if a lower one would, the spec is measuring that instead. The same reasoning re-priced F12's fixture listing: at $123.00 the service fee is 51660 cents whether you round or truncate, so the cents assertion passed against `Math.floor`; at $123.33 the two answers differ and the spec gates the rounding rule end to end.
- **F10** — **an FK cascade is a destructive path with no error, no test and no type pointing at it.** `bookings.listing_id` is `on delete cascade`, so a host deleting a listing does not *cancel* its reservations — it erases them, leaving the guest nothing in `/trips` and no record a stay ever existed. It is now guarded in the action (refuse while a confirmed stay is still coming, steer to unpublish), stated in the UI rather than only disabled, and the cutoff is widened by a day so the JS/`current_date` boundary can only ever err toward refusing. **Generalises: before shipping a delete, read the FK actions on every table that references the row — the blast radius is in the schema, not in the feature.** F17's admin delete is the same cascade with the guard deliberately absent.
- **F08** — **a green assertion is not a gating assertion; run every new spec against a deliberately broken build.** `toHaveURL('/')` passes instantly when the page is already at `/`, so the spec guarding "the heart must not navigate" passed against the exact markup it existed to reject. Two further F08 traps rhyme with it: postgrest-js types a to-one embed on a NOT NULL FK as never-null while RLS returns null at runtime (the `toFavoriteCards` filter is load-bearing and TS would never demand it), and a spec that snapshots whole-user state races the parallel workers sharing that user. **Generalises: prove the test fails before trusting that it passes.**
- **F06** — **RLS can make a feature impossible in application code without ever raising an error.** The date filter looked like ordinary app logic until the `bookings` SELECT policy was read carefully: anon reads *zero* booking rows, so a nested select returns `[]` and every listing reads as available — a wrong answer that arrives as a success. It is now the `unavailable_listing_ids()` definer function (`0007`), returning published ids only. **Generalises: before computing anything from a table, check what the *least* privileged reader of that table can see.** The same trap waited in F12's booking widget — and was sharper there, because *any* signed-in guest reads zero rows for a listing they do not host.
