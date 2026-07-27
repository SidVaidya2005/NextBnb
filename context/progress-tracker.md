# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly. Per-feature narrative — decisions,
> gotchas, verification — lives in `build-journal.md`; this file stays short enough
> to read in full at session start.

---

## Current Status

**Phase:** Phase 5 — Engagement (in progress)
**Last completed:** 15 Reviews & ratings
**Next:** 16 Guest ↔ host messaging (Phase 5 — Engagement)

F15 built the review **write** path — the read half (`averageRating`,
`ReviewsSection`, the card rating) has shipped since F05/F07. A finished stay's
card in `/trips` → Past carries a star radio group and an optional comment, and
once posted reads the review back with the delete that is the only way to change
one (`0006` revokes UPDATE outright). Its useful finding: **an INSERT raises
where an UPDATE filters**, so F13's zero-row rule applies to `deleteReview` and
not to `createReview`, and the two actions are deliberately opposite shapes.
Full detail: `build-journal.md` → F15.

### Live baselines (F15 close, 2026-07-27)

Treat any deviation from these as a finding, not a new normal.

| Gate | Value |
| ---- | ----- |
| `npx tsc --noEmit` / `npm run lint` | clean |
| `npm run test` (unit) | 255/255 |
| `npm run test:e2e` | 345 passed / 3 skipped |
| `npm run build` | green, **15 routes**, `ƒ Proxy (Middleware)` printing |
| `seed-verification.sql` | **45/46 — the seed has aged out, see below** |
| Seed rows | 26 listings (24 published) / 130 photos / 17 bookings / 7 reviews / 5 blocks / 0 favorites |
| Fixture residue after a full run | 0 listings, 0 bookings, 0 reviews, **exactly one admin** (developer's Google account) |
| Security advisors | **7 WARNs — an 8th is a finding** |
| Migrations vs remote | 8/8 matching |

**`seed-verification.sql` is 45/46 and the failure is not a code defect.**
`temporal: at least one in-progress stay exists` fails because seeded booking 14
was written `current_date - 2 → current_date + 3` on 2026-07-24, fixing it at
2026-07-22 → 2026-07-27 — so as of 2026-07-27 its checkout is *today* and it has
aged out of the window. This is the file's own documented failure mode (section
9: *"if this ever fails, the seed has aged out and needs re-running"*), it
predates F15 (whose diff contains no SQL, migration or seed file), and the E2E
suite is unaffected because `trips.spec.ts` builds its own in-progress row.
**Fixing it means re-running `supabase/seed.sql`, which begins with a cascading
`delete from auth.users` — a destructive action left for the developer to
schedule.** Expect 46/46 afterwards.

**`bookings` now totals 18, and the extra row is real.** The developer's own Google
account holds a genuine upcoming stay (Jul 27–30 on a seeded listing), booked
through the UI. `seed-verification.sql` scopes every assertion to the
`30000000-…` id prefix, so it still reads 17 and passes — but a whole-table count
of `bookings` is no longer 17 and should not be treated as residue. Re-confirmed
at F14 close: 18 bookings, 26 listings, 0 fixture-owned rows, exactly one admin.

The 7 WARNs are all intentional: `authenticated` EXECUTE on `is_admin()` and
`admin_list_users()` (both load-bearing); leaked-password protection off
(Pro-plan-only); and anon+authenticated EXECUTE on each of the two definer
functions `unavailable_listing_ids()` (F06) and `listing_occupied_ranges()`
(F12) — occupancy is public in this product and both are narrowed to published
listings.

### Remaining loose ends

Triaged and accepted. Each is expanded in the relevant `build-journal.md` entry.

**Untested branches** (written, reasoned, never executed)
- **The `{ ok: false }` Supabase-error branch of every action** — `setFavorite`
  (F08), `updateListing`/`deleteListing` (F10), `addBlock`/`removeBlock` (F11),
  `createBooking` (F12), `cancelBooking` (F13), `createReview`/`deleteReview`
  (F15). Guard refusals and not-found paths *are* covered; a genuine database
  error is not. Same shape as F05's untriggered `error.tsx`. **The zero-row
  branches are the exception** — they are refusals, not errors, and both F13's
  and F15's are gate-proved. F14 adds the read-side twin: `getHostReservations`'
  two error branches, and its `hostsNothing: false` distinction between "hosts
  nothing" and "the query failed", are reasoned about rather than executed.
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

