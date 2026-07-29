# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly. Per-feature narrative — decisions,
> gotchas, verification — lives in `build-journal.md`; this file stays short enough
> to read in full at session start.

---

## Current Status

**Phase:** Phase 6 — Admin & Polish (in progress)
**Last completed:** 17 Admin dashboard
**In progress:** 18 Responsive QA, polish & deploy — **code and docs complete; the
deploy itself is pending and F18 does not close until the live URL works.**

F18's code half is done: the accessibility pass (ten surfaces that had no focus
management at all), the date-fragility sweep F17 handed forward, and the deploy
artifacts (`render.yaml` + `docs/deploy-render.md`). **What remains is the part
that needs dashboard credentials** — applying the Blueprint, and registering the
redirect URLs in Google Cloud and Supabase. The runbook is written to be executed
top to bottom; its step 3 is the one that fails silently if skipped.

Two findings worth the space. **Three of the five focus-restore tests passed
against a build with the restore deleted**, because for a non-modal popover focus
never leaves the trigger in the first place — the assertions were measuring the
wrong thing, and F08's rule is the only reason that surfaced. And **this file was
wrong about the calendar**: it listed "F06's calendar `role="grid"` roving focus"
as a surface needing an audit, and that pattern was never built. Full detail:
`build-journal.md` → F18.

F17 put the moderation dashboard behind F04's route gate: three tables (users,
listings, bookings) and three verbs (unpublish, delete, cancel). It needed
**migration `0009`**, ending the three-feature no-SQL run, and the reason is its
finding: **`listings_update_own` has no admin branch**, so an admin unpublish was
an UPDATE matching zero rows and returning `{ error: null }` — F13's trap, in the
verb the build plan says to *prefer*. That plan's "reuse the existing actions,
they already accept an admin actor via RLS" line held for `cancelBooking` and
neither of the other two. The mirror-image finding: `listings_delete_own_or_admin`
is *wider* than its action, so `adminDeleteListing`'s own `is_admin` check —
not RLS — is the only thing stopping an ordinary host erasing their own listing's
live reservations, **proved by impersonation in SQL rather than argued**. Full
detail: `build-journal.md` → F17.

### Live baselines (F18 code-complete, 2026-07-29)

Treat any deviation from these as a finding, not a new normal.

