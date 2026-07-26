# Progress Tracker

> **Role:** Live build status — what's done, in progress, and next.
> **Read at the start of every session**; **update after every completed feature.**
> **Relates to:** mirrors `build-plan.md` exactly. Per-feature narrative — decisions,
> gotchas, verification — lives in `build-journal.md`; this file stays short enough
> to read in full at session start.

---

## Current Status

**Phase:** Phase 4 — Booking (in progress)
**Last completed:** 12 Instant Book
**Next:** 13 Trips (guest reservations)

F12 made booking real: a guest picks dates on a calendar that greys out what is
taken, and Reserve writes a `confirmed` booking whose nights are then gone for
everyone else. Confirmation is in-page because `/trips` is still F13's
placeholder. Full detail: `build-journal.md` → F12.

### Live baselines (F12 close, 2026-07-26)

Treat any deviation from these as a finding, not a new normal.

| Gate | Value |
| ---- | ----- |
| `npx tsc --noEmit` / `npm run lint` | clean |
| `npm run test` (unit) | 211/211 |
| `npm run test:e2e` | 295 passed / 3 skipped |
| `npm run build` | green, **15 routes**, `ƒ Proxy (Middleware)` printing |
| `seed-verification.sql` | 46/46 |
| Seed rows | 26 listings (24 published) / 130 photos / 17 bookings / 7 reviews / 5 blocks / 0 favorites |
| Fixture residue after a full run | 0 listings, 0 bookings, **exactly one admin** (developer's Google account) |
| Security advisors | **7 WARNs — an 8th is a finding** |
| Migrations vs remote | 8/8 matching |

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
  `createBooking` (F12). Guard refusals and not-found paths *are* covered; a
  genuine database error is not. Same shape as F05's untriggered `error.tsx`.
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
- **No keyboard or screen-reader pass**, now seven features running (F06's
  calendar `role="grid"` roving focus, F08's heart, F09's form, F10's two-step
  delete, F11's calendar, F12's stepper/popover/sheet — the sheet is a
  `role="dialog"` with **no focus trap and no focus restore**). **F18 owns it.**
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

> At the ~10-bullet cap. **F13 must prune one into `build-journal.md` before adding.**

- **F02** — **RLS filters rows, not columns.** Rules of the form "may update, but only this column" (`profiles.is_admin`, booking price snapshots, message bodies) are enforced by column-level `GRANT`s alongside the policies; "none" cells are revoked outright, because RLS with no matching policy silently updates zero rows and reports success. Verified by `supabase/tests/schema-verification.sql` (37 assertions, all passing).
- **F06** — **RLS can make a feature impossible in application code without ever raising an error.** The date filter looked like ordinary app logic until the `bookings` SELECT policy was read carefully: anon reads *zero* booking rows, so a nested select returns `[]` and every listing reads as available — a wrong answer that arrives as a success. It is now the `unavailable_listing_ids()` definer function (`0007`), returning published ids only. **Generalises: before computing anything from a table, check what the *least* privileged reader of that table can see.** The same trap waited in F12's booking widget — and was sharper there, because *any* signed-in guest reads zero rows for a listing they do not host.
- **F07** — **a route `loading.tsx` and a real HTTP 404 cannot coexist.** The implicit `<Suspense>` it creates makes the response stream, and the status commits to **200 before `notFound()` runs** (Next: "a 404 status for non-streamed responses and a 200 for streamed"). Drafts would have been indexable as live pages. `loading.tsx` was dropped; the specs gate against restoring it. **Applies to every future route that can 404** — F13 `/trips`, F14, F17 — so choose the status over the skeleton unless the route can never 404.
- **F08** — **a green assertion is not a gating assertion; run every new spec against a deliberately broken build.** `toHaveURL('/')` passes instantly when the page is already at `/`, so the spec guarding "the heart must not navigate" passed against the exact markup it existed to reject. Two further F08 traps rhyme with it: postgrest-js types a to-one embed on a NOT NULL FK as never-null while RLS returns null at runtime (the `toFavoriteCards` filter is load-bearing and TS would never demand it), and a spec that snapshots whole-user state races the parallel workers sharing that user. **Generalises: prove the test fails before trusting that it passes.**
- **F09** — **a library that throws on missing config turns a misconfiguration into a 500.** `CldImage` throws without a cloud name and `CldUploadWidget` throws without a *browser-visible* api_key — both during render, so one unset env var took down `/listings/[id]` and `/host/listings/[id]/photos` entirely rather than degrading. Both are now guarded and fall back. It also surfaced that the Cloudinary **api_key is public** while the **secret** authorises — `NEXT_PUBLIC_CLOUDINARY_API_KEY` is therefore correct and `architecture.md`'s invariant, which names only the secret, still holds. **Generalises: before trusting an integration, render it once with the config absent** — F16's Realtime and F18's deploy have the same shape.
- **F09** — **a validation schema used on both sides of a boundary must accept its own output.** The form validates with `createListingSchema`, posts the *result* to the server action, and the action re-validates with the same schema — so `parse(parse(x))` has to succeed. It did not: the optional-text fields emitted `null` but accepted only `string | undefined`, and every listing with a blank description passed on the client then failed on the server with a message naming no field. **Generalises: whenever one schema guards both a form and the action behind it, test it against its own output** — the two directions are each correct in isolation, which is exactly why nothing else catches it.
- **F10** — **an FK cascade is a destructive path with no error, no test and no type pointing at it.** `bookings.listing_id` is `on delete cascade`, so a host deleting a listing does not *cancel* its reservations — it erases them, leaving the guest nothing in `/trips` and no record a stay ever existed. It is now guarded in the action (refuse while a confirmed stay is still coming, steer to unpublish), stated in the UI rather than only disabled, and the cutoff is widened by a day so the JS/`current_date` boundary can only ever err toward refusing. **Generalises: before shipping a delete, read the FK actions on every table that references the row — the blast radius is in the schema, not in the feature.** F17's admin delete is the same cascade with the guard deliberately absent.
- **Phase 3 close-out** — **a suite with one account can only ask RLS half of every question, and the half it can ask returns the reassuring answer.** Three gaps stayed open from F04 to F11 because the Playwright fixture user was the only principal that could sign in: it was always the host of anything it unpublished, always the sole writer of its own favorites, and never safely flippable to admin. A second account closed all three at once, and the shape generalises past testing: **whenever behaviour depends on who is asking, one identity cannot verify it.** F14's host reservations need a guest who is not the host, and F16's messaging needs two participants — both are this same requirement arriving as a feature. Corollary: a fixture account granted `is_admin` must give it back in a `finally` **and** in global teardown, because fixture passwords are committed and a timeout skips the `finally`.
- **F11** — **a negative assertion needs a positive control, or it passes for the wrong reason.** The spec proving `/host/listings/[id]/availability` 404s for a non-owner named a listing id that did not exist, so the route 404'd because the row was missing — and the spec **passed with `host_id` scoping deleted from the query**. It now uses a real seeded listing and additionally asserts that listing serves **200** on its public page, so the 404 can only mean "not yours". **Generalises: every "X is refused" needs a paired proof that X succeeds when it should — otherwise the refusal may be measuring the setup, not the rule.** F15's one-review-per-booking is the next place it applies.
- **F12** — **a guard the database also enforces cannot be gated by a test, and the test will pass anyway.** The spec proving `createBooking` refuses taken dates was written against a *booking* overlap — and it **passed with the availability check deleted**, because `bookings_no_overlap` refused the insert and `23P01` maps to the same sentence the guard produces. The gate had to move to the case no constraint can reach: a booking over a host's `blocked_dates`, where nothing in Postgres expresses a rule spanning two tables. **Generalises: when writing a gate proof, first ask which layer would catch the defect if this layer were missing** — if a lower one would, the spec is measuring that instead. The same reasoning re-priced F12's fixture listing: at $123.00 the service fee is 51660 cents whether you round or truncate, so the cents assertion passed against `Math.floor`; at $123.33 the two answers differ and the spec gates the rounding rule end to end. **F13's cancel window (also DB-enforced, via the UPDATE policy) is the next place this applies.**

---

## Pruned from Key Decisions (kept for the record)

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