**Outstanding actions**
- **No keyboard or screen-reader pass**, now eight features running (F06's
  calendar `role="grid"` roving focus, F08's heart, F09's form, F10's two-step
  delete, F11's calendar, F12's stepper/popover/sheet — the sheet is a
  `role="dialog"` with **no focus trap and no focus restore** — and F13's
  two-step cancel, which moves focus nowhere when it swaps controls). **F18 owns it.**
  F14 adds nothing to this list: `/host/reservations` renders no interactive
  control at all beyond one link per card. **F15 adds one two-step control (the
  review delete, with F13's same focus gap) but subtracts risk elsewhere:**
  `RatingInput` is a native radio group, so its keyboard behaviour is the
  browser's rather than something F18 must audit.
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
- [ ] 16 Guest ↔ host messaging

### Phase 6 — Admin & Polish
- [ ] 17 Admin dashboard
- [ ] 18 Responsive QA, polish & deploy

---

## Key Decisions

> At the ~10-bullet cap. **F16 must prune one into `build-journal.md` before adding.**

- **F06** — **RLS can make a feature impossible in application code without ever raising an error.** The date filter looked like ordinary app logic until the `bookings` SELECT policy was read carefully: anon reads *zero* booking rows, so a nested select returns `[]` and every listing reads as available — a wrong answer that arrives as a success. It is now the `unavailable_listing_ids()` definer function (`0007`), returning published ids only. **Generalises: before computing anything from a table, check what the *least* privileged reader of that table can see.** The same trap waited in F12's booking widget — and was sharper there, because *any* signed-in guest reads zero rows for a listing they do not host.
- **F08** — **a green assertion is not a gating assertion; run every new spec against a deliberately broken build.** `toHaveURL('/')` passes instantly when the page is already at `/`, so the spec guarding "the heart must not navigate" passed against the exact markup it existed to reject. Two further F08 traps rhyme with it: postgrest-js types a to-one embed on a NOT NULL FK as never-null while RLS returns null at runtime (the `toFavoriteCards` filter is load-bearing and TS would never demand it), and a spec that snapshots whole-user state races the parallel workers sharing that user. **Generalises: prove the test fails before trusting that it passes.**
- **F09** — **a validation schema used on both sides of a boundary must accept its own output.** The form validates with `createListingSchema`, posts the *result* to the server action, and the action re-validates with the same schema — so `parse(parse(x))` has to succeed. It did not: the optional-text fields emitted `null` but accepted only `string | undefined`, and every listing with a blank description passed on the client then failed on the server with a message naming no field. **Generalises: whenever one schema guards both a form and the action behind it, test it against its own output** — the two directions are each correct in isolation, which is exactly why nothing else catches it.
- **F10** — **an FK cascade is a destructive path with no error, no test and no type pointing at it.** `bookings.listing_id` is `on delete cascade`, so a host deleting a listing does not *cancel* its reservations — it erases them, leaving the guest nothing in `/trips` and no record a stay ever existed. It is now guarded in the action (refuse while a confirmed stay is still coming, steer to unpublish), stated in the UI rather than only disabled, and the cutoff is widened by a day so the JS/`current_date` boundary can only ever err toward refusing. **Generalises: before shipping a delete, read the FK actions on every table that references the row — the blast radius is in the schema, not in the feature.** F17's admin delete is the same cascade with the guard deliberately absent.
- **Phase 3 close-out** — **a suite with one account can only ask RLS half of every question, and the half it can ask returns the reassuring answer.** Three gaps stayed open from F04 to F11 because the Playwright fixture user was the only principal that could sign in: it was always the host of anything it unpublished, always the sole writer of its own favorites, and never safely flippable to admin. A second account closed all three at once, and the shape generalises past testing: **whenever behaviour depends on who is asking, one identity cannot verify it.** F14's host reservations need a guest who is not the host, and F16's messaging needs two participants — both are this same requirement arriving as a feature. Corollary: a fixture account granted `is_admin` must give it back in a `finally` **and** in global teardown, because fixture passwords are committed and a timeout skips the `finally`.
- **F11** — **a negative assertion needs a positive control, or it passes for the wrong reason.** The spec proving `/host/listings/[id]/availability` 404s for a non-owner named a listing id that did not exist, so the route 404'd because the row was missing — and the spec **passed with `host_id` scoping deleted from the query**. It now uses a real seeded listing and additionally asserts that listing serves **200** on its public page, so the 404 can only mean "not yours". **Generalises: every "X is refused" needs a paired proof that X succeeds when it should — otherwise the refusal may be measuring the setup, not the rule.** F15's one-review-per-booking is the next place it applies.
- **F12** — **a guard the database also enforces cannot be gated by a test, and the test will pass anyway.** The spec proving `createBooking` refuses taken dates was written against a *booking* overlap — and it **passed with the availability check deleted**, because `bookings_no_overlap` refused the insert and `23P01` maps to the same sentence the guard produces. The gate had to move to the case no constraint can reach: a booking over a host's `blocked_dates`, where nothing in Postgres expresses a rule spanning two tables. **Generalises: when writing a gate proof, first ask which layer would catch the defect if this layer were missing** — if a lower one would, the spec is measuring that instead. The same reasoning re-priced F12's fixture listing: at $123.00 the service fee is 51660 cents whether you round or truncate, so the cents assertion passed against `Math.floor`; at $123.33 the two answers differ and the spec gates the rounding rule end to end. **F13's cancel window (also DB-enforced, via the UPDATE policy) is the next place this applies.**
- **F13** — **RLS refuses a write by filtering, not by raising — so a refused UPDATE is indistinguishable from a successful one.** The cancellation window lives entirely in `bookings_update_cancel_own_or_admin`'s USING clause, so `cancelBooking` re-checking it would buy nothing; what only the action can do is notice that **zero rows changed**, because Postgres returns `{ error: null }` either way. Gate-proved: with the `!data` branch removed, cancelling an in-progress stay showed the guest no refusal at all while the row stayed `confirmed`. **Generalises: after any RLS-scoped UPDATE or DELETE, the row count *is* the authorization result — `.select()` it and treat empty as refusal.** F17's admin cancel and unpublish are the next place this applies, and its delete has the same shape. Its sibling finding: `/trips` needed an explicit `guest_id` filter because the `bookings` SELECT policy also admits hosts and admins — **the inverse of `getFavorites`, where leaning on RLS is correct** — so "does the policy answer exactly my question?" has to be asked per table, not per project.
- **F14** — **a policy that admits three principals answers a question none of them asked.** `bookings_select_participant_or_admin` is `guest OR host OR is_admin()`, so the *same row* is legitimately readable by two screens that must never show it to each other — and every query over that table has to say which reader it is for. F13 filtered `guest_id`; F14 filters `listing_id` to owned listings, and its gate proof is F13's inverted: a stay where the fixture user is the **guest** must not surface among their reservations. It failed exactly as intended with the filter deleted, and RLS never would have caught it. **Generalises: RLS scopes to a union of principals, not to a role — so "which of these principals am I rendering for?" is a question the query must answer, never the policy.** Corollary found the same way: read the policy before deciding what a screen *can't* do. "Read-only for the host" looked like scope, but the UPDATE policy names only the guest and `is_admin()`, so a host has no write path to `bookings` at all and a cancel button would need a migration, not a component. **F17 is where both bite hardest** — an admin satisfies every branch of every policy, so its queries have nothing left to scope them but intent.
- **F15** — **"RLS refuses by filtering, not raising" is true of UPDATE and DELETE and false of INSERT — and one feature can need both.** F13's rule sent `cancelBooking` looking for a zero row count, because a refused UPDATE returns `{ error: null }` and looks like success. A refused INSERT does not: a failed `WITH CHECK` **raises `42501`**. So F15's two actions are deliberately opposite shapes — `createReview` maps error codes to sentences (`23505` → already reviewed, `42501` → not finished yet) and has no zero-row branch, while `deleteReview` has the zero-row branch and no code mapping. Writing them alike would have left one silently broken. **Generalises: before reusing a write-path pattern, ask which verb it was learned from** — the three DML verbs fail in genuinely different ways, and only DELETE/UPDATE fail quietly. Its sibling finding came from actually *running* a gate proof: the one for "a stay cannot be reviewed twice" **passed**, because `TripReview` tested `review` before `canReview` and was enforcing one-per-booking a second time, leaving `canReviewBooking`'s `hasReview` argument unreachable. Nothing misbehaved — but the rule had quietly moved out of the function that documents it, and only a proof that was *executed* rather than assumed could show that. **F16's mark-as-read is the next INSERT/UPDATE pair where the distinction bites.**

---

## Pruned from Key Decisions (kept for the record)

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