| Gate | Value |
| ---- | ----- |
| `npx tsc --noEmit` / `npm run lint` | clean |
| `npm run test` (unit) | 288/288 |
| `npm run test:e2e` (dev server — the committed config) | **395 total — 392 passed / 3 skipped / 0 failed** (was 387 at F17; F18's `keyboard.spec.ts` adds 8). See the messages-ordering note below — this run was clean, which is *data*, not a verdict |
| `npm run test:e2e` **against a production build** | **3 failed**, all in `host-manage.spec.ts`. **Pre-existing, not F18's** — proved by reverting `src/` to `938c84a` and re-running. Root cause **not identified**. See Outstanding actions |
| `npm run build` | green, **16 routes**, `ƒ Proxy (Middleware)` printing |
| `seed-verification.sql` | **45/46 — the seed has aged out, see below** |
| Seed rows | 26 listings (24 published) / 130 photos / 17 seeded bookings / 7 reviews / 5 blocks / 0 favorites |
| Whole-table counts | 26 listings / **19 bookings** / 7 reviews / **1 thread** — the extras are all the developer's own, itemised below. **Re-confirmed at F18 close**, unchanged from F17 |
| Fixture residue after a full run | 0 listings, 0 bookings, 0 reviews, **0 fixture-owned threads**, **exactly one admin** (developer's Google account). **Re-confirmed at F18 close**: `title like 'E2E%' or city like 'Testerton%'` returns **0**. A mid-run count reads higher (30 listings was observed while the suite was live) — that is workers' in-flight fixtures, not leakage, and `global-teardown.ts` sweeps them |
| Security advisors | **8 WARNs — a 9th is a finding** |
| Migrations vs remote | 9/9 matching |

**`seed-verification.sql` is 45/46 and the failure is not a code defect.**
`temporal: at least one in-progress stay exists` fails because seeded booking 14
was written `current_date - 2 → current_date + 3` on 2026-07-24, fixing it at
2026-07-22 → 2026-07-27 — so as of 2026-07-27 its checkout is *today* and it has
aged out of the window. This is the file's own documented failure mode (section
9: *"if this ever fails, the seed has aged out and needs re-running"*), it
predates F15 (whose diff contains no SQL, migration or seed file), and the E2E
suite is unaffected because `trips.spec.ts` builds its own in-progress row.

**Re-checked at F16 close (2026-07-28) rather than assumed**, since F16's diff
also contains no SQL: of the seeded bookings, 9 completed / 6 upcoming / 2
cancelled (both carrying `cancelled_at`) / 0 inverted — and **0 in progress**,
which is that same single assertion and no other. It is now a day further past.
**Fixing it means re-running `supabase/seed.sql`, which begins with a cascading
`delete from auth.users` — a destructive action left for the developer to
schedule.** Expect 46/46 afterwards.

**`bookings` now totals 19 and `message_threads` 1 — every extra row is the
developer's own, and none of it is fixture residue.** `seed-verification.sql`
scopes every assertion to the `30000000-…` id prefix, so it still reads 17
bookings and passes; a whole-table count does not, and should not be read as
leakage. Verified row by row at F17 close (2026-07-29):

| Row | Owner | Note |
| --- | ----- | ---- |
| Booking Jul 27–30, confirmed | Siddarth Vaidya | the stay F14 already documented; in progress today |
| Booking Jul 30–Aug 1, **cancelled** | Siddarth Vaidya | booked and cancelled through the UI at 01:34 on 2026-07-29, before F17's session |
| 1 message thread, **0 messages** | Siddarth Vaidya → a seeded host | "Message host" clicked and nothing typed — **exactly F16's documented accepted cost**, not a leak. `global-teardown.ts` sweeps only fixture-user threads, correctly, so this survives by design |

**Fixture-owned rows after a full run: 0 listings, 0 bookings, 0 reviews, 0
threads, exactly one admin** (the developer's Google account) — re-confirmed at
F17 close.

The 8 WARNs are all intentional: `authenticated` EXECUTE on `is_admin()`,
`admin_list_users()` and — new at F17 — `admin_unpublish_listing()` (all three
load-bearing, all three self-guarded on `is_admin()`); leaked-password protection
off (Pro-plan-only); and anon+authenticated EXECUTE on each of the two definer
functions `unavailable_listing_ids()` (F06) and `listing_occupied_ranges()`
(F12) — occupancy is public in this product and both are narrowed to published
listings. **The 8th is F17's and was predicted before it appeared**; the new
function grants EXECUTE to `authenticated` only, and the absence of a matching
`anon` WARN is what confirms its revoke landed.

### Remaining loose ends

Triaged and accepted. Each is expanded in the relevant `build-journal.md` entry.

**Untested branches** (written, reasoned, never executed)
- **The two admin two-step confirms have no focus assertion of their own** (F18).
  `AdminListingActions` and `AdminCancelBookingButton` use the identical
  `useFocusWhen` pairing that `e2e/keyboard.spec.ts` gate-proves on
  `ListingActions`, so the hook is covered — but "the hook works and these
  components call it" is an argument, not a test. `keyboard.spec.ts` cannot reach
  them because `admin.spec.ts` owns `profiles.is_admin` exclusively (F17's race),
  so the assertion belongs *inside* `admin.spec.ts`. Worth adding if F17 or F18 is
  revisited. The admin listing delete is the one where it matters most: its confirm
  step also renders the `role="alert"` naming the reservations the delete erases.
- **The `{ ok: false }` Supabase-error branch of every action** — `setFavorite`
  (F08), `updateListing`/`deleteListing` (F10), `addBlock`/`removeBlock` (F11),
  `createBooking` (F12), `cancelBooking` (F13), `createReview`/`deleteReview`
  (F15). Guard refusals and not-found paths *are* covered; a genuine database
  error is not. Same shape as F05's untriggered `error.tsx`. **The zero-row
  branches are the exception** — they are refusals, not errors, and both F13's
  and F15's are gate-proved. F14 adds the read-side twin: `getHostReservations`'
  two error branches, and its `hostsNothing: false` distinction between "hosts
  nothing" and "the query failed", are reasoned about rather than executed. F16
  adds all three messaging actions, plus `markThreadRead`'s **swallowed** error
  path — the one branch in the project that deliberately reports success on
  failure, because a receipt that did not land must not stop a thread rendering.
- **`sendMessage`'s `42501`/`23503` branch and `getOrCreateThread`'s `23505`
  retry** (F16). The first needs a thread deleted while the composer sits open —
  genuinely reachable, and worth a spec if F16 is revisited, exactly as
  `deleteReview`'s zero-row branch turned out to be. The second needs two clicks
  to interleave past the select; the ordinary double-click is caught by the
  select and **is** covered.
- **The `liveStatus === 'offline'` notice** (F16) — needs the websocket to fail
  or time out, which nothing in the suite induces. The `'live'` path is asserted
  on every realtime spec via `data-live`.
- **A thread whose listing was deleted** (F16) — `listing_id` null renders
  "Listing no longer available". The RLS half of that branch (a guest looking at
  an unpublished listing's thread) is reachable and reasoned about; neither half
  has a spec.
- **All three F17 admin actions' `{ ok: false }` Supabase-error branches**, plus
  their shared `Unauthorized.` branch — there is no UI path to a server action a
  non-admin can reach, because the route redirects first, so reaching it needs a
  forged request. The SQL impersonation gate proof stands in for it and is the
  stronger evidence anyway: it proves the *policy* would have allowed what the
  check refuses. `adminDeleteListing`'s zero-row branch is unreachable by
  construction (the read above it proves the row exists and `is_admin()` satisfies
  the policy); it logs rather than passing silently, because if it ever fires the
  gate and the policy have stopped agreeing.
- **`getAdminOverview`'s three `failed: true` section states** (F17) — reasoned
  about, not executed, the same shape as F14's `hostsNothing: false` and F05's
  untriggered `error.tsx`. The **degraded-email path *was* observed**, though: a
  spec's `finally` revoking `is_admin` mid-render made `admin_list_users()` raise
  while the page's gate read had already passed, and the emails fell back to null
  with the rest of the table intact.
- **`adminDeleteListing`'s Cloudinary `destroy`** (F17) — inherits F10's standing
  note: the suite never uploads, so a successful multi-asset destroy is still
  reasoned about rather than observed.
- **`createReview`'s `42501` branch** (F15) — `canReviewBooking` never offers the
  form where the policy would refuse, so reaching it needs a forged request or a
  checkout boundary crossing while the page sits open. Its `23505` sibling is
  unreachable from a *fresh* page but **is** reachable from a stale one, exactly
  as `deleteReview`'s zero-row branch turned out to be — worth a spec if F15 is
  revisited. The 1 000-char comment cap is unit-tested only; `maxLength` makes it
  unreachable through the textarea.
- **`getHostReservations`' null-listing branch is unreachable by construction**
  (F14). Every id it filters on came from a listing the caller hosts, so the
  embed cannot be RLS-filtered away. It logs rather than skipping silently,
  because if it ever fires the scoping set and the policy have stopped agreeing.
- **`cancelBooking`'s refusal is unreachable through the UI**, because
  `canCancel` never renders the control for a stay the policy would refuse.
  Reaching it needs a forged request or a stay whose check-in passes while the
  page sits open. The gate proof reached it by relaxing `canCancel` for one run.
- **`createBooking`'s past-date branch** — the calendar never offers a past day,
  so reaching it needs a forged request.
- **The `23P01` exclusion-constraint branch** — the app-side check fires first, so
  the constraint's own refusal is reachable only in a true race (or by deleting
  the check, which is how the gate proof found it).
- **`deleteListing`'s Cloudinary `destroy`** has only ever run against fabricated
  `public_id`s — the suite never uploads, so a *successful* multi-asset destroy is
  reasoned about, not observed. Those same ids make `CldImage` log "Resource not
  found" through the host grid during E2E: test-data noise, not a defect.
- **The 365-day block ceiling** is unit-tested only — reaching it through the
  calendar is ~365 "Next month" clicks.
- **Cancelling at the Google consent screen** (`access_denied` → home, no error
  banner) needs a human to click Cancel.

**Known limitations** (documented, deliberately not fixed)
- **A guest cannot check *out* on the day another guest checks *in*.**
  `DateRangePicker.isSelectable` disables every occupied day outright, so although
  the range model permits an unavailable day as a half-open *end*, the cell cannot
  be clicked. One bookable night at each boundary is unreachable. The documented
  invariant — check *in* on another's checkout day — does work and is covered.
- **Editing before hydration loses the edit, for a real user too.** Clearing a
  field and submitting inside the hydration window saves the server-rendered
  default. Inherent to an SSR'd react-hook-form seeded from `defaultValues`; worth
  knowing before it is reported as a bug.
- **The block-over-booking race is guarded but has never *landed*.** A booking
  arriving in the microseconds after `addBlock`'s read would produce a block
  overlapping a confirmed stay. Benign by design — `unavailable_listing_ids`
  unions both halves — and reachable only by contriving the interleaving.
- **`blocked_dates_update_own_listing` is a knowingly unused policy.** F11 only
  inserts and deletes; widening a block is remove-and-re-add. Worth knowing before
  it reads as evidence that editing a block is supported.
- **A signed-in third-party guest is unreachable.** "These nights are taken" is
  proven against **anon** — the stronger principal — because F12's listing host
  and its booker already use both fixture accounts. A third would be needed.
- **`/admin`'s admin-side render is covered only as a placeholder.** The spec
  proves the route gate opens and closes with `is_admin`; F17 owns asserting on a
  dashboard once there is one.
  → **Closed by F17** (2026-07-29): `admin.spec.ts` asserts all three tables, both
  moderation verbs and the cancel, and the gate test **moved** there from
  `second-user.spec.ts` so one file owns `is_admin`. It also found that the old
  assertion had been pinned to `FeaturePlaceholder` copy since F04.
- **The admin tables are capped at 200 rows each and the cap is silent** (F17).
  Fine at 26 listings / 18 bookings, and the cap orders `check_in`/`created_at`
  DESC so it truncates settled history rather than what an admin came to see
  (F14's rule). Pagination is unowned; F18 or later.
- **An admin cannot republish a listing they unpublished** (F17), deliberately.
  Publishing carries a ≥1-photo guard that lives in `setListingPublished`, and a
  second entry point would duplicate or skip it. The host republishes their own.
- **No role editing and no user deletion in `/admin`** (F17), and neither is a UI
  choice: `0003` revokes the `is_admin` column grant from `authenticated` and
  revokes DELETE on `profiles` outright. Adding either is a migration.
- **The inbox does not live-update** (F16). Realtime is thread-scoped by design
  (`filter: thread_id=eq.<id>`), so a new message neither reorders nor badges
  `/messages` until it is revisited. Plausible F18 polish.
- **A host cannot start a conversation, only reply** (F16). Unlike F14's
  read-only reservations this needs **no** migration — both policies already
  admit either participant as the creator — only an entry point. Out of scope by
  agreement, recorded so it does not read as a limitation of the schema.
- **`message_threads_insert_participant` is looser than the app** (F16). Its
  `guest_id = uid OR host_id = uid` would accept a thread naming an arbitrary
  stranger as the guest; `getOrCreateThread` derives both participants and never
  builds one. Tightening it is a migration. **Here RLS is the gap, not the
  backstop** — the inverse of this project's usual arrangement.
- **`on delete set null` can collide with `nulls not distinct` and fail a listing
  delete** (F16). Nulling `message_threads.listing_id` collapses a thread onto
  `(guest, host, null)`, and the unique constraint treats those nulls as equal —
  so a guest holding threads about two listings by one host makes the **second**
  listing delete raise a unique violation, surfacing as `deleteListing`'s generic
  error. Narrow, reachable through ordinary use, and not fixed (it needs a
  migration). `global-teardown.ts` sidesteps it by clearing threads first.
  **F17's admin delete has the same exposure** — confirmed as inherited, not
  fixed: `adminDeleteListing` issues the same `delete from listings` and would
  surface the unique violation as its generic error.
- **Admins cannot read message threads** (`0003`, deliberately). F17's moderation
  therefore cannot reach conversations without a migration. → **Confirmed by F17**
  (2026-07-29): the dashboard has three tables and no fourth.

**Outstanding actions**
- **Three `host-manage.spec.ts` tests fail against a PRODUCTION build under load,
  and they are pre-existing — F18 found them, did not cause them, and has not
  fixed them.** This is the single most important thing F18's production-build run
  bought, and it is recorded unresolved rather than tidied away.

  | Question | Answer, and how it was established |
  | --- | --- |
  | Which tests? | `badges a draft…` (:172), `unpublishing takes a live listing out of search and back` (:222), `deleting removes the listing and its photo rows` (:348) |
  | Caused by F18? | **No.** `git stash push -- src/` back to `938c84a`, rebuilt, re-ran — still fails. The e2e half of F18's diff was kept, so only the product code varied |
  | Only in production? | **Yes.** The full suite against `npm run dev` is **392 passed / 0 failed**. Against `npm run build && npm start` it is 3–4 failed on every run |
  | Deterministic? | **No.** Each passes in isolation against the same production server; it needs concurrency. Two consecutive prod runs failed an overlapping core of 3 |
  | Is the *product* broken? | **Not demonstrably.** A temporary diagnostic drove the real publish flow against the production build under load and reported `DB after click: is_published=true` with the Unpublish control rendered — i.e. the action and `router.refresh()` both worked. So the evidence points at a test-side race, but the mechanism is **not identified** |

  **What was tried and did not work:** `hydratedRowFor` (waiting for hydration on
  the row actually under test, rather than on whichever row is first — the rows
  reorder under load because `getOwnListings` sorts `created_at DESC`). It is
  kept because it is strictly more correct, but it is **not** the fix and its
  docblock says so.

  **Why it matters beyond the suite:** every one of these tests is about a host
  mutation being reflected on screen. Until the mechanism is known, "publish /
  unpublish / delete always updates the UI in production" is **asserted only
  against a dev server**. Worth resolving before or shortly after the deploy —
  and worth checking by hand during the runbook's step 5.
- **The suite has only ever run against `npm run dev`**, and `playwright.config.ts`
  still points there deliberately (a build on every run is too slow to work with).
  F18 ran it against a production build once, which is how the item above
  surfaced. **Doing that occasionally is now known to be worth it.**
- **No keyboard or screen-reader pass**, now eight features running (F06's
  calendar `role="grid"` roving focus, F08's heart, F09's form, F10's two-step
  delete, F11's calendar, F12's stepper/popover/sheet — the sheet is a
  `role="dialog"` with **no focus trap and no focus restore** — and F13's
  two-step cancel, which moves focus nowhere when it swaps controls). **F18 owns it.**
  > **Corrected 2026-07-29 (F18 exploration):** two things above are wrong, and
  > both understate the problem. **The calendar has no `role="grid"` and no roving
  > focus** — `DateRangePicker` carries no `role`, no `tabIndex` and no
  > `onKeyDown` at all; its days are plain `<button>`s with `aria-label` +
  > `aria-pressed`, so this line names a pattern that was never built rather than
  > one needing an audit. And the focus gap is not confined to the sheet: **there
  > is no `.focus()` call anywhere in `src/`**, so *nothing* in the project manages
  > focus. Two surfaces are `aria-modal="true"` with no trap (F12's sheet and
  > F06's search overlay), two calendar popovers strand focus at the document top
  > on close, and only `AccountMenu` handles Escape.
  F14 adds nothing to this list: `/host/reservations` renders no interactive
  control at all beyond one link per card. **F15 adds one two-step control (the
  review delete, with F13's same focus gap) but subtracts risk elsewhere:**
  `RatingInput` is a native radio group, so its keyboard behaviour is the
  browser's rather than something F18 must audit. **F16 adds one surface**: the
  thread composer (a textarea plus Send, both native) and two live regions — the
  `aria-live` announcement of an incoming message and the offline notice. Low
  risk, but the announcement is the project's first genuinely asynchronous one
  and nothing has verified how it interacts with the sheet and menu already on
  the list. **F17 adds two two-step controls** — the listing delete, whose confirm
  swaps in three buttons, and the booking cancel — both carrying F13's same focus
  gap (nothing moves focus when the controls swap), plus a `role="alert"` holding
  the deletion-impact copy, which is the first live region in the project that
  appears *beside* the control that triggered it rather than elsewhere on the page.
  → **Largely closed by F18** (2026-07-29). All ten surfaces now manage focus, via
  two shared hooks (`src/lib/hooks/`), and `e2e/keyboard.spec.ts` gate-proves each
  behaviour. **Two things are deliberately still open**, and neither is an
  oversight: (a) `DateRangePicker`'s day cells remain plain buttons — no
  `role="grid"`, no roving tabindex — so a two-month calendar is ~60 tab stops;
  the primitive sits under three features and ~6 spec files and a botched roving
  tabindex is worse than verbose-but-working buttons. (b) **No screen-reader pass
  has been run.** F18 covered keyboard operability and focus, which is what was
  broken; how the live regions actually *announce* — especially F16's asynchronous
  message announcement interacting with the sheet and menu — is still unverified
  by anything but reading.
- **`messages.spec.ts` › "a reply moves its conversation to the top of the inbox"
  fails intermittently under full-suite load, and the honest verdict is *not
  conclusively attributed*.** What was actually measured, at F17 close:

  | Tree | Run | Result |
  | ---- | --- | ------ |
  | F16 + the availability fix only | full suite ×1 | **375 passed, 0 failed** |
  | F17 | full suite ×3 | 1 clean, **2 with this one test failing** |
  | either tree | `messages.spec.ts` alone ×5 | 12/12 every time |
  | F17 | `messages` + `admin` together ×2 | 22/22 both times |

  So it needs full-suite concurrency, and one control run cannot separate "F17's
  ten extra tests tipped a load-sensitive flake" from "the control run happened to
  survive one". **F17's diff touches nothing in messaging** — that much is
  certain — but the correlation is real and should not be written off.

  **F18 update (2026-07-29), reported as data rather than as a resolution.**
  Post-`938c84a`, the full suite passed **392 / 3 skipped / 0 failed** against the
  dev server, with this test green. That is *not* evidence the flake is fixed:
  F17's own measurement was **1 clean run in 3**, so a clean run is exactly what a
  still-present intermittent failure looks like a fair fraction of the time.
  `938c84a` also never claimed to fix it — it made a lost bump *visible in the
  log*, which is a different thing. **Still open. If it recurs, the log now says
  so**, and the line to look for is
  `[actions/messages] sendMessage bump matched no row for thread …`.

  **The mechanism is understood and it is a product defect, not only a test one.**
  It fails at the `lastMessageAt` comparison *after* the message-count poll has
  passed, i.e. the message sent and the **bump did not land**. `sendMessage`'s own
  docblock says why that is possible: the `last_message_at` bump is a second write
  "guarded by nothing", whose error is **deliberately swallowed** so a delivered
  message is never reported as unsent. It also has **no zero-row check** — and an
  RLS-filtered UPDATE returns `{ error: null }` with zero rows, which is exactly
  F13's rule and the one write in the project that does not apply it. The visible
  consequence is an inbox that silently mis-orders.
  **Recommended for F18: give the bump the `.select().maybeSingle()` zero-row
  branch F13 established, logging (not surfacing) a miss.** Left unfixed here
  because it is F16 code and the call is the developer's.
  → **Closed by commit `938c84a` (6.17.5, 2026-07-29)**, after F17 closed and
  before F18 began. The bump now `.select('id').maybeSingle()`s and logs when it
  matched no row. **The flake itself is still not attributed** — the commit
  message says so explicitly and does not claim to fix it. F18 does not
  investigate it further by agreement; its full-suite runs will show whatever
  they show, and that gets recorded rather than explained away.
- **The date-fragility sweep is done** (F18). `host-availability.spec.ts` held
  **six** more bare `dayCell` assertions of the same class, at `today+10…15` —
  latent only because that file runs at the default 1280px viewport where two
  months render. All six now use `revealDay`. Separately,
  `search-responsive.spec.ts`' past-dates test **silently skipped its only
  assertion on the 1st of every month** via a bare `if (sameMonth)`; both branches
  now assert. The suspected `todayISO()`-local / `addDay()`-UTC mismatch in
  `fixtures.ts` was **investigated and is not a defect** — `addDay` parses *and*
  formats in UTC, so it is a pure calendar-date shift, verified against an
  independent oracle at offsets +14 through −11. That reasoning is recorded in the
  function's docblock so it is not "simplified" into a real bug later.
- **`e2e/host-availability-responsive.spec.ts` was date-fragile, and it took until
  2026-07-29 to show.** Its "calendar scrolls inside its own container" test
  measured `todayISO() + 3` with a bare `dayCell`, so on the last three days of any
  month that date falls into the *next* month — which only renders at `desktop:`
  and up (one month below it, two above). It hung for the full 30s timeout at
  320/375/744 while passing at 1128/1440. **Pre-existing and unrelated to F17**,
  which merely ran the suite on the right date to expose it; `calendar.ts`'s
  `revealDay` helper already existed for exactly this hazard and its docblock says
  so — that one call site had not used it. Fixed by using it. **F18 should sweep
  for other date-sensitive fixtures**, since this class of bug is invisible for
  ~90% of any month.
- **A host cannot cancel or decline a reservation, and adding it is a migration**
  (F14) — `bookings_update_cancel_own_or_admin` names only the guest and
  `is_admin()`. Out of scope for this build; recorded because "read-only for the
  host" reads like a UI choice and is not one.
- **Disable the GitHub integration** in the Supabase dashboard (Project Settings →
  Integrations) — no MCP tool exists for it. The branch now reports
  `FUNCTIONS_DEPLOYED`/`ACTIVE_HEALTHY` rather than F02's `MIGRATIONS_FAILED`, but
  what changed it was not observed, so the F02 migration rename remains
  **documented-correct and unverified**. No preview-branch billing is accruing.
- **A separate Supabase project for E2E** so production can disable the email
  provider outright — the real fix for the open-signup finding. **F18 owns it.**

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
- [x] 13 Trips (guest reservations)
- [x] 14 Host reservations

### Phase 5 — Engagement
- [x] 15 Reviews & ratings
- [x] 16 Guest ↔ host messaging

### Phase 6 — Admin & Polish
- [x] 17 Admin dashboard
- [ ] 18 Responsive QA, polish & deploy

---

## Key Decisions

> At the ~10-bullet cap. **F17 must prune one into `build-journal.md` before adding.**

- **F06** — **RLS can make a feature impossible in application code without ever raising an error.** The date filter looked like ordinary app logic until the `bookings` SELECT policy was read carefully: anon reads *zero* booking rows, so a nested select returns `[]` and every listing reads as available — a wrong answer that arrives as a success. It is now the `unavailable_listing_ids()` definer function (`0007`), returning published ids only. **Generalises: before computing anything from a table, check what the *least* privileged reader of that table can see.** The same trap waited in F12's booking widget — and was sharper there, because *any* signed-in guest reads zero rows for a listing they do not host.
- **F08** — **a green assertion is not a gating assertion; run every new spec against a deliberately broken build.** `toHaveURL('/')` passes instantly when the page is already at `/`, so the spec guarding "the heart must not navigate" passed against the exact markup it existed to reject. Two further F08 traps rhyme with it: postgrest-js types a to-one embed on a NOT NULL FK as never-null while RLS returns null at runtime (the `toFavoriteCards` filter is load-bearing and TS would never demand it), and a spec that snapshots whole-user state races the parallel workers sharing that user. **Generalises: prove the test fails before trusting that it passes.**
- **F10** — **an FK cascade is a destructive path with no error, no test and no type pointing at it.** `bookings.listing_id` is `on delete cascade`, so a host deleting a listing does not *cancel* its reservations — it erases them, leaving the guest nothing in `/trips` and no record a stay ever existed. It is now guarded in the action (refuse while a confirmed stay is still coming, steer to unpublish), stated in the UI rather than only disabled, and the cutoff is widened by a day so the JS/`current_date` boundary can only ever err toward refusing. **Generalises: before shipping a delete, read the FK actions on every table that references the row — the blast radius is in the schema, not in the feature.** F17's admin delete is the same cascade with the guard deliberately absent.
- **F18** — **an accessibility assertion can pass because the behaviour was never exercised, not because it works — and three of five did.** The focus-restore tests opened a surface, pressed Escape, and asserted focus was on the trigger. For a non-modal popover or a menu that passes with **the restore code deleted**, because clicking a trigger leaves focus *on* it and opening moves nothing: the assertion was measuring "focus was never stolen", not "focus was restored". Only moving focus *into* the surface first (`await done.focus()`) makes close-without-restore fall to `<body>` and the test fail. Its twin arrived from the opposite direction: the "this popover is *not* trapped" test passed against a build with the trap wrongly enabled, because a wrapped Tab lands on the popover's **first** control — which is also not the one the assertion named. Asking *containment* ("did focus leave at all") is the only form a trap can fail. **Generalises: for any test of where focus went, ask where focus would be if the feature did nothing — if that is the same place, the test is scenery.** This is F08's rule ("prove the test fails before trusting that it passes") meeting a state that is invisible in the DOM, which is why seventeen features of responsive specs and screenshots never caught that the project had **no `.focus()` call anywhere in `src/`**. Sibling finding, from reading rather than running: this tracker's own Outstanding-actions list named "F06's calendar `role="grid"` roving focus" as a surface to audit, and that pattern **was never built** — a to-do describing work as existing is worse than one describing it as missing.
- **F17** — **an OR-shaped policy can be *wider* than the action it backs, and then the action is the only guard — the inverse of this project's usual arrangement.** F17 met it twice in one feature, in opposite directions. `listings_delete_own_or_admin` is `host_id = uid OR is_admin()`, so `adminDeleteListing` — which deliberately drops F10's upcoming-booking guard to keep the spam escape hatch — would otherwise let any *host* route their own listing through it and erase live reservations. Proved by impersonation in SQL, not argued: non-admin host, one upcoming confirmed stay, `delete` returned OK and left zero rows. Meanwhile `listings_update_own` is `host_id = uid` with **no admin branch at all**, so an admin unpublish was an UPDATE matching zero rows and returning `{ error: null }` — F13's trap, sitting in the verb this dashboard is meant to *prefer*, and the build plan had asserted the opposite. **Generalises: for every admin write, ask both halves — "who else does this policy admit?" and "does it admit the admin at all?" The answers are independent, and neither is visible from the action.** The fix for the second was a narrow definer function rather than `or is_admin()` on the policy, because **no column grant restricts listing writes** — widening would have handed an admin `host_id`, i.e. the power to reassign someone's listing. Sibling finding, from actually running the suite: `second-user.spec.ts` had been asserting on `FeaturePlaceholder` copy since F04, so the only test of `/admin` was pinned to scaffolding rather than to behaviour.
- **F12** — **a guard the database also enforces cannot be gated by a test, and the test will pass anyway.** The spec proving `createBooking` refuses taken dates was written against a *booking* overlap — and it **passed with the availability check deleted**, because `bookings_no_overlap` refused the insert and `23P01` maps to the same sentence the guard produces. The gate had to move to the case no constraint can reach: a booking over a host's `blocked_dates`, where nothing in Postgres expresses a rule spanning two tables. **Generalises: when writing a gate proof, first ask which layer would catch the defect if this layer were missing** — if a lower one would, the spec is measuring that instead. The same reasoning re-priced F12's fixture listing: at $123.00 the service fee is 51660 cents whether you round or truncate, so the cents assertion passed against `Math.floor`; at $123.33 the two answers differ and the spec gates the rounding rule end to end. **F13's cancel window (also DB-enforced, via the UPDATE policy) is the next place this applies.**
- **F13** — **RLS refuses a write by filtering, not by raising — so a refused UPDATE is indistinguishable from a successful one.** The cancellation window lives entirely in `bookings_update_cancel_own_or_admin`'s USING clause, so `cancelBooking` re-checking it would buy nothing; what only the action can do is notice that **zero rows changed**, because Postgres returns `{ error: null }` either way. Gate-proved: with the `!data` branch removed, cancelling an in-progress stay showed the guest no refusal at all while the row stayed `confirmed`. **Generalises: after any RLS-scoped UPDATE or DELETE, the row count *is* the authorization result — `.select()` it and treat empty as refusal.** F17's admin cancel and unpublish are the next place this applies, and its delete has the same shape. Its sibling finding: `/trips` needed an explicit `guest_id` filter because the `bookings` SELECT policy also admits hosts and admins — **the inverse of `getFavorites`, where leaning on RLS is correct** — so "does the policy answer exactly my question?" has to be asked per table, not per project.
- **F14** — **a policy that admits three principals answers a question none of them asked.** `bookings_select_participant_or_admin` is `guest OR host OR is_admin()`, so the *same row* is legitimately readable by two screens that must never show it to each other — and every query over that table has to say which reader it is for. F13 filtered `guest_id`; F14 filters `listing_id` to owned listings, and its gate proof is F13's inverted: a stay where the fixture user is the **guest** must not surface among their reservations. It failed exactly as intended with the filter deleted, and RLS never would have caught it. **Generalises: RLS scopes to a union of principals, not to a role — so "which of these principals am I rendering for?" is a question the query must answer, never the policy.** Corollary found the same way: read the policy before deciding what a screen *can't* do. "Read-only for the host" looked like scope, but the UPDATE policy names only the guest and `is_admin()`, so a host has no write path to `bookings` at all and a cancel button would need a migration, not a component. **F17 is where both bite hardest** — an admin satisfies every branch of every policy, so its queries have nothing left to scope them but intent.
- **F15** — **"RLS refuses by filtering, not raising" is true of UPDATE and DELETE and false of INSERT — and one feature can need both.** F13's rule sent `cancelBooking` looking for a zero row count, because a refused UPDATE returns `{ error: null }` and looks like success. A refused INSERT does not: a failed `WITH CHECK` **raises `42501`**. So F15's two actions are deliberately opposite shapes — `createReview` maps error codes to sentences (`23505` → already reviewed, `42501` → not finished yet) and has no zero-row branch, while `deleteReview` has the zero-row branch and no code mapping. Writing them alike would have left one silently broken. **Generalises: before reusing a write-path pattern, ask which verb it was learned from** — the three DML verbs fail in genuinely different ways, and only DELETE/UPDATE fail quietly. Its sibling finding came from actually *running* a gate proof: the one for "a stay cannot be reviewed twice" **passed**, because `TripReview` tested `review` before `canReview` and was enforcing one-per-booking a second time, leaving `canReviewBooking`'s `hasReview` argument unreachable. Nothing misbehaved — but the rule had quietly moved out of the function that documents it, and only a proof that was *executed* rather than assumed could show that. **F16's mark-as-read is the next INSERT/UPDATE pair where the distinction bites.**
- **F16** — **F13's zero-row rule is about what emptiness can *only* mean, not about row counts.** F15 predicted this would be the next place the INSERT/UPDATE distinction bites, and it was — but the answer inverted. `cancelBooking` must treat a zero-row UPDATE as a refusal because that is the only thing it can be. `markThreadRead` filters `sender_id <> me AND read_at is null`, so **zero rows is the ordinary outcome** — every open of an already-read thread legitimately matches nothing — making it the one RLS-scoped UPDATE in the project with **no** zero-row branch. **Generalises: before reusing F13's guard, ask whether the statement's own filters make emptiness normal.** Two siblings from the same feature. First, **an authorization failure in a push channel arrives as silence, not as an error**: Realtime evaluates the table's SELECT policy against the token the *socket* carries, and the browser client adopts its session from cookies asynchronously — so a channel opened on mount connects as `anon`, matches nothing, and reports success, which is indistinguishable from a feature nobody wired up. `setAuth` before `subscribe` is the fix, and a standalone probe is what separated "Realtime is broken" from "our client is anonymous". Second, **an OR-shaped INSERT policy can be looser than the app that uses it**: `message_threads_insert_participant` admits `guest_id = uid OR host_id = uid`, so it would accept a thread naming an arbitrary stranger as the guest — the action derives both participants and never builds such a row, but RLS is not the backstop here, it is the gap. **F17 inherits both hazards F16 recorded and could not fix without a migration.**

---

## Pruned from Key Decisions (kept for the record)

> - **Phase 3 close-out** — **a suite with one account can only ask RLS half of every
>   question, and the half it can ask returns the reassuring answer.** Three gaps stayed
>   open from F04 to F11 because the Playwright fixture user was the only principal that
>   could sign in: it was always the host of anything it unpublished, always the sole
>   writer of its own favorites, and never safely flippable to admin. A second account
>   closed all three at once, and the shape generalises past testing: **whenever behaviour
>   depends on who is asking, one identity cannot verify it.** F14's host reservations need
>   a guest who is not the host, and F16's messaging needs two participants — both are this
>   same requirement arriving as a feature. Corollary: a fixture account granted `is_admin`
>   must give it back in a `finally` **and** in global teardown, because fixture passwords
>   are committed and a timeout skips the `finally`. *(Pruned in F18 at the ~10-bullet cap
>   — no longer a pending decision but a structural fact of the suite. `SECOND_USER` exists,
>   `e2e/constants.ts` documents when to reach for it, `code-standards.md` → Testing states
>   the rule and the `finally`/teardown requirement, and F12, F14, F16 and F17 have all used
>   it without incident. F17 extended the corollary rather than rediscovering it: because
>   `fullyParallel: true` orders nothing **between** files, one file must own the `is_admin`
>   flag outright — which is why F18's `keyboard.spec.ts` deliberately asserts its two-step
>   confirm on a host control rather than an admin one. Reasoning preserved in
>   `build-journal.md` → Phase 3 close-out.)*

> - **F11** — **a negative assertion needs a positive control, or it passes for the wrong
>   reason.** The spec proving `/host/listings/[id]/availability` 404s for a non-owner
>   named a listing id that did not exist, so the route 404'd because the row was missing
>   — and the spec **passed with `host_id` scoping deleted from the query**. It now uses a
>   real seeded listing and additionally asserts that listing serves **200** on its public
>   page, so the 404 can only mean "not yours". Generalises: every "X is refused" needs a
>   paired proof that X succeeds when it should. *(Pruned in F17 at the ~10-bullet cap —
>   it is the specific case of F08's general rule ("prove the test fails before trusting
>   that it passes"), which remains on the list, and it has been applied without incident
>   in F12, F13, F14 and F15. F17 applied it three more times as habit rather than as a
>   pending decision: the unpublish spec asserts the row starts published, the route-gate
>   spec asserts the redirect before granting admin, and the delete spec backs out of the
>   confirm and checks the listing survives. Reasoning preserved in `build-journal.md` →
>   F11.)*

> - **F09** — **a validation schema used on both sides of a boundary must accept its own
>   output.** The form validates with `createListingSchema`, posts the *result* to the
>   server action, and the action re-validates with the same schema — so `parse(parse(x))`
>   has to succeed. It did not: the optional-text fields emitted `null` but accepted only
>   `string | undefined`, and every listing with a blank description passed on the client
>   then failed on the server with a message naming no field. *(Pruned in F16 at the
>   ~10-bullet cap — no longer a pending decision but a standing test-writing habit, and
>   one that has since been applied without incident: F15's `createReviewSchema` and F16's
>   `sendMessageSchema` each ship a `parse(parse(x))` unit test written from this rule
>   rather than from a bug. The reasoning is preserved in `build-journal.md` → F09, and
>   `library-docs.md` → Zod carries the `.nullish()` shape that makes it hold.)*

> - **F02** — **RLS filters rows, not columns.** Rules of the form "may update, but only
>   this column" (`profiles.is_admin`, booking price snapshots, message bodies) are
>   enforced by column-level `GRANT`s alongside the policies; "none" cells are revoked
>   outright, because RLS with no matching policy silently updates zero rows and reports
>   success. Verified by `supabase/tests/schema-verification.sql` (37 assertions, all
>   passing). *(Pruned in F15 at the ~10-bullet cap — no longer a pending decision but a
>   standing hard rule, stated in three places: `architecture.md` → Invariants, its
>   dedicated "Column-level grants — RLS filters rows, not columns" section with the full
>   writable-columns table, and `code-standards.md`. F15 is a live instance of it —
>   reviews are immutable because `0006` **revokes UPDATE**, not because a policy forbids
>   it — and F15's own Key Decision carries the half of this that is still load-bearing:
>   that a policy miss on UPDATE/DELETE is silent, and on INSERT is not.)*

> - **F07** — a route `loading.tsx` and a real HTTP 404 cannot coexist. The implicit
>   `<Suspense>` it creates makes the response stream, and the status commits to **200
>   before `notFound()` runs** (Next: "a 404 status for non-streamed responses and a 200
>   for streamed"). Drafts would have been indexable as live pages. `loading.tsx` was
>   dropped; the specs gate against restoring it. *(Pruned in F14 at the ~10-bullet cap —
>   no longer a pending decision but a hard rule, written into `code-standards.md` →
>   Next.js Conventions with the quote and the reasoning, and there are now **zero**
>   `loading.tsx` files in the project. Every route since has chosen deliberately: F13's
>   `/trips` and F14's `/host/reservations` both record in their page docblocks that they
>   *could* have one — neither can 404 — and gain nothing from it. F17's `/admin` is the
>   next route where the 404 half actually bites.)*

> - **F09** — a library that throws on missing config turns a misconfiguration into
>   a 500. `CldImage` throws without a cloud name and `CldUploadWidget` throws
>   without a *browser-visible* api_key — both during render, so one unset env var
>   took down `/listings/[id]` and `/host/listings/[id]/photos` entirely rather than
>   degrading. Both are now guarded and fall back. It also surfaced that the
>   Cloudinary **api_key is public** while the **secret** authorises. *(Pruned in F13
>   at the ~10-bullet cap — built, guarded and fully specified in `library-docs.md` →
>   Cloudinary, whose "Environment — three public values, one secret" block states
>   both halves, and in `code-standards.md` → Environment Variables. The
>   render-it-once-with-the-config-absent lesson still applies to F16's Realtime and
>   F18's deploy, and is recorded in `build-journal.md` → F09.)*

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
