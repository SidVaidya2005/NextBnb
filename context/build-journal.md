# Build Journal

> **Role:** Full archive of build decisions, gotchas, and verification results, organized by feature.
> **Write to after every completed feature.** When `progress-tracker.md` "Key Decisions" exceeds ~10 bullets, prune the older/lower-stakes ones here.
> **Relates to:** mirrors the feature order in `build-plan.md`.

## How to maintain this file

Mostly append — but it is **not** append-only, because an entry that has quietly
become false is worse than no entry. Editing rules, adopted 2026-07-26:

- **Correct, don't rewrite.** When a past claim turns out wrong, leave the original
  text and add a dated `> **Corrected YYYY-MM-DD:** …` blockquote beneath it. The
  superseded belief usually explains a decision made at the time — delete it and that
  decision reads as arbitrary.
- **Mark open items resolved, don't delete them.** When a "Not verified" or "Deferred"
  item closes, append `→ **Closed by F<NN>** (date): <what closed it>` under it. How
  long a gap stayed open is itself evidence — the Phase 3 close-out's whole lesson is
  that three gaps survived from F04 to F11 for one structural reason.
- **A prediction that didn't come true gets `→ **Did not happen.**`** plus what
  happened instead. These are the entries most likely to mislead, because they read
  as statements of fact.
- **Never remove:** wrong turns and failed diagnoses, verification evidence and
  numbers, or library/framework gotchas — even where the code has moved on. These are
  the asset; every Key Decision in `progress-tracker.md` came from one of them.
- **Delete only** genuinely redundant boilerplate repeated across entries (see
  Standing environment notes below for where such notes belong instead).
- **Never prune for length.** This file is read on demand, not per session, so its
  size costs nothing. Edit it for accuracy only.

<!-- Entry format — repeat per completed feature:

## Phase {{N}} · Feature {{NN}} — {{FEATURE_NAME}}  *(YYYY-MM-DD)*
- Decision: …
- Gotcha: …
- Verified: …

-->

## Standing environment notes

Known, accepted, and deliberately not re-litigated per feature. Recorded here so
entries below do not each carry a copy.

- **The stray `~/package-lock.json` multiple-lockfile warning is cosmetic and out of
  scope.** A lockfile dated 2026-03-11 in the developer's home directory makes Next
  infer the wrong workspace root ("detected multiple lockfiles"). It is outside the
  repo, affects nothing, and is left alone deliberately. First observed in F02 and
  unchanged through F12; the per-feature repetitions of this note were consolidated
  here during the 2026-07-26 context audit. If it ever stops being cosmetic, that is
  a finding worth its own entry.

---

## Phase 1 · Feature 01 — Project scaffold, design tokens & integrations  *(2026-07-25)*

**Scope built (26 files):** Runnable Next 16 (App Router, React 19, TS strict) skeleton on
Tailwind v4; DESIGN.md tokens + custom breakpoints in `globals.css @theme`; Inter via
`next/font`; static `TopNav` shell (responsive: mobile = logo + hamburger, tablet+ = logo +
search-pill placeholder + account placeholder); Supabase `server`/`client`/`middleware`
modules + `src/middleware.ts`; `cloudinary.ts` + `/api/sign-cloudinary`; `constants.ts`,
`utils.ts` (`ActionResult`, `formatPrice`, `nightsBetween`, `cn`); placeholder
`database.types.ts`; Vitest + Playwright configs with passing smoke tests.

**Decisions:**
- **Hand-authored the whole tree** (no `create-next-app`) — deterministic/reproducible, and Node isn't on the agent shell's PATH, so the developer runs `npm`/`npx` in their own terminal (Node 26.5.0).
  > **Corrected 2026-07-26:** Node **is** on the agent shell (v26.5.0) and has been
  > since F02 — run `tsc`/`lint`/`vitest`/`playwright` directly. The belief recorded
  > here is why F01 handed verification to the developer; it stays so that choice
  > still makes sense.
- **Deferred credentials.** `updateSession` in `lib/supabase/middleware.ts` skips the auth refresh when `NEXT_PUBLIC_SUPABASE_URL`/anon key are empty, so the app boots on placeholder `.env.local`. Real project + route protection exercised from F02/F04.
- **Scoped runtime deps to F01's imports.** Deferred `next-cloudinary` (F07 — also had a Next-16 peer-dep risk), `zod` (F06), `react-hook-form` + `@hookform/resolvers` (F09) to the features that first use them. Full test/lint toolchain kept — standing up that harness is F01's job.
- `database.types.ts` is a minimal **PLACEHOLDER** (`listings.id`/`host_id` only, for the clients + sign route) — regenerated wholesale in F02.
- UI scope: **nav shell only**; `components/ui` primitives added per feature.
- Added a `--container-wide: 1440px` token — a `--breakpoint-*` token alone does not create a `max-w-*` utility, so `max-w-wide` needs its own container token.

**Gotchas:**
- **A wall of "unrelated" errors = one framework-version problem.** `package.json` got pinned to `next@^9.3.3` mid-verify; the installed Next 9 produced 17 tsc errors, an ESLint parser crash, and "`next.config.ts` is not supported" — all because Next 9 has no App Router / `next/font` / `Metadata` / `next/server`. Fix: restore `^16.0.0`, then **clean reinstall** (`rm -rf node_modules package-lock.json && npm install`) so the Next-9 lockfile tree is discarded. Lesson: when a broad set of type/module errors appears at once, check the installed framework version *first*.
- **`@supabase/ssr@0.6.1` `createServerClient` has two cookie overloads** (`getAll`/`setAll` vs deprecated `get`/`set`/`remove`). Under strict TS the `setAll` callback param won't infer across them → implicit-`any` (10 errors). Fix: annotate `setAll(cookiesToSet: Parameters<SetAllCookies>[0])` in `server.ts` and `middleware.ts`, importing the library's exported `SetAllCookies` type — no hand-written shape, no `any`. Reusable pattern for every future server client.
- **zsh doesn't treat `#` as an inline comment interactively** in this environment, so paste-able command blocks with trailing `# ...` comments passed the comment words as CLI args (`tsc`/`eslint` tried to compile files named `#`, `clean`). Give this developer bare commands, no trailing `#` comments.

**Verified (developer ran, Node 26.5.0):**
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run test` — 7/7 (`formatPrice`, `nightsBetween`).
- `npm run test:e2e` — 1 passed (Playwright booted the Next 16 dev server, loaded `/`, found the "NextBnb" nav shell). App boots on placeholder env — the middleware guard holds.

---

## Phase 1 · Feature 02 — Database schema & RLS  *(2026-07-25)*

**Scope built:** Supabase project **NextBnb** (`mbrcgzpmqhmdfhjqytnq`, ap-south-1,
free plan, $0/mo, PG 17); six migrations in `supabase/migrations/`; nine tables with
enums, checks, the `btree_gist` exclusion constraint, and FK/search indexes; four
`security definer` functions; the full RLS matrix plus column-level grants; Realtime
on `messages`; regenerated `src/types/database.types.ts`;
`supabase/tests/schema-verification.sql` (37 assertions); `.env.local` created with
live credentials.

**Decisions:**
- **Migrations split four ways by concern** (tables / functions / policies+grants / realtime), then two follow-ups from verification — `0005_definer_hardening`, `0006_lock_remaining_writes`. Applied migrations are never rewritten, so remote history and the repo stay in lockstep.
  > **Corrected 2026-07-25:** "in lockstep" held for *content* but not for *version identity* — the
  > files were named `0001_`…`0006_` while the remote recorded 14-digit timestamps, which broke
  > Supabase branching. Files renamed to `<remote-version>_<original-name>.sql`. See the F02
  > follow-up entry at the end of this journal.
- **`admin_list_users()` returns `(id, email)` only.** Names, join dates and counts are already admin-visible through RLS, so the one function that bypasses RLS exposes only the column RLS cannot reach. It guards itself with `is_admin()` *before* touching `auth.users`; the grant to `authenticated` is a second lock, not the gate.
- **Cover photo: at-most-one in the DB** (partial unique index `on (listing_id) where is_cover`), at-least-one guaranteed by F09's create action. Exactly-one would need a deferred constraint trigger firing on every cascade delete.
- **The cancellation window lives in the DB.** The `bookings` UPDATE policy requires `status='confirmed' AND check_in >= current_date`, so F13's action enforces UX, not authorization. Because USING also demands `status='confirmed'`, a cancelled booking can never be un-cancelled.
- **Booking INSERT additionally requires `is_published`** — a draft listing cannot be reserved even if its id leaks.
- **First admin is set by hand** (one `update profiles set is_admin = true` after the developer's first Google sign-in in F04). No bootstrap code, no attack surface.
- Kept the env var name `NEXT_PUBLIC_SUPABASE_ANON_KEY` holding the legacy anon JWT. The project also issues a modern `sb_publishable_…` key; swapping it in later needs no rename.

**Gotchas:**
- **RLS filters rows, not columns — the documented matrix was exploitable.** `profiles` UPDATE scoped to "own row" accepts `set is_admin = true where id = auth.uid()`: the policy sees a permitted *row* and never inspects which column changed. Fixed with `revoke update … / grant update (full_name, avatar_url)`. Same technique makes `bookings` "cancel only" real (price snapshot and dates are unwritable) and `messages` read-receipt-only. This generalises: **any rule phrased "may update, but only X" needs a GRANT, not a policy.**
- **A "none" cell enforced by omission fails silently.** An UPDATE against a table with RLS on and no UPDATE policy matches zero rows and returns *success* — so "reviews are immutable" was true but indistinguishable from "it worked". Caught by the verification script (the immutability assertion passed when it should have failed). `0006` revokes those privileges so refusal is a hard `42501`.
- **`architecture.md` had `messages` UPDATE as "own message (`read_at`)".** Read receipts are stamped by the *reader*, so that policy would have let a sender mark their own outgoing message read while the actual recipient could not — a latent F16 bug. Policy is now `sender_id <> auth.uid()` **and** thread participant. The doc has been corrected.
- **A statement cannot read its own write.** Two verification checks called a mutating helper and asserted the result in the *same* `SELECT`; the subquery used the pre-statement snapshot and reported stale values. Mutation and assertion must be separate statements — the same trap awaits any future SQL test.
- **Unqualified column names inside a policy's `EXISTS` subquery bind to the subquery's table.** In the `reviews` INSERT policy, `b.listing_id = listing_id` would resolve to `b.listing_id = b.listing_id` — always true, silently disabling the check. Every reference to the new row is written `reviews.<col>`.
- **`unique (guest_id, host_id, listing_id)` does not work on `message_threads`** because SQL treats NULLs as distinct, so listing-less threads between the same two people would duplicate forever. Needs `unique nulls not distinct` (PG 15+).
- **Supabase grants EXECUTE on new `public` functions to PUBLIC/anon/authenticated**, exposing every one as `/rest/v1/rpc/<name>`. The advisor flagged the trigger function `handle_new_user()`; revoked. Revoking EXECUTE does not break the trigger — permission is checked when the trigger is created, not when it fires.
- **RLS predicates run with the *querying* role's privileges**, so `anon` needed EXECUTE on `is_admin()` purely because one shared SELECT policy ended in `or is_admin()`. Splitting those three policies per role let the grant be revoked and dropped a definer call from the public listing-page read path.

**Verified:**
- `supabase/tests/schema-verification.sql` — **37/37 PASS**, run via the Supabase MCP. Covers: the `auth.users` trigger (including Google's `name`/`picture` metadata fallback); RLS enabled with ≥1 policy on all nine tables; overlapping bookings rejected (`23P01`); **same-day turnover accepted** (proving `'[)'`, not just that overlap fails); cancelling frees the dates; a past stay is not cancellable; no self-booking; drafts unbookable and invisible to non-owners but visible to owner and admin; price snapshot unwritable; no self-promotion to admin; `admin_list_users()` refuses non-admins; the three review rules; messaging participant isolation and read receipts; favorites privacy; realtime publication = `messages` only; and the amenity, date and cover-photo constraints. The script cleans up after itself — verified 0 rows in all nine tables afterwards.
- `get_advisors(security)` — 2 remaining WARNs, both intentional and load-bearing: `authenticated` must hold EXECUTE on `is_admin()` (RLS predicates call it) and on `admin_list_users()` (that is the design; the internal `is_admin()` check is the gate).
- `get_advisors(performance)` — INFO-level "unused index" only, expected on an empty database that has served no queries.
- **Live REST API, anon key** — `GET /rest/v1/listings` → `200 []`; `POST /rest/v1/listings` → `401 42501`; `POST /rest/v1/rpc/admin_list_users` → `401 permission denied for function`. The grants hold through PostgREST, not just in SQL.
- **Toolchain (run by the agent, Node v26.5.0)** — `npx tsc --noEmit` clean against the regenerated types; `npm run lint` clean; `npm run test` 7/7; `npm run test:e2e` 1 passed. The E2E is the meaningful one: the middleware now has real credentials and calls `getUser()` on every request, so the config guard in `lib/supabase/middleware.ts` has gone live without regressing the boot path.
- Note for future features: **Node/npm are available in the agent shell now** (they were not during F01), so verification no longer needs to be handed to the developer.

**Deferred / follow-ups:**
- `SUPABASE_SERVICE_ROLE_KEY` is still blank in `.env.local` — it is not exposed by any MCP tool. Copy it from the dashboard (Project Settings → API keys → `service_role`) before F03's seed script.
  → **Closed by F04** (2026-07-25): a real `sb_secret_` key is in place. F04 also
    caught that the first value pasted was a *publishable* key, which obeys RLS
    silently — see F04's gotchas.
- Next 16 warns that **the `middleware` file convention is deprecated in favour of `proxy`**. Pre-existing from F01 and harmless today; worth handling in F04 when auth actually exercises the middleware.
  → **Closed by F04** (2026-07-25): renamed to `src/proxy.ts`; the build now prints
    `ƒ Proxy (Middleware)` with no deprecation warning.

---

## Phase 1 · Feature 03 — Seed data  *(2026-07-25)*

**Scope built:** `supabase/seed.sql` — 5 demo users (2 hosts, 3 guests), 26 listings
(24 published + 2 drafts) across 8 cities, 130 Unsplash photos, 17 bookings, 7 reviews,
5 blocked ranges; `supabase/tests/seed-verification.sql` (46 assertions);
`e2e/global-setup.ts` + `globalSetup` wired into `playwright.config.ts`. No migration,
no `src/` change, no new dependency, `database.types.ts` untouched.

**Decisions:**
- **Sentinel prefixes `b000` / `20000000…` / `30000000…`**, deliberately distinct from
  `schema-verification.sql`'s `a000` / `10000000…`. The two scripts share one database
  and must never be able to delete each other's fixtures.
- **All dates relative to `current_date`.** Hard-coded dates would quietly turn every
  "upcoming" booking into a past one within months and break F13's cancel flow with no
  error. Verification asserts all four temporal states (past / upcoming / in-progress /
  cancelled) still exist on every run, so the fixture reports its own ageing.
- **Rows that must obey a rule are derived, not typed.** Bookings `insert … select` their
  price snapshot from `listings`; reviews take `listing_id`/`reviewer_id` from `bookings`.
  This is the structural answer to the RLS-bypass problem below.
- **`0.14` is duplicated from `SERVICE_FEE_PCT` on purpose.** Booking prices are snapshots
  that must never be recomputed, so a future rate change must leave these rows alone.
  Verification checks internal consistency only — comparing a snapshot back to its listing
  would start failing the moment a host edits a price in F10, which is *correct* behaviour.
- **No seeded admin.** A fake user can never sign in (auth is Google-only), so `/admin`
  still needs the by-hand `is_admin` flip on a real account after F04.
- **No seeded favorites or message threads.** Both are private under RLS, so seeded ones
  would belong to demo users nobody can sign in as: rows would exist while the screens
  stayed empty. Only publicly-readable data and data that affects availability was seeded.
- **The catalogue is shaped as F06's test fixture**, not just as filler: all 10 property
  types, all 18 amenities, 8 cities × ≥3 listings, prices $45–$620, `max_guests` 2–16,
  one listing with no kitchen, two with no cleaning fee. A filter that can never exclude
  anything cannot be tested.
- Seed photos are curated `images.unsplash.com/photo-…` URLs with `public_id = null`
  (pruned from progress-tracker Key Decisions); the deprecated `source.unsplash.com/random`
  is not used. One guest has no avatar, so the null-avatar fallback is exercised from F05.

**Gotchas:**
- **HTTP 200 does not mean the photo shows a building.** All 105 candidate Unsplash URLs
  were HEAD-checked; 99 returned 200. Rendering those 99 into a contact sheet and actually
  looking at it caught **a DSLR camera, a massage table and a business handshake** — three
  200-OK URLs that would have shipped as listing covers and only surfaced in F05. A control
  URL with a deliberately invalid id returned 404, proving the check discriminated. Status
  codes verify reachability; only eyes verify subject.
- **The seed runs as service-role, which bypasses RLS entirely.** Every rule the app leans
  on is unenforced during seeding: nothing stops a review with no matching booking, a host
  booking their own listing, or a review whose `listing_id` disagrees with its booking's.
  Postgres accepts fixture data no real user could ever produce, and F12/F15 would then be
  built against a lie. This is why the verification script exists and why its integrity
  checks — not its row counts — are the point.
- **Playwright does not load `.env.local`.** `next dev` does, so the gap is invisible until
  a spec needs credentials. Fixed with stdlib `process.loadEnvFile()` (Node ≥20.12) rather
  than adding a `dotenv` dependency; `@types/node@20.17` already declares it, so `tsc` is clean.
- **The Playwright MCP could not launch** (it wants a Chrome install at
  `/Applications/Google Chrome.app`), but the project's own `@playwright/test` chromium was
  already there. Driving it from a scratchpad script needed `createRequire` pointed at the
  project's `package.json` — a bare `import` from outside the repo cannot resolve
  `node_modules`.
- A `values` list takes its column types from the **first row**, so nullable columns
  (`state`, `neighborhood`, `house_rules`, `description`) need an explicit `::text` cast on
  row 1 or the insert fails on the first non-null value.

**Verified:**
- **Photo pool** — 105 candidates HEAD-checked, 99×200 / 6×404 (one of which was the
  deliberate control); survivors visually reviewed, 3 rejected on subject.
- **`seed-verification.sql` — 46/46 PASS** via the Supabase MCP. Counts; one cover and 5
  positions per listing; all 10 types and all 18 amenities present; price/guest spread; **no
  self-booking, no booking over `max_guests`, none under `min_nights`, none on a draft**;
  `nights`/`service_fee`/`total` recomputed and matched per row; **every review traced back
  to a confirmed, checked-out booking by that same guest on that same listing**; no
  overlapping confirmed bookings; no block overlapping a booking; **a confirmed booking
  overlapping a cancelled one** (proving the partial exclusion constraint frees dates in
  live data); and the anon view — 24 listings, 120 photos, 7 reviews, 0 bookings.
- **Idempotent** — the whole file re-run end to end produced identical counts (5 / 26 / 130
  / 17 / 7 / 5).
- **Live REST, anon key** — 24 published listings; both draft ids return `[]`; bookings
  return `[]`; the nested `listing_photos(...)+reviews(...)` select F05 will use returns a
  correct card payload.
- **Toolchain** — `npx tsc --noEmit` clean, `npm run lint` clean, `npm run test` 7/7,
  `npm run test:e2e` 1 passed with the gate logging "seed verified: 24 published listings".
  The gate was then proved to *gate*: forcing the threshold to 999 failed the run with the
  actionable message before any browser started, then reverted.
- **Coexistence with `schema-verification.sql`** — audited rather than re-executed. Every
  one of its assertions is scoped to its own `a000` / `10000000…` sentinels except two
  globals: `admin_list_users() >= 4` (now returns 9) and a stranger seeing 0 favorites (the
  seed adds none). Its cleanup deletes only `a000` users, so seed rows cannot be caught in
  the cascade. **The full 37-assertion re-run was not performed** — worth doing once from
  the Studio SQL editor for belt and braces.

**Deferred / follow-ups:**
- The Next 16 `middleware` → `proxy` deprecation warning is still outstanding from F01;
  F04 is where auth actually exercises the middleware, so handle it there.
  → **Closed by F04** (2026-07-25): renamed to `src/proxy.ts`.
- `supabase/seed.sql` ends with a commented, non-executing "adopt" snippet: after F04
  sign-in, reassigning `listings.host_id` to a real profile id fills `/host/listings` and
  `/host/reservations` without waiting for F09.

---

## Phase 1 · Feature 04 — Google authentication  *(2026-07-25)*

**Scope built:** `safeNextPath` (+7 unit tests); `lib/queries/profiles.ts`
(`getCurrentProfile`); `lib/actions/auth.ts` (`signInWithGoogle`, `signOut`);
`app/auth/callback/route.ts`; `AccountMenu` (client dropdown) and `SignInBanner`;
`TopNav` converted to an async Server Component; six protected placeholder pages with
the `/admin` `is_admin` gate; `src/middleware.ts` → `src/proxy.ts`; hardened env guard;
`lh3.googleusercontent.com` whitelisted; Playwright auth fixture (`e2e/auth.setup.ts`,
`e2e/constants.ts`) + `e2e/auth.spec.ts` (9 specs). `@supabase/ssr` upgraded 0.6.1 → 0.12.3.

**Decisions:**
- **Sign-in is a server action, not a browser-client call.** A `<form action={signInWithGoogle}>`
  posts to the action, which calls `signInWithOAuth({ skipBrowserRedirect: true })` and
  `redirect()`s to the returned URL. The PKCE verifier cookie is written by the same client
  that reads it back in the callback, and no browser Supabase client is needed at all in F04.
  `architecture.md`'s Data Flow diagram has been corrected to match.
- **Redirecting actions are the documented exception to `ActionResult`.** `redirect()` throws
  `NEXT_REDIRECT`, so these two return `void` and report failure as `/?signin=error`. Recorded
  in `code-standards.md` so it does not read as drift later.
- **All six protected routes got placeholders, and `/admin`'s gate was pulled forward from
  F17.** Nothing in the account menu can lead to a 404, and the signed-in E2E has real pages
  to land on. F17 inherits the route guard rather than writing it; its scope shrinks accordingly.
- **The admin check lives in the page, not the proxy** — a proxy-level `is_admin` lookup would
  put a database round trip in front of every request in the app.
- **The nav reads the `profiles` row, not `user_metadata`** — `is_admin` exists only on the row,
  and a custom avatar will eventually supersede the Google one.
- **F01's silent env-skip became a thrown error.** When `updateSession` is the only thing
  between a signed-out visitor and every protected route, degrading to a no-op on a typo'd env
  var is a security failure, not a convenience.
- **The E2E fixture signs in through email/password, not Google.** Consent screens cannot be
  driven by Playwright, and Supabase issues identical cookies either way, so the proxy refresh,
  `getUser()` and RLS all behave the same downstream. The default Playwright project stays
  signed out; signed-in specs opt in via `test.use({ storageState })`.
- **The fixture never hand-rolls the auth cookie.** `sb-<ref>-auth-token` has a base64 prefix
  and chunking rules that change between versions, so an in-memory cookie jar is handed to
  `createServerClient` and `setSession()` is called — whatever the library writes is what
  Playwright stores.
- **`signOut({ scope: 'local' })`, not the Supabase default.** The default (`'global'`) revokes
  every refresh token the user holds, so signing out on a laptop would sign them out on their
  phone — surprising for a marketplace. It is also a precondition for test isolation: with
  global scope, giving a spec its own session would not help, because every session dies anyway.
- **Session minting lives in `e2e/session.ts`, and sign-out specs mint their own.** Logout
  deletes the session row server-side, so a spec that signs out while sharing the suite's
  `storageState` logs out every worker beside it.
- **The fixture signs in first and only provisions on failure.** After the first run the user
  exists, so the admin API — and the service-role key — stays off the common path entirely.

**Gotchas:**
- **`@supabase/ssr@0.6.1` silently degraded every typed query to `never`.** The package was
  pinned ~10 months behind the hoisted `supabase-js`/`postgrest-js` 2.110.8, so the `Database`
  generic stopped threading through `createServerClient`. `select('*')` on `profiles` inferred
  `never[]`, and the *only* symptom was a single opaque `TS2698: Spread types may only be
  created from object types`. Bisecting mattered: plain `supabase-js` typed the same table
  correctly, `createServerClient` did not, and the `Database` type itself was fine — which
  isolated it to the SSR package. Upgraded to `0.12.3`; `SetAllCookies` is still exported so
  F01's overload annotation still holds (it gained an optional second `headers` param).
  **No typed query existed before F04, which is why F02/F03 passed clean.**
- **Two of my own diagnoses were wrong and the probes caught it.** I first "fixed" the spread
  error by adding `|| !data`, reasoning that destructuring loses the discriminant — it does
  not; `if (error)` narrows fine once the types resolve. And `never`-detection probes of the
  form `[T] extends [never]` silently pass for `Row | null`, so they proved nothing until the
  probe was changed to `const x: null = data`, which makes TS print the real type.
- **`SUPABASE_SERVICE_ROLE_KEY` contained a *publishable* key.** F02 left it blank with a note
  to copy it from the dashboard; the value that landed was `sb_publishable_…`. It looks
  plausible, is accepted by PostgREST, and quietly **obeys RLS** — a `select` for unpublished
  listings returned `[]` rather than the two drafts — while the auth admin API rejects it with
  the unhelpful "This endpoint requires a valid Bearer token". `e2e/session.ts` now checks the
  prefix and fails with the fix spelled out. **Replaced with a real `sb_secret_` key**; confirmed
  by querying draft listings, which returns 2 rows with the secret key and 0 with the publishable
  one — the sharpest test of whether a key actually bypasses RLS.
- **Supabase rejects `.test` and `example.com` sign-up addresses**, so a public-signup fallback
  that would have avoided the service key entirely is not available — its email validator
  blocklists non-deliverable domains.
- **Writing a regex of literal control characters corrupts the source file.** Typing the
  control-character class as raw bytes embeds a real NUL in the `.ts` file; the tell was
  `grep` reporting no match on a line that plainly existed, because grep had classified the
  file as binary. It must be written as escape *text* (`[\u0000-\u001f\u007f]`) — the characters
  `\`, `u`, `0`... — not the bytes they denote. (Committed the same mistake a second time
  while writing this very bullet into the journal.)
- **A shared `storageState` cannot survive a sign-out spec.** Four signed-in specs reused one
  session, so the sign-out spec deleted that session row mid-run and the others failed with
  `session_not_found` — while the sign-out spec itself failed the opposite way. Two failures,
  one cause. Fixed by giving sign-out its own minted session; `scope: 'local'` alone was not
  enough, because a global logout kills sibling sessions regardless of isolation.
- **`await expect(page).toHaveURL('/')` is a no-op wait when the page is already at `/`.** It
  passed instantly and let `goto('/trips')` race the in-flight sign-out POST, which looked
  exactly like "sign-out does not clear cookies". Instrumenting the flow proved the app was
  correct all along — cookies AFTER were `(none)`. The assertion now polls `context.cookies()`
  for the session cookie disappearing: both a real wait and the thing worth asserting.
- **Supabase’s auth admin API intermittently rejected a valid `sb_secret_` key** right after
  the key rotation (`unrecognized JWT kid <nil> for algorithm ES256`), while the same key
  succeeded via curl and in a standalone Node script seconds earlier. Treated as propagation
  lag rather than chased: the fixture now signs in first and only calls `createUser` when the
  account is genuinely missing, so the flaky path is not touched on normal runs.
- **Playwright reuses whatever is already on :3000** (`reuseExistingServer`), so an orphaned
  `next-server` from an earlier run can serve stale code and make a fix look ineffective.
  Worth killing the port before concluding a change did not work.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **14/14** (7 prior + 7 new
  `safeNextPath`, including the `//evil.com` open-redirect rejection).
- `npm run build` — succeeds, and the route table prints **`ƒ Proxy (Middleware)`** with no
  deprecation warning, confirming the Next 16 rename took effect. All 10 routes present.
- `npm run test:e2e` — **11/11 passed, three consecutive clean runs** from a deleted
  `e2e/.auth`. Signed out: the bounce from `/trips` carries `?signin=required&next=%2Ftrips`;
  **all five** protected prefixes are guarded; the account menu offers Google sign-in and
  advertises nothing behind the wall; `?signin=error` renders the error banner; and
  `next=//evil.com` collapses to `/` in the form's hidden input. Signed in: every protected
  route renders instead of redirecting; the menu shows the user's email, the signed-in
  destinations, and **no Admin entry** for a non-admin; `/admin` redirects a non-admin home;
  sign-out clears the session cookie and re-locks `/trips`. The signed-out set passes *because*
  `proxy.ts` is running — they are the rename's proof.
- Type resolution re-verified after the upgrade: the profiles query now infers
  `{ id: string; full_name: string | null; avatar_url: string | null; is_admin: boolean } | null`
  — real columns, not `any`.

**Live Google round trip — verified end to end:**
- `/auth/v1/settings` now reports `"google": true`; the developer signed in with a real Google
  account and landed back in the app.
- `auth.users` holds the account with `raw_app_meta_data ->> 'provider' = 'google'`, and
  **`handle_new_user()` fired**: the `profiles` row carries `full_name` and `avatar_url`,
  proving the `full_name`/`name` and `avatar_url`/`picture` coalesce written in F02 matches what
  Google actually sends. `is_admin` is `false`, as designed — no self-promotion path exists.
- The avatar URL is on `lh3.googleusercontent.com`, the host added to
  `next.config.ts` `remotePatterns` in this feature. Had it been missed, the account menu's
  `next/image` would have thrown on the first signed-in render.
- This closes the one gap the E2E suite structurally cannot cover: the suite proves the session
  *shape* (identical cookies, same proxy → `getUser()` → RLS path), not the Google hop itself.

**First admin created.** `update profiles set is_admin = true` run by hand against the
developer's Google profile — F02's deliberate choice: no bootstrap code, no attack surface. The
project now has exactly one admin, so `/admin` and the menu's Admin entry open for that account.

**Not verified — honestly outstanding:**
- **The admin-side render of `/admin`** is not covered automatically. The E2E asserts the
  non-admin redirect (the security-relevant half); asserting the admin half needs a *second*
  test user, since flipping the shared fixture user's `is_admin` mid-run would race the
  "no Admin entry for a non-admin" spec. That belongs to F17, when there is a dashboard worth
  asserting on.
  → **Closed by the Phase 3 close-out** (2026-07-26): the second fixture account
    proves the route gate opens and closes with `is_admin`. F17 still owns asserting
    on a dashboard once there is one.
- **`access_denied` handling** (cancelling at the Google consent screen should return home with
  no error banner) has not been exercised — it needs a deliberate cancel.
- **Responsive verification of the account menu** at the four DESIGN.md breakpoints has not been
  done — the dropdown drives both the tablet+ control and the mobile hamburger, so it is the one
  new piece of UI whose collapse behaviour still needs eyes on it.
  → **Closed by the Phase 1 close-out** (2026-07-25): `e2e/nav-responsive.spec.ts`.
    It immediately found a real defect — every row was 40px against the 44px floor.

**Deferred / follow-ups:**
- After the first real Google sign-in, flip `is_admin` by hand on that profile (F02's step) to
  make `/admin` reachable; the non-admin redirect is already covered by a spec.
  → **Done** (2026-07-25): the project has exactly one admin, the developer's Google
    account. Fixture accounts are granted `is_admin` only temporarily, never left so.
- `supabase/seed.sql`'s commented "adopt" snippet can now be used to point seeded listings at
  the real profile, filling `/host/listings` before F09.

---

## Phase 1 · Close-out — verification catch-up  *(2026-07-25)*

Not a numbered feature and not a bug fix: Phase 1 was already green on all four
gates when this started. This pass closed the **verifications F04 left open**
before F05 begins, and in doing so turned up one real defect and one config drift.

**Scope built:** `e2e/nav-responsive.spec.ts` (8 specs); a 4px padding fix in
`AccountMenu.tsx`. No new dependency, no migration, no schema change.

**Decisions:**
- **Automated the breakpoint check instead of eyeballing it.** F04 left "verify the
  account menu at the four breakpoints" as a manual to-do. A one-time look would have
  found the defect below and then stopped protecting against it, so the check is a spec
  that asserts tap-target height, viewport containment and horizontal overflow at
  375 / 834 / 1280 / 1512 in both auth states. F18's responsive QA inherits it rather
  than starting from scratch.
- **`py-3`, not `min-h-11`, for the tap-target fix.** 12px + 20px line-height + 12px
  lands exactly on the 44px floor *and* matches DESIGN.md's `amenity-row` 12px row
  padding, so the fix comes from the token scale rather than bolting on a min-height.
- **This is logged as a close-out, not as "F04.5 error fix".** Naming it after an error
  would plant a false lead in the one document consulted when investigating a future
  regression. Nothing was broken; verifications were simply outstanding.
- **Pruned three Key Decisions** out of `progress-tracker.md` (F01 scaffold choices, F03
  seed-derivation, the `@supabase/ssr` `never` bug) per CLAUDE.md's ~10-bullet cap. All
  three are archived in full in their own entries above — nothing was lost.

**Gotchas:**
- **Every account-menu row shipped at 40px against the project's own 44px floor.**
  `px-4 py-2.5 text-sm` computes to 10 + 20 + 10 = 40px, and `code-standards.md` says
  "never ship a tap target below 44px". All six signed-in destinations, Sign out, and
  Sign in with Google were affected at *every* breakpoint — so this was never a mobile
  bug, which is probably why reading the JSX did not catch it. Only measuring the
  rendered box did. The spec failed 8/8 before the fix and passes 9/9 after, so it
  demonstrably gates.
- **The security advisor baseline had drifted from 2 WARNs to 3, and nobody noticed.**
  F02 recorded two intentional, load-bearing warnings (`authenticated` must hold EXECUTE
  on `is_admin()` and `admin_list_users()`). A third — leaked-password protection
  disabled — appeared when F04 enabled the email/password provider for the Playwright
  fixture. A documented baseline is only useful if a new entry is treated as a finding,
  so the count itself belongs in the docs.
- **Leaked-password protection cannot be enabled on this project: it is Pro-plan-only**
  and NextBnb is on the free plan. There is also no MCP tool for auth config, so it is a
  dashboard action regardless of plan.
- **The live auth config contradicts a documented invariant.**
  `/auth/v1/settings` reports `"email": true` with `"disable_signup": false`, so public
  email/password registration is open, while `architecture.md` states "Sign in with
  Google only. No email/password, no other providers." Severity is low and worth stating
  precisely: `mailer_autoconfirm` is `false` so registration needs a deliverable address
  and a clicked confirmation, and the resulting account is an ordinary guest — the 37
  assertions re-run in this pass confirm `is_admin` is unreachable via column grant,
  price snapshots are unwritable, and every table is RLS-scoped. It is an unintended
  account-creation path, not a privilege path. **Globally disabling signups is not the
  fix** — that would also block first-time Google users, i.e. all real onboarding. The
  proper fix is a separate Supabase project for E2E so production can disable the email
  provider outright; deferred to F18. `architecture.md` has been annotated so the doc
  stops asserting something the config does not do.

**Verified (agent, Node v26.5.0):**
- Baseline before any change: `npx tsc --noEmit` clean, `npm run lint` clean,
  `npm run test` 14/14, `npm run test:e2e` 11/11, working tree clean at `79e8979`.
  Phase 1 was green — there was no error to fix.
- **`schema-verification.sql` — 37/37 PASS**, re-run via the Supabase MCP against the
  *seeded* database. This was F03's honest gap: it audited sentinel coexistence by
  reading the script but never re-executed it. Both known globals still hold
  (`admin_list_users() >= 4` now returns more; a stranger still sees 0 favorites because
  RLS scopes the table, not because the seed adds none).
- **Seed intact after the re-run** — 26 listings (24 published), 130 photos, 17 bookings,
  7 reviews, 5 blocked ranges, **0 sentinel leftovers**, 1 admin. The script's cleanup
  cascades only its own `a000` users, as designed. `profiles` = 7 reconciles as 5 seed +
  the developer's Google account + the persistent Playwright fixture user.
- `npm run test:e2e` — **19/19** (11 prior + 8 new), `npx tsc --noEmit` clean,
  `npm run lint` clean after the fix.

**Not verified — still honestly outstanding:**
- **The admin-side render of `/admin`** — unchanged from F04, still belongs to F17 (needs
  a second test user; flipping the shared fixture user's `is_admin` mid-run would race
  the "no Admin entry for a non-admin" spec).
  → **Closed by the Phase 3 close-out** (2026-07-26) via the second fixture account.
- **`access_denied` handling** (cancelling at the Google consent screen) — needs a human
  to click Cancel on a real consent screen; cannot be automated.
- **Whether `disable_signup: true` blocks first-time Google users** — asserted from
  GoTrue behaviour, deliberately *not* tested, because testing it means flipping the
  project's auth config and risking real onboarding.
- Mobile search-overlay collapse is still unbuilt, not unverified — the nav's search pill
  is a placeholder until F06, so `<744px` currently has no search affordance by design.
  → **Closed by F06** (2026-07-25): the SearchBar ships a full-screen overlay below
    `tablet:` and replaced the nav placeholder on every route.

**Deferred / follow-ups:**
- If leaked-password protection is wanted, it needs the Pro plan
  (Authentication → Sign In / Providers → Email). Free-plan hardening that *is* available:
  raise the minimum password length and required character classes on the same screen.
- A **separate Supabase project for E2E** so production can disable the email provider
  entirely — the real answer to the open-signup finding. Decide during F18/deploy.

---

## Phase 2 · Feature 05 — Home & listing grid  *(2026-07-25)*

**Scope built (9 files):** `averageRating` + `coverPhotoOf` pure helpers in
`lib/utils.ts` (+9 unit tests); `lib/queries/listings.ts` (`getPublishedListings`,
server-only); `components/listings/{ListingCard,ListingGrid,ListingGridSkeleton}.tsx`;
`app/page.tsx` rewritten around a `<Suspense>` boundary; `app/error.tsx`;
`app/listings/[id]/page.tsx` placeholder; `e2e/home.spec.ts` extended 1 → 6 specs;
`e2e/home-responsive.spec.ts` (8 specs). No migration, no schema change, no new
dependency, `database.types.ts` untouched. **The first feature that renders real rows.**

**Decisions:**
- **Aggregation in pure helpers, not SQL.** Average rating and cover-photo selection
  are computed in `lib/utils.ts` from a nested `listing_photos(...)+reviews(rating)`
  select, so F05 ships zero SQL and the logic is unit-testable without a database. At
  24 listings × 7 reviews the payload is trivial. Revisit if F06's date-availability
  filter forces an RPC anyway.
- **`averageRating([])` returns `null`, never `0`.** `0` is unreachable from real data
  (the DB checks rating 1–5), so `null` is an unambiguous "New" signal rather than a
  value the card has to second-guess. Rounding is left to the display edge.
- **`coverPhotoOf` falls back to the lowest `position`.** The DB guarantees *at most*
  one cover (a partial unique index); it is F09's create action that will guarantee at
  least one. A listing whose cover row was deleted still has to render.
- **`next/image`, and `next-cloudinary` stays uninstalled.** Every photo is a seed
  Unsplash URL with `public_id = null` — not a Cloudinary asset — so the `CldImage`
  invariant does not apply yet. Recorded as F09's debt in the tracker.
- **`<Suspense>` around the grid, not a route-level `loading.tsx`.** A `loading.tsx`
  would blank the whole page including the sign-in banner, which is precisely what a
  user redirected by the proxy needs to see first. Only the grid suspends.
- **`getPublishedListings()` takes no arguments.** F06 adds the filters parameter when
  there are real filters to pass; an empty-filters seam now would be an untestable
  dead branch.
- **`/listings/[id]` shipped as a placeholder**, following F04's precedent of pulling
  routes forward so nothing clickable 404s. Without it the home page would be 24 dead
  ends for a whole feature. F07 replaces the file wholesale.
- **Semantic `<ul>`/`<li>` with `aria-label="Stays"`, not test ids.** The grid *is* a
  list, so the correct markup also gives the E2E a stable, scoped selector
  (`getByRole('list', { name: 'Stays' })`) without inventing a test-only attribute.
- **Pruned the F02-follow-up bullet** from `progress-tracker.md` Key Decisions to stay
  under CLAUDE.md's ~10 cap. It is preserved verbatim in the F02 follow-up entry below.

**Gotchas:**
- **`getByText('0.0')` substring-matches prices, and the assertion failed loudly for
  the wrong reason.** The spec asserting "no listing renders a 0.0 rating" found
  **7 matches** — none of them ratings. `formatPrice` renders `$180.00`, which
  *contains* the substring `0.0`. Playwright's `getByText` is substring-by-default, so
  the test was silently measuring the price column. Fixed with `{ exact: true }`. The
  near miss is the lesson: had the count happened to be 0, this would have shipped as
  a passing test that asserted nothing about ratings at all.
- **The same spec could have passed while the rating path was entirely broken.**
  Asserting only "a New badge is visible" is satisfied by *every* card rendering New —
  the exact symptom of `averageRating` mis-returning `null`. It now also asserts a real
  average matching `/^[1-5]\.\d$/` is on screen, so both branches are pinned.
- **Next flags the cover image as an unprioritized LCP element.** The dev server warned
  on every home render; fixed by threading a `priority` prop to the first four cards
  (the widest layout is 4-up, so those are the ones that can be above the fold). Worth
  noting it only appears in the dev-server log, not in any gate — no test would have
  caught it.
- **`getPublishedListings` selects `created_at` purely to order by it.** It is not in
  the returned view model and looks removable; dropping it from the select breaks the
  sort silently. Left with the ordering call adjacent so the pairing is visible.
- **The skeleton imports its layout from `ListingGrid`, not the reverse.** Both need
  identical grid geometry or the fallback shifts on swap; the constant lives in the
  primary component so a reader meets it there first, and the skeleton is visibly a
  copy of the grid rather than the source of it.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean — notable because F04's `@supabase/ssr` upgrade is what made
  typed queries resolve at all; this is the first *nested* select, and
  `listing_photos`/`reviews` thread through as real types, not `never`.
- `npm run lint` clean; `npm run test` **23/23** (14 prior + 9 new).
- `npm run test:e2e` **32/32** (19 prior + 13 new), from a deleted `e2e/.auth`.
- `npm run build` green; `/listings/[id]` present in the route table and
  `ƒ Proxy (Middleware)` still prints.
- **Rendered HTML checked against the database, not just against itself.** The served
  page has exactly **24 `<li>` cards, 24 unique `/listings/<uuid>` links, 20 "New"
  badges and 4 averages (2× 4.5, 2× 4.0)**. A direct
  `select avg(rating) ... group by listing` returns exactly four rated published
  listings at 4.50, 4.50, 4.00, 4.00 — a one-to-one match, so the aggregation is
  correct and not merely plausible.
- **Both drafts are absent** from the served HTML (grep for their exact titles). This
  is the RLS proof: `Belém Riverside Home` and `Barton Creek Cottage` say "Draft" only
  in their *descriptions*, which cards do not render — the first version of that spec
  asserted on the word "Draft" and would have passed vacuously.
- The Suspense fallback is present in the streamed response (`animate-pulse` in the
  initial HTML), confirming the shell flushes before the grid resolves.

**Not verified — honestly outstanding:**
- **The empty state has never rendered.** It is reachable only when the query returns
  `[]`, which needs either an empty database or an induced Supabase error; neither was
  simulated. The code path is trivial, but it is untested.
- **`error.tsx` has never been triggered.** Queries swallow their own failures and
  return safe empties, so nothing in F05 can throw into it by design.
- **The skeleton was not observed under throttling** — its presence is proven from the
  streamed HTML rather than watched in a browser.
- **Rating precision beyond one decimal is a display choice nobody has reviewed.**
  `4.6667` renders as `4.7`; Airbnb shows two decimals. Cosmetic, revisit in F18.

**Deferred / follow-ups:**
- **F09 must add the `public_id ? CldImage : Image` branch** to `ListingCard` when real
  uploads land, and install `next-cloudinary` then.
  → **Done in F09** (2026-07-25): the branch lives in `components/ui/ListingImage.tsx`,
    used by both `ListingCard` and `PhotoGallery`.
- F06 extends `getPublishedListings()` with the filters parameter and the date-based
  availability exclusion; the `MAX_LISTINGS = 48` ceiling becomes real pagination
  pressure only if the catalogue grows past it.
  → **Done in F06** (2026-07-25), via the `unavailable_listing_ids()` RPC rather than
    an application-code date check — see F06's finding.
- F08 adds the saved heart to `ListingCard` (deliberately omitted — a card that cannot
  save anything should not show the control).
  → **Done in F08** (2026-07-25).

---

## Phase 2 · Feature 06 — Search & filters  *(2026-07-25)*

**Scope built (13 files):** migration `0007_availability_search_rpc`
(`unavailable_listing_ids`); `lib/validations/listings.ts` (first Zod schema in the
project); `lib/searchParams.ts`; four new pure helpers in `lib/utils.ts`
(`toISODate`, `todayISO`, `formatDateRange`, `humanizeToken`);
`components/ui/DateRangePicker.tsx`; `components/search/{SearchBar,FilterPanel}.tsx`;
`getPublishedListings(filters)`; `ListingGrid` + `app/page.tsx` rewired; `TopNav`
placeholder replaced; `e2e/fixtures.ts`, `e2e/search.spec.ts` (25),
`e2e/search-responsive.spec.ts` (16); +30 unit tests. **Zod 4.4.3** installed
(deferred from F01). First migration since F02.

**Decisions:**
- **Availability is a `security definer` RPC, because it cannot be anything else.**
  The `bookings` SELECT policy is guest/host/admin, so an anon visitor reads zero
  booking rows. A nested `listings(..., bookings(...))` select does not fail — it
  returns `[]` and reports the entire catalogue as available. `unavailable_listing_ids(
  p_check_in, p_check_out)` returns published listing ids only, unioning confirmed
  bookings with blocked dates, hardened exactly like `admin_list_users()`
  (`search_path = ''`, revoke from PUBLIC, grant to anon+authenticated).
- **A narrow RPC, not a `search_listings()` mega-function.** Returning ids keeps the
  other five filters in the typed PostgREST builder; a full-search RPC would move
  every filter and the photos/reviews aggregation into hand-written SQL and make each
  future filter change a migration.
- **The function refuses null bounds.** `daterange(null, null)` is `(-inf, inf)`, which
  overlaps everything — a null would flip the filter from "no dates chosen" to "nothing
  is available". Guarded in SQL rather than trusted from the caller.
- **The RPC joins to published listings**, so calling it directly through PostgREST
  cannot confirm that a given draft listing id exists.
- **`stay` is a single derived value, not two date fields.** `parseListingFilters` emits
  `stay` only when both dates are valid, ordered and forward-looking; the query reads
  nothing else for dates. The availability filter is therefore structurally incapable of
  being half-applied — the alternative is one forgotten `&&` away from an unbounded range.
- **`min_nights` is part of the date filter.** A stay shorter than a listing's minimum is
  excluded, so search never shows something F12 would then refuse to book.
- **URL contract: camelCase, price in whole dollars.** Cents govern storage and
  arithmetic; the URL is a display surface, like `formatPrice`. The conversion exists in
  exactly one place.
- **Every schema field is independently `.catch()`-ed.** A URL is hand-editable and
  bookmarkable, so `?city=Kyoto&guests=abc` filters by city rather than failing. A bad
  URL degrades; it never throws.
- **Amenities are accepted comma-separated *and* as repeated params.** A native checkbox
  group posts `amenities=wifi&amenities=kitchen`, which is what lets `FilterPanel` be a
  Server Component with no JavaScript at all.
- **`FilterPanel` shows no result count.** The count costs an awaited query, and the panel
  renders in the shell that F05 deliberately keeps un-awaited; the count moved inside the
  Suspense boundary with the grid.
- **`<Suspense key={JSON.stringify(filters)}>`** — without the key, a new search leaves the
  previous results on screen while the next set loads, which reads as a broken filter.
- **The calendar shipped in F06, not F12**, at the developer's call, with an
  `unavailableRanges` prop F06 leaves empty and F12 fills per listing.
- **The SearchBar remounts on every URL change** (`key={searchParams.toString()}`), which
  re-seeds all three fields from the URL — including on browser back — instead of syncing
  state by hand.

**Gotchas:**
- **A green availability filter can be entirely wrong and still look right.** This is the
  feature's whole lesson: RLS does not error when it hides rows, it just returns fewer of
  them. Had the date filter been written the obvious way, every gate would have passed,
  the page would have rendered 24 listings for any date range, and the bug would have
  surfaced in F12 as "booking rejects dates search said were free". **Before computing
  anything from a table, check what its least-privileged reader can see.**
- **My own boundary test failed for the wrong reason, and the wrong reason was correct
  behaviour.** Asserting that Lakefront Villa is bookable on its own checkout day returned
  0 — I had used a 3-night window, and that listing has `min_nights = 4`. Two independent
  rules remove listings from a dated search, and a count alone cannot tell them apart.
  Re-run with 4 nights it passed. The E2E now derives the window length from the listing's
  own `min_nights` rather than a hard-coded guess.
- **The E2E oracle must not be the RPC.** Asserting the app against
  `unavailable_listing_ids()` would only prove the app calls it. `e2e/fixtures.ts` reads
  the raw `bookings`/`blocked_dates` tables with the service key and re-implements the
  overlap maths independently, so a mistake in either implementation shows up as a
  disagreement rather than as mutual agreement.
- **`exact: true` broke a spec the same way its absence broke one in F05.** With filters
  active the panel's `<summary>` reads "Filters 2 Show Hide", so `getByText('Filters',
  { exact: true })` stopped matching the moment the active-filter badge appeared — while
  the identical locator passed in the test above it, which had no active filters. F05's
  lesson was "add `exact`"; the general lesson is that text locators are coupled to
  content that changes with state. Matched by element (`locator('summary')`) instead.
- **Suspense makes card counts racy.** `page.reload()` then `count()` returned 0 while the
  grid was still streaming. Fixed with a `waitForGrid` that races the list against *both*
  empty states — waiting only for the list would hang for the full timeout on a
  legitimately empty result, which is exactly when a spec should be fastest.
- **`z.coerce.number()` turns `''` into 0.** `?minPrice=` would have become a real $0
  filter — active, invisible, and enough to make `hasActiveFilters` claim the grid was
  narrowed. Empty params are normalised to `undefined` before parsing.
- **Zod 4 renamed the ISO-date API.** Context7 returns v3 docs by default
  (`z.string().date()`); the installed 4.4.3 wants `z.iso.date()`. Probed the package
  directly rather than trusting the snippet — it rejects `2026-02-31`, which a plain
  format regex would accept. `library-docs.md` now carries the v3/v4 delta.
- **`.not('id','in','()')` is a SQL syntax error**, so an empty exclusion list has to skip
  the call rather than pass an empty tuple.
- **PostgREST treats `*` as a LIKE wildcard as well as `%`.** Left alone, `?city=%` would
  match everything and read as an ignored filter; wildcards are stripped so a destination
  matches literally.
- **The MCP stamps its own migration version, and I named the migration without the
  ordinal.** Applied as `availability_search_rpc`, which would have produced a local file
  out of step with the `0001_`…`0006_` convention the F02 follow-up established. Fixed by
  updating the recorded `name` in `supabase_migrations.schema_migrations` so local and
  remote agree exactly: `20260725060945_0007_availability_search_rpc`.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **53/53** (23 prior + 30
  new); `npm run test:e2e` **73/73** (32 prior + 41 new) from a deleted `e2e/.auth`;
  `npm run build` green with all 11 routes and `ƒ Proxy (Middleware)` still printing.
- **Counts checked against the database, not against themselves.** A SQL query predicting
  the app's output — `min_nights <= nights and id not in (unavailable_listing_ids(...))` —
  returned 18 for a 2-night window and 21 for a 5-night window at +12/+17; the served HTML
  returned exactly 18 and 21. Kyoto 3, `pool` 3, `pool,hot_tub` 2, repeated params 2,
  treehouse 1, `guests=16` 1, garbage URL 24.
- **Half-open semantics proven on a real row, five ways.** For the listing booked
  Aug 5→10 with a block on Aug 18–23: a stay over the booking is excluded; one starting
  Aug 10 (its checkout day) is included; one ending Aug 5 (its check-in day) is included;
  one hitting Aug 16→20 is excluded; and one starting Aug 24 — the day after the inclusive
  block ends — is included, which is what proves the `end_date + 1` conversion.
- **Anon REST, live:** `GET /rest/v1/bookings` → `[]`, while
  `POST /rpc/unavailable_listing_ids` → 3 ids and the same RPC with null bounds → `[]`.
  The bypass is the function, not the table, and the null guard holds through PostgREST.
- `get_advisors(security)` — **5 WARNs**, up from 3. Both new ones are the new definer
  function being anon- and authenticated-executable, which is the design.

**Not verified — honestly outstanding:**
- **The RPC-failure path returns an empty grid, and has never been exercised.** On error
  the query returns `[]` rather than unfiltered results — deliberately, since showing
  unverified availability is worse than showing none — but nothing has induced that error.
- **No test covers a JavaScript-disabled browser**, even though `FilterPanel` was built to
  work without it. The claim rests on it being a plain GET form, not on an assertion.
- **The calendar has had no keyboard-navigation pass.** Cells are real buttons and are
  tabbable, but arrow-key roving focus (the `role="grid"` pattern) is not implemented;
  F18's accessibility pass owns it.
- **Only `unavailableRanges = []` has ever run.** The straddle-rejection branch is written
  and typed but unexercised until F12 supplies real ranges.
  → **Closed by F12** (2026-07-26): `listing_occupied_ranges()` supplies real ranges
    and the straddle branch is exercised.
- The seed's dates are frozen at seed time, not recomputed daily, so absolute-date probes
  drift. The specs derive their windows from the database for this reason.

**Deferred / follow-ups:**
- F07 and F12 must read availability through `unavailable_listing_ids()`, never from
  `bookings`; F12 additionally fills the calendar's `unavailableRanges`.
  → **Done.** F07 read no availability at all (deliberately — the RPC cannot answer
    per-listing); F12 added `listing_occupied_ranges()` in migration `0008`.
- `MAX_LISTINGS = 48` is still a ceiling, not pagination. Filters make it less pressing,
  not resolved.

---

## Phase 2 · Feature 07 — Listing detail  *(2026-07-25)*

**Scope built (17 files):** four pure helpers in `lib/utils.ts` (`orderedPhotos`,
`formatCapacity`, `formatTimeOfDay`, `formatMonthYear`, +17 unit tests);
`listingIdSchema` in `lib/validations/listings.ts`; `getListingById` +
`ListingDetailData`/`ListingPhoto`/`ListingHost`/`ListingReview` in
`lib/queries/listings.ts`; `components/ui/Avatar.tsx`; five feature components
(`PhotoGallery`, `AmenityList`, `HostCard`, `ReviewsSection`, `ReservationCard`) plus
`DraftNotice`; `app/listings/[id]/page.tsx` rewritten wholesale and
`not-found.tsx` added; `--container-listing` token; `e2e/fixtures.ts` extended
(`loadListingDetail`, `loadDraftListings`, extracted `serviceClient`);
`e2e/listing-detail.spec.ts` (18) and `e2e/listing-detail-responsive.spec.ts` (20).
**No migration, no new dependency, `database.types.ts` untouched.**

**Decisions:**
- **No `loading.tsx` — a real 404 beat a skeleton.** This was not a style call. A route
  `loading.tsx` wraps the page in an implicit `<Suspense>`; the response then streams and
  the status is committed **before** `notFound()` runs. Next documents it plainly:
  *"a 404 HTTP status code for non-streamed responses and a 200 status code for streamed
  responses"*. With `loading.tsx` present every draft and every dead link returned **200**;
  without it, **404**. Measured both ways on a production build before choosing.
- **RLS decides the 404; the query does not.** `getListingById` deliberately omits
  `.eq('is_published', true)` — the `listings` SELECT policy already returns a draft to
  its host and to admins and nothing to anyone else. Adding the filter would have
  re-implemented in application code something the database enforces better, and would
  have broken the host-preview branch F10 needs.
- **The booking widget reads no availability, because it cannot.**
  `unavailable_listing_ids(p_check_in, p_check_out)` has no listing parameter and
  `returns setof uuid` — it answers "which listings are busy in this range", never "which
  dates are busy for this listing". `blocked_dates` *is* anon-readable, so half an answer
  was available and would have been worse than none: the calendar would have shown booked
  nights as free. F12 owns the per-listing definer function.
- **One DOM for the gallery, switched by CSS.** A `flex` snap-scroll strip below `tablet:`
  becomes a `grid` mosaic above it. Two trees read more simply but would put all five
  photos in the document twice, and a `display:none` image is still fetched.
- **No position dots on the mobile strip.** Tracking scroll offset needs JavaScript, and
  dots that never move are worse than none; the next photo peeking past the edge is the
  affordance. (The approved sketch showed dots — this is a deliberate departure.)
- **The 64px `rating-display-card` renders only when reviews exist.** 20 of 24 published
  listings are unrated, so a 64px "New" would be shouting about missing information.
- **Amenity labels are written out, not derived.** `humanizeToken` renders `bbq_grill` as
  "Bbq grill" and `ev_charger` as "Ev charger" — the acronyms are exactly what a
  mechanical transform gets wrong. `AMENITY_META` is keyed on `Amenity`, so adding a
  constant without an entry is a type error rather than a blank row.
- **The icon map lives in `AmenityList.tsx`, not `constants.ts`** — that module is pure
  data imported by `validations/listings.ts`, and icons would pull `lucide-react` into
  every consumer.
- **The id is validated before the query.** `id` is a `uuid` column, so `/listings/abc`
  raises Postgres `22P02` — a logged database error for what is only a bad link.
  `PGRST116` ("no rows") is likewise *not* logged: it is the ordinary 404.
- Added `--container-listing: 1080px`. **DESIGN.md contradicts itself here** — Grid &
  Container says listing detail caps "closer to 1080px", its Responsive table says 1440px
  for "listing/search" pages. The more specific line won.

**Gotchas:**
- **`z.uuid()` exists in Zod 4 and was verified, not assumed.** Probed the installed
  4.4.3 directly (F06's lesson about Context7 serving v3 docs): it accepts our seed ids,
  rejects `not-a-uuid` and `''`, and is lenient about the version nibble — which is
  correct, since Postgres accepts any well-formed uuid.
- **A `circle-user-round` count was off by one, and the extra one was the nav.** The
  null-avatar spec counted fallback icons page-wide and got 2 for 1 missing avatar: the
  signed-out account menu renders the same icon. Same family as F05's `getByText('0.0')`
  matching prices — a locator coupled to something outside the thing under test. Now
  scoped to the reviews region, and paired with a count of real `<img>` avatars so it
  cannot pass by *everything* falling back.
- **Walking all 24 listings in one browser test overran the 30s timeout** under parallel
  load, while passing in isolation at 16s. Rewritten to drive Playwright's `request`
  fixture: the server still renders the HTML, only the browser is skipped, and each
  listing's `<h1>` is compared to its own title. It also now reports **every** mismatch
  at once instead of dying on the first.
- **`priority` does not emit `fetchpriority="high"` here.** It emits a
  `<link rel="preload" as="image">` carrying the cover's srcset and our exact
  `imageSizes`. Asserting on `fetchpriority` would have "proved" the cover was
  unprioritised when it was not.
- **`.single()` narrows `error` but not `data`.** The `if (failure)` guard leaves
  `data` as possibly-null to TypeScript; the fixture needed an explicit check, which is
  better anyway — a missing fixture row now fails loudly instead of as a puzzling
  assertion further down.
- A grid item stretches to its cell, which leaves `position: sticky` nowhere to travel.
  The reservation rail needs `self-start` or it simply never sticks.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **70/70** (53 prior +
  17 new); `npm run test:e2e` **117/117** from a deleted `e2e/.auth` and a free :3000
  (73 prior + 38 F07 + 7 added to `nav-responsive` by the fixes below, minus the
  reworked ones); `npm run build` green, all 11 routes, `ƒ Proxy (Middleware)` still
  printing.
- **The nav is clean at 22 widths from 320 to 1920** on both `/` and `/listings/[id]`:
  zero logo overlap, zero nav-row overflow, zero page overflow.
- **Inferred types proved real, not `never`.** A throwaway `const x: null = …` probe made
  tsc print the actual types for the nested select — `ListingHost | null`,
  `ListingReview[]`, `ListingPhoto[]`, and `amenities` narrowed to the 18-value `Amenity`
  union. F04's `@supabase/ssr` incident is why this is checked rather than assumed.
- **Rendered HTML checked against the database.** Listing 1: title, `Alfama, Lisbon,
  Portugal` (state null, no stray comma), 4.5 / (2 reviews), `4 guests · 1 bedroom ·
  2 beds · 1 bath`, $145.00, cleaning $35.00, min 2 nights, After 3:00 PM / Before
  11:00 AM, host Maya Okonkwo, member since July 2026, 7 amenities — every one matching
  a direct SQL read. Listing 4: `1.5 baths` and singular `(1 review)`. Listing 8
  (`cleaning_fee = 0`, `house_rules` null): fee row absent, rules absent, "No reviews
  yet", **no rating number**. Listing 16: the 4-part location. Listing 20: 3 amenities,
  no kitchen. Gallery images per listing = **5**, scoped by the gallery's own `sizes`
  attribute — an unscoped count returned 6–8 because host and reviewer avatars are
  Unsplash URLs too.
- **The cover is the `is_cover` row**, confirmed against `listing_photos`: the preloaded
  and first-rendered photo is `photo-1502005229762-cf1b2da7c5d6`, the row with
  `is_cover = true, position = 0`.
- **The 404 branch proven at the HTTP layer on a production build**: drafts 25 and 26,
  an unmatched uuid, and a malformed id all return **404**, and the draft's title appears
  nowhere in the body.
- **The owner-sees-draft branch proven by SQL impersonation** (the technique
  `schema-verification.sql` uses): for draft 25, `anon` → 0 rows, an authenticated
  **non-owner** → 0 rows, the **owner (Maya)** → 1 row `Belém Riverside Home`, an
  **admin** → 1 row. That is exactly the four-way branch the page relies on.
- **The new specs demonstrably gate.** Restoring `loading.tsx` — the precise regression
  that silently turns 404s into 200s — fails **4** of the 404 specs. They were run
  against the broken state and then the fix.
- **Responsive measured, not eyeballed**, at 375 / 834 / 1280 / 1512: zero horizontal
  overflow at every width; exactly one of the rail and the bottom bar visible at each
  (never both, never neither); the visible Reserve control ≥44px; the gallery never wider
  than the viewport; the end of the page reachable past the fixed bar.

**Two pre-existing F06 nav defects, found here and fixed on request:**

Both predate F07 (the identical breakage was on `/`, which this feature does not touch)
and both were invisible to a suite that already had the right assertions — because
`nav-responsive.spec.ts` sampled only the *middle* of each band.

1. **The mobile search pill overlapped the logo on every phone width** — measured
   **59px at 320, 32px at 375, 12px at 414**, clean from ~500px. Cause: the pill is
   `flex-1`, which *looks* like it shrinks, but a flex item defaults to
   `min-width: auto` and therefore floors at its content width (~199px in a 111px
   slot). It overflowed its wrapper and, because the wrapper is `justify-center`,
   spilled **symmetrically** — 44px each side, which is exactly the measured overlap.
   Fix: `min-w-0` on the pill, plus the wordmark hidden below `tablet:` (it costs
   ~86px and a phone row cannot seat wordmark + usable pill + account menu). The
   `<Link>` keeps its `aria-label="NextBnb home"`, so both existing specs that locate
   it by accessible name still pass.
2. **The nav row overflowed the viewport by 89px across 744–833** — iPad mini and iPad
   portrait, the entire lower half of the tablet band. Cause: "Become a host" turns on
   at `tablet:` beside the full 3-segment pill, and the row is over budget until
   ~834px. Fix: moved to `desktop:`. It is the only one of the four elements that is
   redundant — the account menu's "Manage listings" reaches the same route.
   Confirmed pre-existing by stashing the F07 changes and re-measuring: 89 / 73 / 33 / 0
   at 744 / 760 / 800 / 834.

- **`nav-responsive.spec.ts` now samples each band's lower boundary** (320, 375, 744,
  834, 1128, 1280, 1512) and adds `expectNothingCoversTheLogo` and `expectNavRowFits`.
  Its own header comment used to say *"widths are representative points INSIDE each
  band, not the boundaries"* — that is precisely how it missed both defects, since a
  band's tightest point is its first pixel. 8 specs → 15.
- **`px-3.5`/`gap-1.5` on the pill instead of `px-4`/`gap-2`.** After the fix the labels
  were still clipped at 375px — by **one pixel** ("Anywhere" got 67px and needed 68).
  Reclaiming 8px of chrome renders "Anywhere · Any week" in full at 375 and 414; 320 and
  360 still ellipsize, which is what `truncate` is for.

**Gotcha that nearly invalidated the fix — a gate-proof that proved nothing.** The first
attempt to show the new assertions gate reverted both components and got **15/15
passing**. The cause was `reuseExistingServer`: a production `npm start` from the
verification pass was still holding :3000, so Playwright tested the *fixed build* while
the source was reverted. This is F04's journal warning arriving from the other direction
— there it made a real fix look ineffective, here it made a broken state look fixed.
Re-run with :3000 free, the specs fail **6** ways with exactly the right messages
("something in the nav overlaps the logo" at 320/375, "the nav row overflows its
container" and "page scrolls horizontally" at 744, and "Become a host" visible when it
should be hidden). **Kill the port before trusting any before/after E2E comparison.**

**Not verified — honestly outstanding:**
- **The `DraftNotice` has never been rendered by a browser.** RLS returns the draft to its
  owner (proven above), but the two seed drafts belong to fake users who cannot sign in,
  and the Playwright fixture user owns nothing — so no E2E can reach the branch. Same
  structural gap, and the same reason, as `/admin`'s admin-side render deferred to F17.
  F09/F10 will create a listing owned by a real account and close it for free.
  → **Closed by F09** (2026-07-25): a draft owned by the Playwright fixture account
    renders it at HTTP 200 while anon still gets a 404.
- **`next-cloudinary` is still uninstalled and `publicId` is carried but unused.** Every
  photo remains an Unsplash seed row with `public_id = null`; F09 still owns the
  `publicId ? CldImage : Image` branch.
  → **Closed by F09** (2026-07-25): `next-cloudinary` installed and the
    `publicId ? CldImage : Image` branch shipped in `ListingImage`.
- **No keyboard/screen-reader pass.** The page adds regions, an `<hr>` rhythm and a
  scroll-snap strip; the strip is not keyboard-scrollable without focusing it. F18 owns it.
- **The gallery's fewer-than-5 and more-than-5 photo branches are unexercised** — every
  seeded listing has exactly 5. The mosaic caps at 5 and a single photo spans full width;
  both are written and typed but only F09 will supply a real counterexample.
- **`error.tsx` still cannot be reached from this route** — the query swallows its own
  failures and returns `null`, which becomes a 404.

**Deferred / follow-ups:**
- F12 must add the per-listing availability definer function and fill
  `DateRangePicker`'s `unavailableRanges` — still the only honest way to show a calendar.
  → **Done in F12** (2026-07-26): migration `0008_listing_occupancy_rpc`.
- No `generateMetadata`, so the browser tab shows the site title rather than the
  listing's. It would cost a second query per render without a shared cache; revisit
  in F18.

---

## Phase 1 · F02 follow-up — migration version identity & Supabase branching  *(2026-07-25)*

Triggered by a real failure, not a review: the Supabase GitHub integration reported
**"Remote migration versions not found in local migrations directory"**.

**Root cause — two independent problems, one visible:**
1. **Version identity mismatch.** F02 applied migrations through the Supabase MCP's
   `apply_migration`, which stamps the version **server-side as a 14-digit timestamp**
   while keeping the human-readable name. The repo files were authored separately with
   ordinal prefixes (`0001_`…`0006_`). The CLI derives a migration's version from the
   filename prefix and reconciles on **version**, not name — so it saw six remote versions
   with zero local counterparts. F02's "remote history and the repo stay in lockstep" was
   true of content and false of identity; **nothing read migration versions until branching
   did**, which is why six migrations, 37 schema assertions, 46 seed assertions and four
   green gates all passed over it.
2. **`supabase/config.toml` did not exist.** The repo had `supabase/migrations/`, `seed.sql`
   and `tests/` but was never `supabase init`-ed, so the integration had no project config
   even before it got to the migrations. Fixing only #1 would have hit this next.

**Decisions:**
- **Renamed the files to the remote versions rather than repairing remote history.** The SQL
  content is unchanged and already applied, so renaming makes local match remote with no
  re-apply, no `migration repair`, and no risk to a database holding real seed data. The
  timestamps ascend in the same order as the ordinals (191157 < 191240 < 191457 < 191517 <
  191633 < 192345), so replay order is preserved.
- **Kept the ordinal inside the name** (`20260724191633_0005_definer_hardening.sql`). The
  name then equals the remote's recorded `name` exactly, and the `0005_`/`0006_` references
  already in this journal still resolve. Uglier filename, zero doc churn.
- **Used `git mv`** so the renames register as renames rather than delete+add.
- **Branching is being switched off until F18.** Nothing in `build-plan.md` asks for Supabase
  branching (deploy is F18, to Render); branches bill hourly at **$0.01344/hr ≈ $9.70/mo
  each**; and it adds a CI gate that must stay green on every PR *while migrations are still
  applied via MCP* — the exact workflow that caused the mismatch. Re-enabling it means moving
  to CLI-first migrations (`supabase migration new` → `db push`).

**Gotchas:**
- **MCP `apply_migration` and the CLI disagree about what a migration's identity is.** This is
  the trap for anyone mixing the two: the MCP is convenient and correct at the database level,
  but it does not write the local file, and the version it records will never match a
  hand-named one. Pick one writer per project, or accept a reconciliation step.
- **A green test suite proves nothing about migration *history*.** Every gate we own reads the
  live schema, and the schema was always correct. The broken thing was the mapping between
  files and history rows, which no test looks at.
- **`config.toml` will matter more than it looks if branching ever returns.** Its `[auth]` block
  becomes the source of truth for preview branches — which is the clean way to fix the
  open-email-signup finding from the close-out entry above (`[auth.email] enabled = false` for
  production) rather than toggling it by hand in the dashboard.
- `supabase init` is **non-interactive by default** in CLI 2.109.1 (`-i` opts in), and it left
  `seed.sql` untouched. It also wrote a nested `supabase/.gitignore`; that one ignores
  `supabase/.env.local`, **not** the root `.env.local` — the root `.gitignore:26` (`.env*.local`)
  is what protects the service-role key, verified still ignored and untracked.

**Verified:**
- Local filenames now match remote `supabase_migrations.schema_migrations` one-to-one:
  `20260724191157` / `191240` / `191457` / `191517` / `191633` / `192345`, confirmed against
  the Supabase MCP `list_migrations` output.
- `config.toml` sanity-checked against the live project: `major_version = 17` matches remote
  PG 17.6.1, and `[db.seed] sql_paths = ["./seed.sql"]` points at the real seed.
- Database untouched and healthy throughout — `ACTIVE_HEALTHY`, and the 37/37 schema
  re-run in the close-out entry above happened against this same database.
- Post-change gates: `npx tsc --noEmit` clean, `npm run lint` clean, `npm run test` 14/14,
  `npm run test:e2e` 19/19. (Expected — no application file changed; recorded so the next
  session knows the rename was not load-bearing for the app.)

**Not verified — outstanding:**
- **That the integration actually goes green.** Confirming it needs either `supabase link`
  (database password + a personal access token, neither of which the agent holds) or a push to
  GitHub so the integration re-runs. Since branching is being disabled, this is moot for now —
  but it means **the rename is a documented-correct fix, not an observed-working one**.
- The Supabase branch `main` was left at status `MIGRATIONS_FAILED` (since 2026-07-24 19:23).
  It is inert — the production database is unaffected — and disabling the integration retires it.
  → **Superseded** (2026-07-26): it now reports `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`.
    **What changed it was not observed**, so this is still not evidence that the
    migration rename works — that remains documented-correct and unverified.

**Deferred / follow-ups:**
- Disabling the GitHub integration is a **dashboard action** (Project Settings → Integrations);
  there is no MCP tool for it, so the developer does it.
- If branching is re-enabled in F18: move migrations to CLI-first, and use `config.toml`'s
  `[auth]` block to disable the email provider on production instead of the dashboard toggle.

---

## Phase 2 · Feature 08 — Favorites  *(2026-07-25)*

**Scope built (16 files):** `lib/validations/favorites.ts` (`setFavoriteSchema`);
`lib/actions/favorites.ts` (`setFavorite` — the project's first non-auth action);
`lib/queries/favorites.ts` (`getFavorites`); `toFavoriteCards` + `toListingCard`
pure helpers (+5 unit tests); `isSignedIn()` in `queries/profiles.ts`;
`components/listings/SaveButton.tsx`; `ListingCard` restructured; `PhotoGallery`
given an `action` slot; `/favorites` replacing its placeholder;
`e2e/favorites.spec.ts` (13) and `e2e/favorites-responsive.spec.ts` (35).
**No migration, no new dependency, `database.types.ts` untouched** — `favorites`
was fully specified in `0001`/`0003`/`0006` and needed nothing.

**Decisions:**
- **The action takes the state you want, not an instruction to flip.**
  `setFavorite({ listingId, saved })` upserts or deletes to match. A
  `toggleFavorite(listingId)` has to read the current row and invert it, so two
  clicks in flight both resolve against the same "before" and can land opposite
  to what the heart is showing. Idempotent writes converge instead.
  **This renames `build-plan.md`'s `toggleFavorite`** — recorded here rather
  than silently drifting.
- **Saved state rides the existing selects** (`favorites(user_id)` nested into
  `getPublishedListings` and `getListingById`) rather than a second query. RLS
  scopes the nested rows to the viewer, so anon reads `[]`.
  **This is deliberately *not* F06's trap, and the distinction is the useful
  part:** there, fewer rows meant "everything is available" — a permissive
  conclusion drawn from absence, arriving as a success. Here, fewer rows means
  "you have not saved this", which is exactly right for someone with no account.
  Reading less is only dangerous when absence infers a *permission*.
- **`useState` seeded from the prop, not `useOptimistic`.** Optimistic state
  reverts to the server-rendered prop once the transition settles, and
  `setFavorite` revalidates only `/favorites` — so on `/` the prop never changes
  and a *successful* save would visibly snap back to unsaved. The failure would
  have looked exactly like a broken server action.
- **`revalidatePath('/favorites')` only.** `/` and `/listings/[id]` are dynamic
  (cookies + `searchParams`) and re-render on every visit, so revalidating them
  would re-run the whole filtered search query on each tap of a heart for no
  freshness gain.
- **The card is no longer one big `<Link>`.** The link is scoped to the title and
  stretched with `after:absolute after:inset-0`; the heart is a sibling on
  `z-10`. Not a style preference — see the gate proof below, the nested version
  navigates.
- **`PhotoGallery` takes an `action` slot** instead of importing `SaveButton`, so
  it stays presentational and never pulls a client component into its module
  graph. The slot renders as a **sibling of** the scroll container, never a
  child: the mobile strip is `overflow-x-auto` and anything inside it swipes off
  screen with the first photo.
- **The mobile heart offset is a percentage, not a fixed inset.** The strip
  bleeds 24px past the content column while its first tile is `w-[88%]` of that
  bleed, so the tile's right edge lands at exactly 88% of the wrapper's width at
  every phone width. `right-[calc(12%+0.5rem)]` follows it; a fixed inset sits on
  photo 1 at 375px and on photo *2* by 743px.
- **The heart is 44px, overriding DESIGN.md's 32px `icon-button-circle`.** The
  spec itself calls 32px "borderline for AAA"; `code-standards.md` sets a hard
  44px floor, so the floor wins and the 32px circle becomes the glyph inside it.
- **`isSignedIn()` is its own tiny query**, `Promise.all`-ed alongside the real
  one so the auth round trip adds no serial latency and no `profiles` read the
  heart has no use for.
- **E2E specs claim a listing by index and clean up only their own rows.** See
  the gotcha below — this was not optional.
- **Pruned the Render/redirect-URL bullet** from `progress-tracker.md` Key
  Decisions to stay under CLAUDE.md's ~10 cap. Nothing is lost: `architecture.md`
  carries a whole "Redirect URL responsibilities" section, which is more precise
  than the bullet was, and F18 is where it is next needed.

**Gotchas:**
- **PostgREST types a to-one embed as non-null, and RLS disagrees at runtime.**
  `favorites.listing_id` is a NOT NULL foreign key, so the generated types say
  `listings` is always there — proved by the `const x: null = data` probe, which
  printed `listings: { id: string; ... }` with no `| null`. But an unpublished
  listing comes back as a null embed to anyone who is not its host. The filter in
  `toFavoriteCards` is load-bearing and **the type system would never have asked
  for it**. Same family as F04's `never` incident: the types were confidently
  wrong in the direction that hides a bug.
- **F08 broke a passing F04 spec by adding forms.** `auth.spec.ts`'s open-redirect
  test located `input[name="next"]` page-wide; the signed-out heart is a sign-in
  form, so that locator went from 1 match to ~25. Scoped to the banner's own
  form, which is what it always meant. Third time this project has hit "a locator
  coupled to something outside the thing under test" (F05's `getByText('0.0')`
  matching prices, F07's `circle-user-round` counting the nav).
- **My "does not navigate" spec asserted nothing, and the gate proof is the only
  reason I know.** `await expect(page).toHaveURL(/\/$/)` matches *instantly*
  when the page is already at `/`, resolving before any navigation could occur —
  so it passed against markup with the button nested inside the anchor. F04's
  journal records the same trap from the other direction ("a no-op wait ... let
  `goto('/trips')` race the in-flight sign-out POST"). Rewritten to wait on a
  real signal — the row appearing in the table — and only then read
  `page.url()`. It then failed with
  `Received: "/listings/20000000-…-000000000001"`, which also settles that the
  restructure was necessary rather than tidy.
- **My own signed-out spec raced the parallel signed-in ones.** It snapshotted
  `readFavorites(userId)` before and after and compared — but a sibling worker
  was legitimately writing rows for the same shared account, so it measured
  *their* work and failed. I had written "no spec asserts on a row count" into
  the fixture header and then violated it one file later. Now scoped to a
  claimed listing.
- **A responsive spec can encode one breakpoint's layout as if it were the
  design.** "The heart sits over the first photo" is true below `tablet:` and
  false above it — the mosaic puts a *small* tile in the top-right corner, which
  is where the heart correctly goes. Split into "inside the photo block" (every
  width) and "inside the first photo" (mobile only, skipped above 744).
- **The heart's `next` had to strip `signin` and `next`.** Hearting from
  `/?signin=required` would otherwise return the user to a page still telling
  them to sign in. Not a security issue — `safeNextPath` handles the nesting —
  but a small loop worth not shipping.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **75/75**
  (70 prior + 5 new); `npm run test:e2e` **169 passed, 3 skipped** (117 prior +
  52 new; the 3 skips are the mobile-only gallery assertion above `tablet:`)
  from a free :3000; `npm run build` green, all 11 routes,
  `ƒ Proxy (Middleware)` still printing.
- **Rendered HTML checked against the database.** Anon `/` serves **24 `<li>`
  cards, 24 "Sign in to save" controls and 0 `aria-pressed` toggles** — one heart
  per published listing, and no togglable control reachable while signed out. The
  listing page serves exactly **1**. `/favorites` signed out returns **307** to
  `/?signin=required&next=%2Ffavorites`.
- **Both new specs demonstrably gate.** Swapping the percentage offset for a
  fixed `right-4` fails the mobile containment assertion at **all four** phone
  widths (320/375/414/743) and passes at tablet+, which is exactly the defect
  shape. Nesting the heart back inside the card's `<Link>` fails the navigation
  spec with the listing URL in the message.
- **Live REST, anon key:** `GET /listings?select=id,title,favorites(user_id)`
  returns `favorites: []` per row with no error, and `GET /favorites` returns
  `[]`. The nested select degrades to "not saved" rather than failing.
- `get_advisors(security)` — **still 5 WARNs**, the documented baseline,
  unchanged. F08 added no function and no policy.
- **The suite cleans up after itself**: `select count(*) from favorites` is **0**
  after a full run, and the seed is intact (26 listings / 24 published / 17
  bookings / 7 reviews).

**Not verified — honestly outstanding:**
- **The `setFavorite` failure path has never run.** The revert-and-announce
  branch in `SaveButton` needs the action to return `{ ok: false }`, which needs
  an induced Supabase error; nothing simulates one. Same shape as F05's
  never-triggered `error.tsx`.
- **`toFavoriteCards`' null-listing drop is unit-tested but has never met a real
  null.** It needs a listing that was favorited and *then* unpublished — F10's
  publish/unpublish action is the first thing that can produce one.
  → **Closed by the Phase 3 close-out** (2026-07-26): host = primary fixture user,
    viewer = second user, so the unpublished listing is genuinely invisible to the
    viewer and the embed really is null.
- **The `/favorites` empty state is rendered but unasserted.** A spec that
  asserts it would have to know no parallel worker has a row in flight for the
  shared user, which is exactly what the isolation rule forbids. A second test
  user would close it — the same answer `/admin`'s admin-side render has been
  waiting on since F04.
  → **Closed by the Phase 3 close-out** (2026-07-26), using the second fixture account
    in a `mode: 'serial'` spec that can safely own whole-user state.
- **No keyboard or screen-reader pass on the heart.** `aria-pressed` and the
  `aria-live` region are written and typed, but the announcement has not been
  heard, and the gallery overlay's focus order has not been walked. F18 owns it.
- **`DraftNotice` still has never been rendered by a browser** — unchanged from
  F07, and still waiting on F09/F10 creating a listing owned by a real account.
  → **Closed by F09** (2026-07-25).

**Deferred / follow-ups:**
- **F09 must add the `publicId ? CldImage : Image` branch** to both `ListingCard`
  and `PhotoGallery` — still outstanding from F05, and now two components.
  → **Done in F09** (2026-07-25), in the shared `ListingImage` leaf.
- F10's unpublish is what first exercises the null-embed drop in `getFavorites`;
  worth an assertion there rather than a new fixture here.
  → **Did not happen.** F10 explains why it structurally could not: the fixture user
    is always the host of anything it unpublishes, and RLS hands a draft back to its
    owner. Closed instead by the Phase 3 close-out's second account (2026-07-26).

**Pruned from `progress-tracker.md` Key Decisions (F08), preserved verbatim:**
> - Deployment target is **Render** (Web Service). Redirect URLs live in three
>   places: Google console → Supabase `/auth/v1/callback`; Supabase → Render
>   `/auth/callback`; `NEXT_PUBLIC_SITE_URL` = Render URL.

---

## Phase 3 · Feature 09 — Create listing  *(2026-07-25)*

**Scope built (18 files):** `createListingSchema` + `addListingPhotoSchema` /
`photoActionSchema` / `movePhotoSchema` / `publishListingSchema` and
`listingPhotoFolder` / `dollarsToCents` in `lib/validations/listings.ts`;
`nextPhotoPosition` + `reorderedPositions` in `lib/utils.ts`;
`lib/actions/listings.ts` (`createListing`, `addListingPhoto`,
`deleteListingPhoto`, `movePhoto`, `setCoverPhoto`, `publishListing`);
`getOwnListing` in `lib/queries/listings.ts`; five `components/ui` primitives
(`Button`, `Field`, `TextInput`, `Textarea`, `Select`) + `fieldStyles.ts` +
`ListingImage`; `components/host/{ListingForm,PhotoManager}.tsx`;
`/host/listings/new` and `/host/listings/[id]/photos`; `AMENITY_META` exported;
`ListingCard`/`PhotoGallery` moved onto `ListingImage`; `e2e/global-teardown.ts`;
`e2e/host-listings.spec.ts` (16) and `e2e/host-listings-responsive.spec.ts` (21);
+35 unit tests. **No migration** — `0001`/`0003`/`0006` already permitted all of
it. `react-hook-form`, `@hookform/resolvers`, `next-cloudinary` installed.

**Decisions:**
- **Two steps, both owned by F09**, forced by the sign route rather than chosen:
  `/api/sign-cloudinary` signs only for a listing the caller **already owns**, so
  the row must exist before any upload. `/host/listings/new` creates a draft and
  redirects to `/host/listings/[id]/photos`. F10's `/edit` is untouched.
- **One schema for draft and publish.** Every DB-NOT NULL column is required
  either way, so a "lenient draft" was never actually possible. Publish
  additionally requires ≥1 photo — that is what finally makes "exactly one cover"
  true, which `coverPhotoOf`/`orderedPhotos` have documented as F09's job since F05.
- **`addListingPhoto` never sets `is_cover`.** The widget fires it once per file
  concurrently, so every call would read "no photos yet" before any had inserted
  and they would collide on `listing_photos_one_cover_idx`. Leaving it unset is
  race-free and free: `coverPhotoOf` already falls back to the lowest `position`,
  and `publishListing` promotes an explicit cover before the listing is public.
- **"Make cover" also moves the photo to the front.** `orderedPhotos` sorts
  cover-first, so a cover left mid-strip would show the host one order and
  visitors another. Position and cover move together or not at all.
- **Reorder renumbers the whole set, and writes only the rows that changed.**
  Positions drift (a delete leaves a gap; nothing forbids duplicates), so a swap
  built on `position - 1` compounds the drift while a full renumber heals it.
- **Move buttons, not drag-and-drop** — no new dependency, keyboard-accessible
  for free, works on touch, and every control clears the 44px floor.
- **The row goes before the Cloudinary asset in delete.** The other order risks
  destroying the image and then failing to delete the row, which leaves a listing
  rendering a broken photo — worse, and harder to notice, than the orphaned asset
  this order can leave.
- **`getOwnListing`, not `getListingById`.** The latter leans on the SELECT
  policy, which also hands drafts to **admins**, and its `isOwnerView` really
  means "unpublished". An editor that writes has to ask the narrower question.
- **Landing on `/listings/[id]`**, which closes F07's gap for free (below).

**Gotchas:**
- **`@hookform/resolvers@5.4.1–5.4.3` cannot be installed at all.** They declare
  25 optional validator peers, and `@typeschema/main` drags in `valibot@^0.39`
  against the package's own `valibot@^1.0` — a self-contradictory graph npm
  refuses. Neither library is used here. Rather than reach for `--force` or
  `--legacy-peer-deps` (which weaken every future install), dry-ran each version:
  5.4.0 is the newest that resolves, and it is **pinned exactly**, because a
  caret would drift straight back into the broken range.
- **Zod 4's `z.url()` accepts `javascript:alert(1)`.** It validates URL *syntax*,
  not scheme. Probed before relying on it, so the photo URL is checked by
  `https://res.cloudinary.com/` prefix instead.
- **A validation schema used on both sides must accept its own output.** The
  client validates and posts the *result* to the action, which re-validates with
  the same schema — but `optionalText` emitted `null` while accepting only
  `string | undefined`. Every listing with a blank description passed on the
  client and was refused by the server with "Please check the highlighted
  fields", naming no field. Fixed with `.nullish()`; two unit tests now assert
  `parse(parse(x)) === parse(x)`. **The client and server sharing one schema is
  the thing that makes this a trap** — the schema was correct in each direction
  separately.
- **`CldImage` calls `useState`, so it is a Client Component**, and importing it
  into `PhotoGallery` (a Server Component) 500s `/listings/[id]` with *"useState
  only works in Client Components"*. `'use client'` sits on `ListingImage`, the
  smallest leaf, so the cards, the gallery and the pages above stay server-rendered.
- **And `CldImage` *throws* when `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is unset** —
  so one missing env var turns every listing holding an uploaded photo into a
  500, not a broken image. `ListingImage` now falls back to `next/image` with the
  stored `secure_url`, which is a valid delivery URL on the already-whitelisted
  host: the cost is `f_auto`/`q_auto`, not the page.
- **`getByLabel('Guests')` matched the nav's SearchBar as well as the form.**
  Fourth instance of this project's recurring trap — a locator coupled to
  something outside the thing under test (F05's `getByText('0.0')` matching
  prices, F07's `circle-user-round` counting the nav, F08's `input[name="next"]`
  matching hearts). The form now carries `aria-label="List your place"` and every
  spec locator is scoped to it, which is also a real accessibility improvement.
- **The amenity label is "Wi-Fi", not "Wifi"** — my spec was wrong and the app
  was right. Exactly why F07 hand-wrote `AMENITY_META` instead of deriving labels,
  and why F09 exported it rather than writing a second copy.
- **Polling the database proves the write, not the repaint.** The reorder spec
  polled until `position` changed, then clicked "Make photo 2 the cover" — but
  the controls are labelled by *index* and `router.refresh()` had not necessarily
  repainted, so "photo 2" still meant the old photo. The spec now reloads between
  the two interactions.
- **A timed-out spec does not run its `finally`.** Three draft listings survived
  the first (failing) suite and pushed the catalogue from 26 rows to 29 — which
  `seed-verification.sql`'s exact counts would have failed on, and which the
  fixture-user exclusions exist precisely to prevent. `e2e/global-teardown.ts`
  now sweeps any listing left owned by the fixture user; it reported and removed
  exactly those 3 on the next run.
- **The first suite run after adding routes flakes on cold compile.** Six specs
  failed on `page.goto` timeouts in an 8.8-minute run, then all passed in 1.8
  minutes on the second. Playwright's `webServer` runs `next dev`, so the two new
  routes compile on first hit while other workers wait on `/`. CI's `retries: 2`
  covers it; worth knowing before chasing a phantom regression.

**Two pre-existing hazards fixed on the way in:**
1. **`loadPublishedListings()` was a latent flake.** It orders by `id` and F08's
   specs claim index `[n]`; ids are `gen_random_uuid()`, so any listing F09
   publishes sorts to an arbitrary point and shifts a sibling worker's claim
   mid-assertion. Both it and `loadDraftListings()` now exclude the fixture
   user's rows, making the ordering immune to anything F09/F10 create.
2. **The photo grid overflowed the viewport by 24px at 320px** — two columns
   cannot hold four 44px controls. Found by sampling each band's *lower*
   boundary, the technique F07 adopted after the middle-of-band sampling missed
   two nav defects for a whole feature. Fixed by dropping to one column below
   `tablet:` (DESIGN.md: grids drop columns) and adding `shrink-0` so the buttons
   can never trade an overflow for a sub-44px target.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **122/122**
  (87 prior + 35 new); `npm run test:e2e` **204 passed / 3 skipped** from a
  deleted `e2e/.auth` and a free :3000; `npm run build` green with all 13 routes
  and `ƒ Proxy (Middleware)` still printing.
- **Created listings checked against the database, not the page that made them.**
  A form submission produces a row with `host_id` = the fixture user,
  `is_published = false`, and title/city/state/type/guests/bedrooms/beds/
  bathrooms/min-nights/amenities/house-rules all matching what was typed — with
  `$249` and `$35` stored as **24900** and **3500** cents.
- Blank optional fields land as **null**, not `''` (state, house rules,
  neighbourhood), so the detail page omits those rows rather than rendering empty
  ones.
- Blank title, `price = 0` and `guests = 17` are each refused with the right
  message and create nothing.
- `/host/listings/[id]/photos` returns **404** for a signed-in non-owner and for
  a malformed id, and redirects a signed-out visitor with `?signin=required`.
- Publish with zero photos is refused **and says why**; with photos it sets
  `is_published = true`, leaves **exactly one** `is_cover` row at position 0, and
  the listing then appears in a live search for its city.
- **`DraftNotice` has now been rendered by a browser** — open since F07, because
  both seed drafts belong to fake users who cannot sign in. A draft owned by the
  fixture account renders it at HTTP 200 while anon still gets a 404.
- Deleting a photo removes the row; moving renumbers positions; "Make cover"
  moves the photo to the front and leaves exactly one cover.
- **Responsive measured at 320 / 375 / 744 / 1128 / 1440** — no horizontal
  overflow on either route, every form control inside the viewport, and every
  tile control ≥44px on its shorter side.
- **The three gate proofs fire.** Removing the zero-photo publish guard fails the
  publish spec; dropping `host_id` from `getOwnListing` fails the non-owner 404
  spec; removing the cloud-name fallback fails the draft-notice spec with a 500.
  Removing the `publicId` folder check fails exactly the 5 photo-security unit
  tests and nothing else.
- `get_advisors(security)` — **still 5 WARNs**, the documented baseline. F09 adds
  no function and no policy.
- **Seed intact after a full suite run**: 26 listings / 24 published / 130 photos
  / 17 bookings / 7 reviews / 0 favorites, and **0 listings owned by the fixture
  user**.

**Not verified — honestly outstanding:**
- **`MAX_PHOTOS_PER_LISTING` is enforced but unexercised** — reaching 15 photos
  needs 15 uploads or 15 fixture rows; the branch is written and typed only.
- **No keyboard or screen-reader pass** on the form or the photo controls. The
  labels, `aria-invalid`, `aria-describedby` and `role="alert"` are written but
  have not been heard. F18 owns it.
- **The `addListingPhoto` failure path has never run** — same shape as F08's
  `setFavorite` revert branch and F05's untriggered `error.tsx`.

**Deferred / follow-ups:**
- F10 inherits the `ui/` primitives and `ListingForm`; the edit page should reuse
  the form rather than fork it.
  → **Done in F10** (2026-07-26): `/edit` reuses `ListingForm` through a discriminated
    `mode` prop rather than a second copy.
- F10's unpublish is still the first thing that can produce a real null embed for
  `toFavoriteCards` (outstanding since F08).
  → **Did not happen** — same reason as F08's copy of this note. Closed by the
    Phase 3 close-out's second fixture account (2026-07-26).

### F09 follow-up — the real Cloudinary round trip  *(2026-07-26)*

Credentials were provisioned, so the one thing F09 shipped unverified is now
verified. Two real defects surfaced in the process — both invisible while the
env vars were empty, because the code paths they break were unreachable.

**Getting the credentials right:**
- The first values failed with `cloud_name mismatch`. A **control probe settled
  which of the three was wrong**: a deliberately bogus key, and a real key with a
  bogus secret, both return `api_secret mismatch`, while the real pair returned
  `cloud_name mismatch` — so the key and secret were valid and only the cloud
  name was not. It had been set to the dashboard's *display* name (`NextBnb`);
  the real cloud name is a lowercase generated string (`de4fvvdaa`). Same
  discipline as F03's deliberately-invalid Unsplash URL: an error message only
  discriminates if you have checked what a different failure looks like.

**Defect 1 — `CldUploadWidget` needs the api_key in the browser.** It throws
*"A Cloudinary API Key is required for signed requests"*, and because it throws
during render the **entire `/host/listings/[id]/photos` route 500s** — the page
showed `error.tsx`, not a broken button. `CLOUDINARY_API_KEY` was server-only, so
the widget could never see it. Added `NEXT_PUBLIC_CLOUDINARY_API_KEY` (the same
value) to `.env.local`, `.env.example` and the `code-standards.md` table.

**This does not weaken anything, and the invariant already said so.** The
Cloudinary `api_key` is a public identifier — it rides along with every
browser-side upload so Cloudinary knows whose signature to check. The
`api_secret` is what authorises, and it never leaves `/api/sign-cloudinary`.
`architecture.md`'s invariant names `CLOUDINARY_API_SECRET`, never the key, so it
holds unchanged. `code-standards.md`'s table had the key marked "Sensitive" and
is now corrected.

**Defect 2 — the same throw-don't-degrade trap, twice.** `CldImage` throws on a
missing cloud name and `CldUploadWidget` throws on a missing api_key, and in both
cases the route 500s rather than the image or the button failing alone.
`ListingImage` falls back to `next/image` with the stored `secure_url`; the
`PhotoManager` guard now checks **both** public vars and says which is missing.
Recorded in `library-docs.md`.

**Verified — the full round trip, end to end:**
- `/api/sign-cloudinary` returns **200** and a 40-char hex signature for a folder
  the caller hosts.
- **Cloudinary accepted that signature for a real upload** (HTTP 200), which is
  the whole signing contract proven in one step — the params we sign are exactly
  the params the upload sends.
- The asset exists remotely (`cloudinary.api.resource`), and its `public_id` is
  under `nextbnb/listings/<id>/`, so `addListingPhotoSchema`'s cross-tenant guard
  accepts the real response as well as the synthetic ones.
- **`CldImage` delivers it with `f_auto` and `q_auto`**:
  `…/image/upload/c_fill,w_3840,g_auto/f_auto/q_auto/v1/nextbnb/listings/…`
- **Responsive delivery is real, not nominal** — the `srcset` carries nine
  distinct widths (384 … 3840) against
  `sizes="(max-width: 744px) 88vw, (max-width: 1128px) 50vw, 540px"`.
- **Deleting through the real action destroyed the asset**: clicking "Remove
  photo 1" removed the row and `cloudinary.api.resource` then 404s.
- **The negative cases all hold** — `403` for a signed `public_id`, a signed
  `upload_preset`, another host's listing folder, a folder outside the namespace,
  and no folder at all; `401` signed out.
- The photos page now renders the real widget at **HTTP 200** with zero page
  errors and a visible "Upload photos" button.
- Gates after the change: `tsc` clean, `lint` clean, **122/122** unit,
  **204 passed / 3 skipped** E2E, `npm run build` green.
- **Nothing leaked**: 0 assets under `nextbnb/` in Cloudinary and 0
  `listing_photos` rows holding a `public_id` (every seed row is null).

**Gotcha worth carrying forward:** two proof runs timed out mid-poll and their
`finally` never ran, orphaning a Cloudinary asset each — the *same* failure mode
that leaked three listing rows during F09 and prompted `global-teardown.ts`.
Cleanup that only exists in a `finally` is cleanup that does not survive a
timeout. The suite itself never uploads, so this is confined to manual proofs,
but F10's delete path should assume an orphan is possible.

**Still not verified:**
- **The widget's own UI has not been click-through tested.** The Cloudinary
  upload widget is a third-party iframe; what is proven is the contract around it
  — our signature is accepted by Cloudinary for a real file, and the response
  shape our schema expects is the one it returns.
- `MAX_PHOTOS_PER_LISTING`, the `addListingPhoto` failure path, and the
  `destroy()` failure branch remain unexercised.

---

## Phase 3 · Feature 10 — Manage listings  *(2026-07-26)*

**Scope built (12 files):** `blocksListingDeletion` in `lib/utils.ts`;
`centsToDollars`, `toListingFormValues`, `updateListingSchema`,
`listingActionSchema`/`setPublishedSchema`/`deleteListingSchema` and the
`DEFAULT_CHECK_IN_TIME`/`DEFAULT_CHECK_OUT_TIME` constants in
`lib/validations/listings.ts`; `getOwnListings` + `getOwnListingForEdit` in
`lib/queries/listings.ts`; `updateListing`, `setListingPublished` (replacing
`publishListing`) and `deleteListing` in `lib/actions/listings.ts`, plus a shared
`destroyAsset` helper; `components/host/{HostListingCard,ListingActions,
hostControlStyles}`; `/host/listings` replacing its placeholder;
`/host/listings/[id]/edit`; `ListingForm` given a discriminated `mode` prop;
`e2e/host-manage.spec.ts` (18) and `e2e/host-manage-responsive.spec.ts` (15);
+35 unit tests. **No migration, no new dependency, `database.types.ts`
untouched** — `0001`/`0003`/`0006` already permitted host update and delete, and
no column grant restricts which listing columns a host may write.

**Decisions:**
- **Delete refuses while a confirmed stay is still coming.** `bookings.listing_id`
  is `on delete cascade`, so deleting a listing does not *cancel* its
  reservations — it erases them: no `cancelled` status, no `cancelled_at`, no
  row, and nothing left in the guest's Trips to explain where their stay went.
  The action refuses and steers to unpublish, which takes the listing out of
  search and leaves every booking intact.
- **Stated plainly in the code: that guard is UX, not authorization.**
  `listings_delete_own_or_admin` still permits the delete, deliberately — F17's
  admin moderation needs a hard delete for spam and abuse, and a database trigger
  would block admins too. Accepted consequence: a listing whose bookings are all
  *past* still deletes, and the cascade takes its reviews with it. That is
  inherent to hard delete, which `build-plan.md` reserves for exactly that case.
- **The cutoff is a day wide, on purpose.** The comparison happens in JS against
  a `date` column, and `todayISO` can sit either side of the database's
  `current_date` near midnight (its own docstring says so). One side deletes a
  stay the database still considers in progress; the other merely refuses a
  delete that could have gone ahead. `subDays(today, 1)` picks the harmless one.
- **`publishListing` was replaced, not joined.** `setListingPublished({
  listingId, published })` is idempotent — F08's `setFavorite` shape, and for the
  same reason: a toggle reads the current row and inverts it, so two clicks in
  flight resolve against the same "before" and can land opposite to the button.
  Two actions writing one column is the drift this journal keeps recording, so
  the old one is gone and `PhotoManager` is the single repointed call site.
- **Reading `bookings` here is safe, and it was checked rather than assumed.**
  The `bookings` SELECT policy admits the listing's host, and `host_id` scopes
  the query to listings this user hosts. **Not F06's trap, and the difference is
  the useful part:** there, missing rows inferred a *permission* ("everything is
  available") and arrived as a success; here a non-host reads no listings at all,
  so there is no row set left to draw a wrong conclusion from.
- **`getOwnListingForEdit` is a second query, not a widened `getOwnListing`.**
  That one feeds the photo editor and has no use for eighteen form fields; this
  one returns a form-ready shape (cents already dollars, nulls already blank)
  through a pure `toListingFormValues`, so the mapping is unit-testable without a
  database — F05's precedent.
- **`ListingForm` takes a discriminated union, not optional props.** `listingId`
  and the loaded values are meaningless in create mode and mandatory in edit
  mode; the union makes forgetting one a type error. Both modes resolve with
  `createListingSchema` — `updateListingSchema` extends it — so a rule added to
  creation is enforced on edit for free.
- **Two-step inline delete, not `window.confirm` or a new modal.** No dependency,
  keyboard-accessible for free, no `page.on('dialog')` plumbing in every spec,
  and DESIGN.md specs no dialog beyond the scrim token.
- **`HostListingCard` is new rather than a reuse of `ListingCard`.** That one
  links the whole tile to the public page, carries a `SaveButton` and renders a
  rating — none of which belong on a management surface, and the heart would drag
  a client component in for nothing. What they genuinely share is `ListingImage`.
- **Every control names its listing** (`Delete <title>`, `Publish <title>`). One
  row per listing means a bare "Delete" matches N times; naming them is both the
  only workable locator and the correct accessibility answer.
- **`hostControlStyles.ts` is directive-free on purpose.** The links live in a
  Server Component and the buttons in a Client one, so neither can import a
  shared const from the other without dragging its module into the wrong graph.
  Same arrangement as `ui/fieldStyles.ts`.
- **44px controls (`h-11`), not DESIGN.md's 48px `button-primary`.** Four
  controls share one row and 48px does not fit at 320px; the `code-standards.md`
  floor is the part that is non-negotiable.

**Gotchas:**
- **`getByRole` matches the accessible name as a SUBSTRING, and that made a spec
  assert nothing.** After clicking Unpublish, `getByRole('button', { name:
  'Publish <title>' })` matched the **Unpublish** button still on screen and
  resolved instantly against the pre-click state. The spec passed while the
  listing was still published, and the only thing that disagreed was
  `readListing()` on the next line. Fixed with `exact: true`. **This is F08's
  trap in a new costume** (`toHaveURL('/')` passing instantly on a page already
  at `/`) and the fourth time the project has been saved by making the database,
  not the page, the oracle.
- **Clicking before React hydrates is a false result twice over, and both look
  like app bugs.** A `type="button"` click lands on server HTML with no handler
  attached and simply does nothing — the delete-guard spec sat there for 30s
  waiting for a confirm step that was never going to appear. Worse, a value typed
  into a field React is about to re-assert from `defaultValues` is silently
  reverted: clearing the title and submitting **saved the original title and
  navigated away**, which reads exactly like "the editor accepts a blank title".
  Proven by instrumenting the run (URL after submit was `/host/listings`, and the
  form was gone), then confirmed by inserting a wait before the fill. Specs now
  poll React's own `__reactProps$…` hydration marker — an internal, but the
  direct signal, and infinitely better than sleeping and hoping.
- **A published fixture listing breaks `search.spec.ts` from another worker.**
  Its availability spec compares an **exact** count against an independently
  computed expectation, and `loadSeedSnapshot` reads *every* published listing —
  so a fixture listing bookable for those dates makes the page and the
  expectation disagree by one, in a spec that mentions nothing about hosting.
  `createDraftListing` now takes `minNights`, and F10's published fixtures use 30
  nights so they fall out of both sides. F09 shipped the same hazard and narrowed
  it by deleting inside the spec body; this is the actual fix.
- **`getByText('Draft')` matched the fixture titles.** They read `E2E draft
  <hex>`, and `getByText` is a case-insensitive *substring* match. `exact: true`.
  Sixth instance of a locator coupled to something outside the thing under test
  (F05's `getByText('0.0')` matching prices, F07's `circle-user-round` counting
  the nav, F08's `input[name="next"]` matching hearts, F09's `getByLabel(
  'Guests')` matching the SearchBar).
- **Re-enabling a disabled React button from the DOM does not work, and the
  attempt hangs.** The first version of the server-guard spec set
  `button.disabled = false` via `evaluate` and clicked. React owns that attribute
  and restores it on its next render, so Playwright waited out the full timeout
  on a control it could never click. Replaced with something both simpler and
  more honest: delete with no bookings, let the host reach the confirm step, then
  insert the booking *while they are deciding*. That reaches the action with a
  stale `canDelete` through the real UI, and it is also the genuine race — a
  guest reserving between the render and the click.
- **An UPDATE that matches no row returns success with no data.** `updateListing`
  therefore checks the returned row and reports "not found" rather than a save
  that never happened — the same silent-success failure mode `0006` exists to
  eliminate for revoked privileges.
- **`Partial<typeof LITERAL>` infers the literal's own types**, so a test fixture
  built as a plain object could not be overridden with `null` on its nullable
  columns. Typed from the function instead: `Parameters<typeof
  toListingFormValues>[0]`, which needs no new export.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **157/157**
  (122 prior + 35 new); `npm run test:e2e` **237 passed / 3 skipped** (204 prior
  + 33 new) from a deleted `e2e/.auth` and a free :3000; `npm run build` green
  with **14 routes**, `/host/listings/[id]/edit` present and `ƒ Proxy
  (Middleware)` still printing.
- **Edits checked against the database, not the page that made them.** A form
  save writes the new title, `$249` as **24900** cents, the description, and
  `min_nights = 3`. Opening the editor and saving *without touching anything*
  leaves `price_per_night` at exactly 12300 — the cents/dollars crossing happens
  twice there and must not move a value.
- The editor opens on the stored values with every nullable column rendered as
  `''`, and a blank title is refused client-side with nothing written.
- **Only the host's own listings appear**; a seeded listing hosted by someone
  else never does. `/host/listings/[id]/edit` returns a real **404** for a
  non-owner and for a malformed id, and both routes 307 a signed-out visitor with
  `?signin=required`.
- Publishing from the grid without a photo is refused **and says why**, with
  `is_published` unchanged in the table. Publishing drops the Draft badge;
  unpublishing takes the listing out of a city-scoped search and back.
- Deleting a bookings-free listing removes the row and its photo rows; the first
  click only asks, and cancelling deletes nothing. A **cancelled** future stay
  does not block. A **confirmed** future stay disables the control with the reason
  on screen, and the action refuses even when the page thinks it may proceed —
  with the booking still in the table afterwards.
- **All three gate proofs fire.** Removing the booking guard fails the
  action-refusal spec on the missing message; dropping `host_id` from
  `getOwnListings` fails the own-listings spec with the seeded title present
  (`Expected: 0, Received: 1`); breaking the `>= 1 photo` guard fails the grid
  publish spec. Each was run against the broken build and then reverted.
- **Responsive measured at 320 / 375 / 744 / 1128 / 1440** — each band's lower
  boundary. No horizontal overflow on either route, every control inside the
  viewport, every control ≥44px, and the **confirm step measured too**, since
  swapping Delete for Confirm + Cancel is the widest this row ever gets.
- `get_advisors(security)` — **still 5 WARNs**, the documented baseline. F10 adds
  no function and no policy.
- **Seed intact after a full suite run**: 26 listings / 24 published / 130 photos
  / 17 bookings / 7 reviews / 5 blocks / 0 favorites, and **0 listings owned by
  the fixture user**.

**Not verified — honestly outstanding:**
- **F08's `toFavoriteCards` null-embed gap did NOT close here, and F10 explains
  why it cannot yet.** F08 expected unpublish to produce a real null. It does —
  but only for a viewer who is not the host, and the Playwright fixture user is
  the only account that can sign in, so it is always the host of anything it
  unpublishes. RLS hands a draft straight back to its owner, so the embed is
  never null for the one account a spec can drive. A second test user is the only
  thing that closes it, alongside `/favorites`' empty state and `/admin`'s
  admin-side render.
  → **Closed by the Phase 3 close-out** (2026-07-26): the second fixture account is
    exactly the missing principal this entry identified.
- **The `{ ok: false }` branches of `updateListing` and `deleteListing` have
  never run** — the guard refusals are covered; a genuine Supabase error is not.
- **`deleteListing`'s Cloudinary destroy has only ever run against fabricated
  public_ids.** The suite never uploads, so every fixture photo points at an
  asset that does not exist: the destroy is called, fails, and is logged exactly
  as designed, but a *successful* multi-asset destroy has only been reasoned
  about. Those same fabricated ids make `CldImage` log "Resource not found"
  through the host grid during E2E — test-data noise, visible only because F09's
  follow-up gave the project real credentials.
- **Editing inside the hydration window loses the edit for a real user too**, not
  just for Playwright: the server-rendered default wins. Inherent to an SSR'd
  react-hook-form seeded from `defaultValues`, narrow enough to leave alone, and
  worth knowing before someone reports it as a bug.
- **No keyboard or screen-reader pass** on the two-step delete. `role="alert"` is
  written but has not been heard, and the focus behaviour when Delete is replaced
  by Confirm has not been walked. F18 owns it.

**Deferred / follow-ups:**
- F11 adds availability to the listing editor and inherits `/edit`; it should
  reuse `getOwnListing`'s ownership question rather than `getListingById`, for
  the reason F09 recorded.
  → **Did not happen as predicted.** F11 shipped `/host/listings/[id]/availability` as
    its own route, a third sibling to `/edit` and `/photos` — `/edit` is one large
    react-hook-form and a second set of mutations on it would re-render the whole
    form per block. It did reuse the ownership question, as advised.
- F11's `blocked_dates` is the next cascade to read before writing a delete.
  → **Done in F11** (2026-07-26): nothing references `blocked_dates`, so `removeBlock`
    needs no cascade guard — read before writing, per F10's rule.
- F17's admin delete is this same cascade with the guard deliberately absent —
  that is the design, and it should say so where it is written.

---

## Phase 3 · Feature 11 — Availability management  *(2026-07-26)*

**Scope built (12 files):** `InclusiveRange` + `bookedNightsRange`,
`rangesOverlap`, `findBlockConflict` and `formatInclusiveRange` in
`lib/utils.ts` (+25 unit tests); `lib/validations/blockedDates.ts`
(`addBlockSchema`, `removeBlockSchema`, +12 unit tests);
`getOwnListingAvailability` + `ListingBlock`/`OwnListingAvailabilityData` in
`lib/queries/listings.ts`; `lib/actions/blockedDates.ts` (`addBlock`,
`removeBlock`, shared `ownOccupancy`); a `bounds` prop on
`components/ui/DateRangePicker.tsx` with its value fields renamed
`checkIn`/`checkOut` → `start`/`end` (and `SearchBar` repointed);
`components/host/AvailabilityManager.tsx`;
`/host/listings/[id]/availability`; an Availability link on
`HostListingCard` and a cross-link on `/edit`; `e2e/hydration.ts` and
`e2e/calendar.ts` extracted; `createBlockedDateRow`/`readBlockedDates` fixtures;
`e2e/host-availability.spec.ts` (13) and
`e2e/host-availability-responsive.spec.ts` (15). **No migration, no new
dependency, `database.types.ts` untouched** — `0001` had the table and
`end_date >= start_date`, `0003` all four host-scoped policies, `0005` the split
anon SELECT, `0006` the anon revokes. **Closes Phase 3.**

**Decisions:**
- **Its own route, not a section on the editor.** `build-plan.md`'s UI line said
  "availability section on the listing editor"; it shipped as a third sibling to
  `/edit` and `/photos`. `/edit` is one large react-hook-form carrying the
  hydration hazard F10 documented, and hanging a second set of mutations off it
  re-renders the whole form on every block for no gain. The deviation is recorded
  in `build-plan.md` under F11 rather than left to read as drift later.
- **`DateRangePicker` widened, not forked.** A `bounds: 'half-open' |
  'inclusive'` prop, defaulting to half-open so `SearchBar` was untouched
  behaviourally. Exactly two rules differ: inclusive completes a **one-day**
  range on a second click of the same day (a stay cannot be zero nights; a block
  of one night is ordinary, and `end_date >= start_date` is the table's own
  constraint), and it counts the end day in the straddle test. A second calendar
  would have duplicated ~200 lines of month grid and given DESIGN.md's single
  `date-picker-day` spec two implementations to drift between.
- **Named for the range model, not the caller.** `bounds` rather than
  `mode: 'stay' | 'block'`, because `architecture.md` restricts
  `components/ui/` to presentational primitives with no business rules — the
  component must not learn what a "block" is. The same reasoning then forced the
  value fields from `checkIn`/`checkOut` to `start`/`end`: leaving a host's "last
  blocked night" in a field called `checkOut` would have been the inconsistency
  the prop naming existed to avoid. `SearchBar` now maps the URL contract
  (`?checkIn=`) to the picker's fields at its own boundary, which is where that
  translation belongs anyway.
- **Overlaps refused, not merged and not allowed.** Blocks never overlap a
  confirmed booking *or* each other, with a distinct message for each so the host
  knows which. Merging would silently rewrite a range the host never touched and
  would need an UPDATE — the one `blocked_dates` verb this feature never issues.
  Allowing overlaps is harmless for the availability union but reads as broken:
  removing one of two coincident rows leaves the nights blocked with no
  explanation.
- **Removal is a named list control.** Clicking a blocked day would mean splitting
  a range on partial removal — an UPDATE plus an INSERT, and a second way to
  write blocks. Each Unblock names its range, F10's every-control-names-its-target
  rule.
- **Bookings and blocks are listed separately rather than drawn differently.**
  Both grey out on the calendar, because a taken night is a taken night, but only
  one of them is the host's to undo and a greyed cell cannot say which it is. Two
  lists deliver `build-plan.md`'s "read-only for booked" without teaching a `ui/`
  primitive the difference.
- **Reading `bookings` directly is safe, and it was checked.** The `bookings`
  SELECT policy admits the listing's host and the query is `host_id`-scoped, so
  the reader is always privileged for the rows being read — F10's
  `getOwnListings` reasoning, **not F06's trap**, where missing rows inferred a
  *permission* and arrived as a success. Here a non-host reads no listing at all,
  so no row set survives to draw a wrong conclusion from. **It does not solve
  F12's problem:** a guest needs the same dates for a listing they do not host,
  and RLS gives them nothing.
- **The past-date floor is strict in the UI and lenient in the action.** The
  calendar offers today onward; `addBlock` refuses only a block whose *end* is
  already past. A `startDate >= today` rule in the shared schema would satisfy
  F09's "must accept its own output" in shape while failing in *time* —
  `todayISO()` runs once in the browser and again on the server, so a range
  submitted at 23:59:59 would be refused at 00:00:01 naming a field the host
  filled in correctly. Same instinct as F10's one-day-wide delete cutoff: when a
  comparison straddles two clocks, pick the direction whose error is harmless.
- **Finished bookings are filtered out on the server, not in the component.**
  They feed a rendered list now, so "today" has to be decided exactly once;
  computing it during both the server render and hydration is a mismatch waiting
  for a midnight page load. Blocks are deliberately *not* filtered the same way —
  a stale one still has to be removable.
- **`removeBlock` carries no guard, and that was read rather than assumed.** F10's
  rule is to check the FK actions on everything referencing a row before writing
  a delete. Nothing references `blocked_dates`; `listing_id` cascades *into* it
  from `listings`. A block's blast radius is the block.
- **`getOwnListingAvailability` is a third narrow query, not a widened
  `getOwnListing`** — F10's stated reason: that one feeds the photo editor and has
  no use for date ranges.
- **`waitForHydration` and the calendar helpers were extracted** to
  `e2e/hydration.ts` and `e2e/calendar.ts`. F11 was the second feature to need
  the hydration wait, and two copies of a subtle wait is how one of them quietly
  stops matching what React does.

**Gotchas:**
- **A negative assertion needs a positive control, and gate proof 3 is the only
  reason I know.** The non-owner 404 spec named
  `20000000-0000-4000-a000-000000000001` — the `a000` sentinel range belongs to
  `schema-verification.sql`; the seed's listings are `b000`. **No such listing
  existed**, so the route 404'd because the row was missing, and the spec **passed
  with `.eq('host_id', user.id)` deleted from the query**. It now claims a real
  listing via `loadPublishedListings()` (which excludes the fixture user) and
  additionally asserts that listing serves **200** on its public page, so the 404
  can only mean "not yours". The database probe got the same treatment: a non-host
  `blocked_dates` insert is refused, *and* the identical probe as the host
  succeeds — without that control, "refused" might only have meant `set_config`
  broke every write. **F08's lesson in a new costume, and F03's control-URL
  lesson from the other direction.**
- **`getByRole('alert')` also matches Next's route announcer.** Every page carries
  `<div role="alert" id="__next-route-announcer__">`, empty — so the two refusal
  specs died on a strict-mode violation whose message read like the app had
  rendered nothing, while the app had in fact rendered exactly the right
  sentence. **Seventh instance in this project of a locator coupled to something
  outside the thing under test** (F05's `getByText('0.0')` matching prices, F07's
  `circle-user-round` counting the nav, F08's `input[name="next"]` matching
  hearts, F09's `getByLabel('Guests')` matching the SearchBar, F10's
  `getByText('Draft')` matching fixture titles and its `getByRole` substring
  match). Fixed by scoping to the section's own `region`, which is why that
  `<section>` carries an `aria-labelledby` at all.
- **Never locate a day cell with `.first()`.** The calendar opens on the current
  month, so the first cell is the 1st — in the past for most of any month, and
  therefore `disabled`. Playwright waits for actionability, so the click does not
  fail fast with "this is disabled": it hangs for the full 30 seconds and reports
  nothing about why. Five responsive specs timed out identically before the cause
  was obvious. `e2e/calendar.ts` now addresses days by date and says so in its
  header.
- **A spec that rebuilds a formatted label is a latent flake.** The unblock spec
  reconstructed "Aug 15 – 17" by hand, which stops matching on the ~2 days a month
  where the two ends straddle a month boundary and the component correctly renders
  "Jul 31 – Aug 2". Replaced with a position-based locator — the list is sorted by
  start date — and the database remains the oracle for *which* range went.
- **The action's overlap guard is unreachable through the calendar, which is the
  point of the calendar.** Every day the page already knows about is disabled, so
  a conflict can only arrive *after* the render. That makes the race the only
  honest way to reach the server guard — insert the booking (or block) while the
  host is deciding, then click — which is exactly how F10 proved its delete guard,
  and it is also the genuine failure mode rather than a contrivance.
- **`start!` was the first draft of the inclusive selection rule**, which
  `code-standards.md` forbids outside the Supabase env-var factories. Restructured
  into two early returns so TypeScript's control-flow analysis narrows `start`
  properly — shorter *and* legal.
- **`formatDateRange` cannot render a one-day block.** It produces "Aug 18 – 18",
  which is unreachable for a stay (the two ends are always different days) and the
  ordinary case for a block. `formatInclusiveRange` is a separate helper rather
  than a widened one, so the search pill's behaviour could not shift.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **194/194**
  (157 prior + 37 new); `npm run test:e2e` **265 passed / 3 skipped** (237 prior
  + 28 new) from a deleted `e2e/.auth` and a free :3000; `npm run build` green
  with **15 routes**, `/host/listings/[id]/availability` present and
  `ƒ Proxy (Middleware)` still printing.
- **Inferred types proved real, not `never`** — a throwaway `const _probe: null =
  data` made tsc print the nested select's actual shape:
  `blocked_dates: { id, start_date, end_date }[]` and
  `bookings: { status: "confirmed" | "cancelled", check_in, check_out }[]`, with
  `status` narrowed to the enum union so the confirmed-only filter is type-safe.
  F04's `@supabase/ssr` incident is why this is checked rather than assumed.
- **Blocks checked against the table, not the page that wrote them.** A range
  picked on the calendar stores `start_date`/`end_date` exactly as picked — the
  end **not** pushed out a day to match the half-open model bookings use. A single
  day stores `start_date = end_date`. Unblocking removes that row and leaves both
  the listing's other block and all its bookings untouched.
- **Half-open semantics proven at the surface the host touches:** for a stay
  running check-in → check-out, both the check-in day and the day before checkout
  are disabled, and **the checkout day is selectable** — the same-day turnover the
  exclusion constraint permits. For an inclusive block, both ends are disabled and
  the day after the end is free; a block abutting an existing one at `end + 1` is
  accepted.
- **The guards are enforced, not merely displayed.** With a range already selected,
  inserting a confirmed booking inside it mid-decision makes the action refuse
  naming the reservation, with **no** block written and the booking still present;
  inserting a block does the same naming the existing block, leaving exactly the
  one row that was there.
- **RLS is the real guard, proven by impersonation with a control.** An
  authenticated non-host insert into `blocked_dates` is refused; the identical
  probe run as the listing's own host succeeds. Seed left at 5 blocks either way.
- `/host/listings/[id]/availability` returns a real **404** for a signed-in
  non-owner (whose listing serves 200 publicly) and for a malformed id, and
  **307**s a signed-out visitor with `?signin=required&next=%2Fhost%2Flistings…`.
- **End to end through `unavailable_listing_ids()`:** blocking a range removes a
  published listing from a dated search covering it, and unblocking through the UI
  brings it back — F11's writes reach the function F06 built without this feature
  touching migration `0007`.
- **All four gate proofs fire**, each run against the broken build and then
  reverted: removing the booking-conflict check fails the racing-refusal spec;
  replacing `subDays(check_out, 1)` with `check_out` fails the checkout-day spec
  (and 5 unit tests); dropping `host_id` from the query fails the non-owner spec
  with `Received: 200`; setting `bounds` back to `'half-open'` fails the
  one-day-block spec.
- **Responsive measured at 320 / 375 / 744 / 1128 / 1440** — each band's lower
  boundary. No horizontal *page* overflow at any width, every control inside the
  viewport and ≥44px, month navigation ≥44×44, and the day cell holding DESIGN.md's
  40px. The calendar itself scrolls **inside its own container** below `tablet:`,
  which is the design: a month panel is fixed at a width no phone can hold, and a
  scrolling calendar is correct where a scrolling page would be the defect.
- `get_advisors(security)` — **still 5 WARNs**, the documented baseline. F11 adds
  no function and no policy.
- **Seed intact after a full suite run**: 26 listings / 24 published / 130 photos
  / 17 bookings / 7 reviews / **5 blocked ranges** / 0 favorites, and **0 listings
  owned by the fixture user**. Blocks need no cleanup pass of their own — they
  cascade with the fixture listing, which `global-teardown.ts` already sweeps.

**Not verified — honestly outstanding:**
- **The race has been guarded but never landed.** The spec proves `addBlock`
  refuses a booking that arrives while the host decides; what has never been
  produced is a booking arriving in the microseconds *after* the guard's read, so
  a block genuinely overlapping a confirmed stay. Benign by design, reachable only
  by contriving the interleaving.
- **The `{ ok: false }` Supabase-error branches of both actions have never run** —
  guard refusals and not-found paths are covered; a genuine database error is not.
  Same shape as F10's `updateListing`/`deleteListing` and F08's `setFavorite`.
- **The 365-day ceiling is unit-tested only** — reaching it through the calendar
  is ~365 month clicks.
- **`blocked_dates_update_own_listing` is a knowingly unused policy.** F11 only
  inserts and deletes; widening a block is remove-and-re-add. Worth knowing before
  it is read as evidence that editing a block is supported.
- **No keyboard or screen-reader pass on the calendar** — it inherits F06's gap
  exactly: the cells are tabbable buttons but the `role="grid"` arrow-key
  roving-focus pattern is not implemented, and a 40-cell tab sequence per month is
  not a usable path. The `aria-live` selection hint has not been heard. F18 owns it.

**Deferred / follow-ups:**
- **F12 inherits `bounds`, and the `unavailableRanges` prop that has been empty
  since F06.** What it still owns is the *source* of those ranges for a guest: a
  per-listing `security definer` function, because an anon visitor reads zero
  booking rows. F11's query is host-only and cannot be reused for it.
  → **Done in F12** (2026-07-26).
- F12 should reuse `findBlockConflict`/`bookedNightsRange` for its own
  availability re-check rather than writing a third overlap implementation.
  → **Done in F12** (2026-07-26): `lib/actions/bookings.ts:138` calls
    `bookedNightsRange` — no third overlap implementation was written.
- `e2e/calendar.ts` is F12's for free — including the "never `.first()` a day
  cell" trap, which will bite the booking widget's specs identically.
  → **Done in F12** (2026-07-26), including `revealDay`, extracted because a disabled
    day must never be clicked.

---

## Phase 3 · Close-out — verification catch-up & the second fixture account  *(2026-07-26)*

Not a numbered feature and not a bug fix: Phase 3 was already green on every gate
when this started. It re-verified that, then closed the **second-test-user**
backlog that had been open since F04 — the single item three separate gaps were
all waiting on.

**Scope built (7 files):** `SECOND_USER` + `SECOND_AUTH_STATE_FILE` in
`e2e/constants.ts`; `mintSessionCookies(user)` parameterised in `e2e/session.ts`;
a second setup step in `e2e/auth.setup.ts`; `secondUserId`, `fixtureUserIds`,
`setUserAdmin`, `fixtureAdmins` and a `hostId` option on `createDraftListing` in
`e2e/fixtures.ts`; an admin-reset pass in `e2e/global-teardown.ts`;
`e2e/second-user.spec.ts` (3 specs). Two `code-standards.md` reconciliations.
**No migration, no new dependency, no `src/` change, `database.types.ts`
untouched.**

**Verification pass (before any change):**
- `tsc` clean, `lint` clean, **194/194** unit, **265 passed / 3 skipped** E2E,
  `npm run build` green at **15 routes**, working tree clean at `3c0b902`.
- **`seed-verification.sql` — 46/46 PASS.** Seed intact after a full suite run:
  26 / 24 / 130 / 17 / 7 / 5 / 0 favorites, **0 listings owned by a fixture
  user**, 0 orphans, 0 sentinel leftovers, **0 photo rows carrying a
  `public_id`** (nothing has ever leaked to Cloudinary).
- `get_advisors(security)` — **5 WARNs**, the documented baseline, no sixth.
- Migration filenames match remote `schema_migrations` **7/7**.
- **Invariants checked against source, not docs**: no Supabase client
  constructed outside `lib/supabase/`; no `.from()` outside queries/actions
  (bar the sanctioned sign-route check); zero bare `<img>`; no barrels; no deep
  relative imports; no hardcoded hex; no TODO/FIXME; no stray `console.log`;
  every action `'use server'`; every query `import 'server-only'`.
- **The F06 trap is absent.** All four `bookings` reads are `.eq('host_id',
  user.id)`-scoped. No guest-facing bookings read exists — F12's function is
  still genuinely unbuilt, confirmed against `pg_proc` (5 public functions, and
  `unavailable_listing_ids` still takes no listing parameter).
- **The F07 invariant holds**: zero `loading.tsx` files anywhere, against four
  routes that call `notFound()`.
- **Smoke-tested on a PRODUCTION build**, because `next dev` cannot prove F07's
  status codes: `/` 200, published listing 200, **draft 404**, malformed id 404,
  `/trips` 307, `/host/listings` 307, unauthenticated `/api/sign-cloudinary`
  **401**, and the draft title appears **0 times** in anon HTML. Server log
  carries no errors — only the known lockfile warning.

**Decisions:**
- **A second account, not a second session.** The point is to be a *different
  principal*; a second session for the same user asks RLS the identical question.
- **The second account is deliberately NOT a standing admin.** The admin spec
  grants `is_admin`, asserts, and revokes in a `finally`, with
  `global-teardown.ts` as the backstop. Fixture passwords are committed to this
  repo, so a permanent admin fixture would be a genuine privilege path into the
  same project that holds live data — and F17's moderation includes a hard
  delete. A timeout skipping a `finally` is not hypothetical here: it is exactly
  how F09 leaked three listings and how the F09 follow-up orphaned two Cloudinary
  assets.
- **`second-user.spec.ts` runs `mode: 'serial'`, and that is load-bearing.**
  `fullyParallel: true` parallelises tests *within* a file too, and two of these
  specs assert on the account's whole favorites state. This is the one file that
  owns global per-user state, and it owns it by running alone — which is what
  finally makes "the favorites page is empty" assertable. F08's no-row-counts
  rule was about the *shared* account, not about the assertion being wrong.
- **Both fixture users are excluded from `loadPublishedListings` /
  `loadDraftListings`, and both are swept by teardown.** The null-embed spec
  publishes a listing hosted by the primary user, so a sweep scoped to one host
  would miss rows the other left. `min_nights: 30` keeps any published fixture
  out of both sides of `search.spec.ts`'s exact-count comparison — F10's fix,
  reused rather than rediscovered.
- **Two `code-standards.md` reconciliations, because the code was right and the
  standard was under-specified.** `/api/sign-cloudinary` carries a non-null
  assertion on `CLOUDINARY_API_SECRET` and a direct `.from('listings')`
  ownership read; both are prescribed verbatim by `architecture.md` → Key
  Patterns, while `code-standards.md`'s general rules carved out neither. The
  standard now names them, scoped narrowly so neither reads as a general licence.

**Gotchas:**
- **A Google account cannot serve as a fixture user, and adding one does not
  unblock anything.** Playwright cannot drive a consent screen — the same reason
  F04 provisions through email/password in the first place. Worth stating
  plainly in the tracker, because "add another user" is the obvious reading of
  what these gaps needed, and it is the one form of second user that does not work.
- **The null-embed spec's headline assertion passes vacuously on a crashed
  page.** `getByRole('link', { name }).toHaveCount(0)` is satisfied when the
  route 500s, because a 500 has no links either. Gate proof 1 removed the filter
  in `toFavoriteCards` and the *count* assertion still passed — what failed was
  the trailing "the page still renders" check. Eighth instance of this project's
  recurring trap, and the first where the false pass came from the page being
  **absent** rather than from a locator matching too much.
- **The `/favorites` empty-state spec asserts its own precondition.** It reads
  `readFavorites(secondUserId)` and requires `[]` before navigating; a stale row
  from an interrupted run would otherwise fail the assertion for a reason that
  has nothing to do with the page.
- **The grid's absence is asserted, not just the empty text.** An empty `<ul>`
  would render a silent blank panel and still satisfy a text-only assertion.

**Verified (agent, Node v26.5.0):**
- `tsc` clean; `lint` clean; `npm run test` **194/194** (unchanged — no `src/`
  logic changed); `npm run test:e2e` **269 passed / 3 skipped** (265 prior + 3
  new specs + 1 new setup step) from a deleted `e2e/.auth` and a free :3000.
- **`toFavoriteCards` has now met a real null.** Host = primary user, viewer =
  second user: the favorite renders while published (the positive control), and
  after the host unpublishes it the card is gone, **the favorites row is still
  in the table**, and the page still renders. That last pair is what makes it a
  null-*embed* proof rather than a deleted-row proof.
- **`/favorites`' empty state renders** for an account with zero rows, with no
  `Saved stays` list in the DOM.
- **`/admin` opens and closes with `is_admin`**, proven with the negative
  control first on the same account and same route, then re-checked after
  revocation — so the 200 can only mean the flag decided it.
- **All three gate proofs fire**, each run against the broken build and then
  reverted: removing `toFavoriteCards`' null filter fails the null-embed spec;
  replacing `/admin`'s `is_admin` check with a bare session check fails the
  negative control; inverting the `favorites.length === 0` branch fails the
  empty state. `git diff src/` is empty afterwards.
- **The database is clean after a full run**: seed at 26 / 24 / 130 / 17 / 7 / 5,
  0 favorites, 0 fixture listings, and **exactly one admin — the developer's
  Google account**, confirming the temporary grant was given back.

**Not verified — honestly outstanding:**
- **The teardown's admin-reset backstop has never actually fired.** It exists for
  the run killed mid-spec; every run so far reached its `finally`. Same shape as
  the `global-teardown` listing sweep, which did fire once, in F09.
- The rest of the backlog is unchanged and triaged in `progress-tracker.md`:
  the `{ ok: false }` Supabase-error branch is still unexercised in every action,
  and the keyboard/screen-reader pass is still deferred (six features running).

**Deferred / follow-ups:**
- **F14 and F16 need the second account as a feature, not a fixture** — host
  reservations need a guest who is not the host, and messaging needs two
  participants. The harness is now in place for both.
- F17 inherits a working `/admin` route-gate spec and should extend it rather
  than write a third user.
- The Supabase branch `main` now reports `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`
  rather than the `MIGRATIONS_FAILED` F02 recorded. **What changed it was not
  observed, so this is not evidence the migration rename works** — that remains
  documented-correct and unverified. Disabling the GitHub integration is still a
  dashboard action.

---

## Phase 4 · Feature 12 — Instant Book  *(2026-07-26)*

**Scope built (13 files):** migration `0008_listing_occupancy_rpc`
(`listing_occupied_ranges`); `priceBreakdown` + `PriceBreakdown` in `lib/utils.ts`
(+5 unit tests); `lib/validations/bookings.ts` (`createBookingSchema`, +12 unit
tests); `getListingOccupiedRanges` in `lib/queries/listings.ts`;
`getCurrentUserId` in `lib/queries/profiles.ts` (with `isSignedIn` redefined on
it); `lib/actions/bookings.ts` (`createBooking`, `bookableListing`);
`components/listings/BookingWidget.tsx` with local `ReserveControl`,
`Confirmation`, `Breakdown` and `GuestStepper`; **`ReservationCard.tsx` deleted**;
`app/listings/[id]/page.tsx` given `searchParams` and rewired; `revealDay`
extracted in `e2e/calendar.ts`; `readBookings` widened and
`updateFixtureListing` added in `e2e/fixtures.ts` (plus a fixture-host exclusion
on `loadSeedSnapshot`); `e2e/booking.spec.ts` (10) and
`e2e/booking-responsive.spec.ts` (16). One migration, **no new dependency**.

**Decisions:**
- **One definer function returning inclusive spans, and the trap is sharper than
  F06's.** `0007` answers "which listings are busy in this range" and returns ids;
  the widget needs the transpose. `listing_occupied_ranges(p_listing_id)` returns
  `[start_date, end_date]` spans for one **published** listing, unioning confirmed
  bookings with host blocks. F06's finding was about *anonymous* visitors; here the
  `bookings` SELECT policy means **any signed-in guest reads zero rows for a
  listing they do not host** — so the everything-is-free answer was waiting inside
  the **write path** too, not only on the calendar. Rejected a second
  `is_listing_available()` boolean: it would narrow the race window slightly and
  cost a second definer function, a second hardening block, and another advisor WARN.
- **The half-open → inclusive conversion happens in SQL.** Returning bookings
  half-open and blocks inclusive in one result set hands the caller two conventions
  in the same array, which is exactly how the two models drift. One model crosses
  the boundary; `bookedNightsRange` converts the *candidate stay* on the way back.
- **The action reads through the query module — a first for an action here.** Every
  other action does its own reads via a private helper (`ownPhotos`,
  `ownOccupancy`). This one imports `getListingOccupiedRanges` because it is the
  *identical* question the page asks, and a second `.rpc()` call site is how the
  calendar a guest reads and the rule that refuses them come apart.
- **The past-date floor is strict, inverting F10 and F11.** Both widened their
  cutoffs by a day because refusing was the harmless error. Here refusing is *also*
  harmless and strictness is what refuses: a booking accepted with a past
  `check_in` can never be cancelled — `bookings_update_cancel_own_or_admin`
  requires `check_in >= current_date` — so leniency hands the guest a stay they
  cannot exit. Re-picking costs one click.
- **`null` is not `[]`.** `getListingOccupiedRanges` returns `null` when the check
  itself failed, and the widget then disables Reserve and says why while the action
  refuses outright. Collapsing the two would invite a booking on a calendar nobody
  verified — F06's rule that unverified availability is worse than none.
- **The per-listing guest cap was missing from the plan and was added.** The table
  checks only `guests_count between 1 and 16`; nothing enforced
  `guests <= listing.max_guests`, though `seed-verification.sql` had asserted it
  since F03. It is now the action's, and only the action's.
- **Confirmation is in-page.** `/trips` is F13's placeholder, so a redirect would
  send a guest who just reserved to a page showing nothing. The panel reports the
  **stored** total rather than the widget's own arithmetic — they differ only if
  the host edited the price mid-decision, and in that case the row is the truth.
- **The mobile bar never books.** It opens a full-screen sheet (`SearchBar`'s
  pattern) labelled "Reserve" once a stay is selected and "Add dates" before that;
  the sheet holds the real Reserve. A bottom bar that commits a stay in one tap
  with the total off screen is the wrong shape for the one irreversible action here.
- **All three placements live in one component**, keeping F07's reason: they share
  one range, one guest count and one price, so they cannot disagree about what is
  being booked or what it costs.
- **`ReservationCard.tsx` was deleted rather than left beside its replacement.** An
  inert component whose docstring names its successor is the drift this journal
  keeps recording.
- **The block-overlap guard stays in the action, race documented.** No constraint
  spans `bookings` and `blocked_dates`, so a guest booking in the same instant a
  host blocks can still land under the block. Benign, and the mirror of F11's
  accepted race: `unavailable_listing_ids` unions both halves, so search excludes
  the listing either way and no stay is erased. No trigger — `architecture.md`
  describes no such mechanism and F17's admin path would inherit it.
- **`revealDay` extracted from `pickDay`.** F12 asserts days are **disabled**, and a
  disabled cell must never be clicked: Playwright waits for actionability, so the
  click hangs for the full timeout instead of failing fast. Anything that only
  *looks* at a day now goes through the non-clicking half.
- **`loadSeedSnapshot` now excludes fixture-hosted listings**, like
  `loadPublishedListings` already did. `min_nights: 30` keeps a published fixture
  out of the exact-count comparison, but one search spec picks its subject with
  `find((l) => l.minNights > 1)` — for which a 30-night fixture is a candidate. It
  would then have asserted against a row another spec was about to delete.

**Gotchas:**
- **A guard the database also enforces cannot be gated by a test, and the test
  passes anyway.** The spec proving `createBooking` refuses taken dates was written
  against a *booking* overlap, and it **passed with the availability check
  deleted** — `bookings_no_overlap` refused the insert and `23P01` maps to the same
  sentence the guard produces. It was measuring the constraint. The gate moved to
  the case no constraint can reach — a booking over a host's `blocked_dates` — and
  that one fails properly: with the check removed, the booking **succeeds**. Ask
  which layer would catch the defect if this layer were missing.
- **The same shape hid in the money assertion.** `createDraftListing`'s $123.00 ×
  30 nights gives a service fee of exactly 51660 cents whether you round or
  truncate, so the cents spec **passed against `Math.floor`** while the unit tests
  failed. The fixture price is now $123.33, where the two answers differ by a cent,
  and the spec gates the half-up rule end to end. The unit tests caught the
  regression either way — but the E2E claimed to and did not.
- **A real defect, found by a click that could not land.** The calendar popover hung
  below the reservation card at `top-full`, and because the rail is `sticky` the
  page cannot scroll it into view: "Clear dates" and "Done" sat at y≈810 on a
  720px-tall viewport, permanently. That is a **user-facing** bug on any short
  laptop screen, not a test artifact. The panel now opens to the *left*,
  top-aligned, the way DESIGN.md's reference does. The responsive spec samples
  desktop at 1128×**720** for exactly this, and asserts by **clicking** the footer
  controls rather than with `toBeInViewport()`, which depends on where the page
  happens to be scrolled.
- **ARIA drops an accessible name on a generic element.** F07's mobile bar was a
  `<div aria-label="Reservation summary">` — announced by nothing, and matchable by
  no role-based locator, which is why `getByRole('generic', { name })` found zero
  elements. It is an `<aside>` now. Two `complementary` landmarks is correct here:
  only one is ever on screen and each names what it is.
- **F07's own responsive spec asserted on a button F12 removed.** Four specs failed
  on `getByRole('button', { name: 'Reserve' })`; signed out the rail's CTA is now
  "Sign in to book" and the bar's is "Add dates". Updated, and **scoped to its
  container** — the nav's `SearchBar` carries its own "Add dates" button, which is
  the ninth instance in this project of a locator coupled to something outside the
  thing under test.
- **React separates adjacent text expressions with `<!-- -->`**, so `{guests}{' '}
  {'guests'}` serialises as `3<!-- --> <!-- -->guests`. A raw-HTML grep for
  "3 guests" finds nothing on a perfectly correct page. Playwright reads
  `textContent`, so specs are unaffected — but a curl-and-grep smoke test is not.
- **`revealDay` had to exist before the disabled-day assertions could.** The
  calendar opens on the current month and F12's fixtures sit +40 days out, so the
  cells are one to two months ahead of the opening view; asserting on them without
  walking the calendar forward fails with "element not found" and reads like a
  missing feature.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **211/211** (194
  prior + 17 new); `npm run test:e2e` **295 passed / 3 skipped** (269 prior + 26)
  from a deleted `e2e/.auth` and a free `:3000`; `npm run build` green with **15
  routes** (F12 adds none) and `ƒ Proxy (Middleware)` still printing.
- **Inferred RPC types proved real, not `never`** — a throwaway `const _probe: null
  = data` made tsc print `{ end_date: string; start_date: string }[] | null`.
  F04's `@supabase/ssr` incident is why this is checked rather than assumed.
- **The RPC checked against the raw tables**, not against itself: for the listing
  with both a booking and a block, its two spans equal `check_in`/`check_out - 1`
  and `start_date`/`end_date` exactly.
- **Live REST, anon key:** `GET /bookings` → `[]`, while
  `POST /rpc/listing_occupied_ranges` returns the real spans; a **draft** id
  returns `[]` and a null id returns `[]` without erroring. The bypass is the
  function, not the table.
- **Bookings checked against the table, never the confirmation panel.** A booked
  stay stores 30 nights at **12333** cents, cleaning **0**, service **51799**,
  total **421789**, the right guest id, the right dates, `status = 'confirmed'` —
  and `total` equals the sum of its own parts in the row.
- **Half-open proven at the surface a guest touches:** after a booking, its first
  night and the night before checkout are disabled for an **anonymous** visitor
  while the **checkout day is enabled**, and a second stay starting on that day
  books successfully. Blocks are inclusive: both ends disabled, `end + 1` free.
- The four action-only guards refuse and write nothing: a stay under a
  mid-decision `min_nights`, more guests than a mid-decision `max_guests`, nights a
  host blocked mid-decision, and dates another guest took mid-decision. A host
  viewing their own listing gets the stated reason and a disabled Reserve.
- Signed out, the rail is a sign-in form whose `next` carries the path **and** the
  selection, with **zero** live Reserve controls and no booking row.
- **Responsive measured at 320 / 375 / 744 / 1128 / 1440** — each band's lower
  boundary, with modest heights. Exactly one of the rail and the bar visible at
  every width, no horizontal page overflow (including while the popover is open),
  every reservation control ≥44px on its shorter side, and the phone path driven
  end to end: bar → sheet → Reserve → confirmed row → the bar reporting "Reserved".
- **All six gate proofs fire**, each run against the broken build and then
  reverted: removing the `min_nights` guard, removing the availability check (against
  the *block* spec), `isOwnListing={false}`, `Math.round` → `Math.floor`, the SQL
  `check_out - 1` → `check_out`, and restoring the popover to `top-full`. The two
  that did **not** fire on the first attempt are recorded above.
- `get_advisors(security)` — **exactly 7 WARNs**, the two new ones being the new
  function's anon + authenticated EXECUTE. The SQL function was restored after the
  proof and re-verified: the `- 1` conversion, `prosecdef`, `search_path=""`, and
  both grants.
- **`seed-verification.sql` — 46/46 PASS.** Seed intact after a full suite run:
  26 / 24 / 130 / 17 / 7 / 5 / 0 favorites, `listings` total **26** and `bookings`
  total **17** (so neither fixture account left a row), **0** photo rows carrying a
  `public_id`, and exactly **one** admin.
- **Smoke-tested on a PRODUCTION build**, because `next dev` cannot prove F07's
  status codes and this feature added a `searchParams` read to that route: `/` 200,
  published listing 200, **the same listing with date params 200**, draft **404**,
  malformed id **404**, `/trips` **307**, unauthenticated `/api/sign-cloudinary`
  **401**, the draft title **0** times in anon HTML, and no errors in the server log.
- Migration filenames match remote `schema_migrations` **8/8**.

**Not verified — honestly outstanding:**
- **A guest cannot check *out* on the day another guest checks *in*.**
  `DateRangePicker.isSelectable` disables every occupied day outright, so although
  the straddle test explicitly permits an unavailable day as a half-open *end*, the
  cell cannot be clicked. One bookable night at each boundary is unreachable. The
  documented invariant (check *in* on another's checkout day) does work and is
  covered. Left alone rather than widening a `components/ui/` primitive mid-feature.
- **`createBooking`'s past-date branch has never run** — the calendar never offers a
  past day, so reaching it needs a forged request.
- **The `23P01` branch never runs in a normal suite.** The app-side check fires
  first, so the exclusion constraint's own refusal is reachable only in a true race
  — or by deleting the check, which is how the gate proof found it.
- **The `42501` branch (host unpublishes mid-decision) is likewise unexercised.**
- **A signed-in third-party guest is unreachable.** "These nights are now taken to
  someone else" is proven against **anon**, the stronger principal (zero booking
  rows, no session). A signed-in guest who is neither host nor booker needs a third
  fixture account — F12's host and booker use both.
- **The `{ ok: false }` Supabase-error branch is still unexercised**, as in every
  action since F08.
- **No keyboard or screen-reader pass** on the stepper, the popover or the sheet.
  The sheet is a `role="dialog"` with `aria-modal` but **no focus trap and no
  focus restore**, and the calendar still lacks F06's `role="grid"` roving focus.
  F18 owns it, now seven features running.

**Deferred / follow-ups:**
- **F13 inherits the confirmation's link to `/trips`** and should make it land on
  the guest's actual booking. `revalidatePath('/trips')` already fires.
  → **Closed by F13.** The link is unchanged and now lands on a real page.
- **F13's cancel window is the next DB-enforced rule**, so its gate proof needs
  F12's lesson: the UPDATE policy would refuse a late cancel even with the action's
  check removed, so the spec must target something only the action enforces.
  → **Closed by F13**, and the answer was sharper than expected: there is no
  window check in the action at all. The only thing it enforces is that the update
  **changed a row** — RLS refuses by filtering, so a refused cancel returns success
  with zero rows. That is what the gate proof targets.
- F13/F14 should reuse `readBookings`'s widened shape as their oracle.
  → **Closed by F13**, which reused it and added a single-row `readBooking`
  alongside — the cancel assertions need one booking's every column, not a
  listing's set.

---

## Phase 4 · Feature 13 — Trips (guest reservations)  *(2026-07-26)*

**Scope built (11 files):** `tripSection` + `canCancelBooking` + `TripSection` in
`lib/utils.ts` (+13 unit tests); `lib/queries/bookings.ts` (`getGuestBookings`,
`toTrip`, `TripData`/`TripListing`/`GuestTrips`); `cancelBookingSchema` in
`lib/validations/bookings.ts` (+6 unit tests); `cancelBooking` in
`lib/actions/bookings.ts`; `app/trips/page.tsx` rewritten from
`FeaturePlaceholder`; `components/trips/TripCard.tsx` and
`components/trips/CancelTripButton.tsx`; `guestId` added to `createBookingRow` and
`readBooking` added in `e2e/fixtures.ts`; `e2e/trips.spec.ts` (8) and
`e2e/trips-responsive.spec.ts` (10); two re-based assertions in `e2e/search.spec.ts`.
**No migration, no new dependency, no new route.**

**Decisions:**
- **The action enforces none of the cancellation rules, and that is the feature.**
  Ownership, `status = 'confirmed'` and `check_in >= current_date` all live in
  `bookings_update_cancel_own_or_admin`'s USING clause; the writable-column list
  (`status`, `cancelled_at`) lives in `0006`. Re-checking any of them in JS would buy
  nothing the database is not already doing, and re-checking the *date* would import
  `createBookingSchema`'s past-date trap — `todayISO()` and `current_date` disagree by
  a day around midnight. What only the action can do is notice that **zero rows
  changed**: `architecture.md` already warned that an UPDATE with no matching policy
  "affects zero rows and returns success, which is indistinguishable from 'it worked'",
  and this is the first feature where that sentence is the whole implementation.
  `.select('id, listing_id').maybeSingle()` + `if (!data)` is it.
- **`getGuestBookings` filters `guest_id` explicitly — the inverse of `getFavorites`.**
  That query deliberately omits its `user_id` filter because the `favorites` policy *is*
  `user_id = auth.uid()`. The `bookings` SELECT policy is broader: guest **OR** the
  listing's host **OR** `is_admin()`. Copying the favorites pattern would have put
  F14's screen inside F13's and handed an admin the entire table, with nothing erroring
  — the same *shape* as F06's trap but pointing the other way: there, missing rows
  inferred a permission; here, **extra** rows answer a different question than the one
  the page asks.
- **Two sections, four temporal states.** "Upcoming" means *still going to happen*
  (`confirmed` **and** `check_out >= today`), so an in-progress stay sits there with a
  stated reason instead of a control, and every cancelled booking is Past whatever its
  dates say. Filing an in-progress stay under "Past" would tell someone the stay they
  are physically on is over; listing a cancelled future stay under "Upcoming" is the
  same lie reversed. Both rules are pure functions in `lib/utils.ts` so they are
  testable without a database.
- **A booking outlives its listing's visibility, and keeps its card.** Once a host
  unpublishes, RLS returns a null `listings` embed to the guest. `/favorites` drops
  such rows via `toFavoriteCards` — right for a saved listing, wrong for a reservation
  twice over: the guest still holds it, and the cancel control lives on the card that
  would have been dropped. It renders "This listing is no longer available", unlinked,
  with dates/guests/total/status intact.
- **`canCancel` mirrors the policy exactly rather than widening, inverting F10 and
  F11.** Those pushed their cutoffs out a day because refusing was the harmless error.
  Here the two sides fail differently: offering a Cancel the server refuses produces an
  honest sentence (the zero-row guard), while hiding one the server would have accepted
  silently removes the option. Matching the policy keeps the disagreement recoverable.
- **DESIGN.md `button-secondary` at 48px, not `HOST_CONTROL`'s 44px.** That compromise
  exists because four controls share one row at 320px; a trip card has one, so it gets
  the real spec. Promoting `hostControlStyles.ts` into `components/ui/` was considered
  and dropped — it would have been a three-file refactor to reach a token this surface
  does not want.
- **`revalidatePath('/host/listings')` on cancel**, alongside `/trips` and the listing.
  `getOwnListings` derives `canDelete` from `blocksListingDeletion`, so a cancellation
  can unblock a host's delete button two screens away.

**Gotchas:**
- **The planned teardown pass was written, then deleted as redundant.** The plan assumed
  F13's fixture bookings would sit on *seeded* listings and so would not cascade —
  making `seed-verification.sql`'s count of 17 vulnerable to a spec killed before its
  `finally`. Reading `listingsOwnedByFixtureUser` disproved it: it already covers **both**
  fixture accounts, and F12's geometry (second account hosts, primary books) keeps every
  row on a sweepable listing. Shipping cleanup for a state that cannot occur would have
  been a docstring describing a scenario that does not exist.
- **postgrest-js types the `listings` embed as never-null, and a probe proved it.** A
  throwaway `const _probe: null = data` made tsc print
  `listings: { id: string; title: string; … }` with no `| null`. So the null-embed branch
  the unpublish spec exercises is one TypeScript would never have asked for — F08's
  finding, reproduced on a different table. F04's `@supabase/ssr` incident is why this is
  probed rather than assumed; the same probe also confirmed the select had not degraded
  to `never`.
- **F13's route count prediction was wrong.** The plan expected 16 routes on the grounds
  that `/trips` "becomes dynamic". It was already a route — a placeholder page is still a
  page — so the build stays at **15**. → **Did not happen.**
- **F13 exposed a latent race in `search.spec.ts`, and it took a full-suite run to
  surface.** Two assertions compared live grid counts taken across *two separate
  navigations* (`countAt('/')` vs `countAt('/?…')`). Any concurrently-published fixture
  listing entering or leaving between them breaks the comparison — and a *stable* extra
  listing does not, which is why F12's publishers never triggered it and F13's extra ones
  did. Both were re-based onto `snapshot.listings`, the seeded population no spec mutates.
  **They were then re-gate-proved**: with a spurious `.gte('max_guests', 10)` in
  `getPublishedListings`, both still fail — the re-base weakened their *timing*
  sensitivity, not what they gate.
- **The gate proof needed the UI relaxed before it could reach the branch.** `canCancel`
  never renders a control for a stay the policy would refuse, so the refusal is
  unreachable through the interface — the same shape as `createBooking`'s past-date
  branch. Temporarily setting `canCancel: row.status === 'confirmed'` made an
  in-progress stay cancellable on screen; with the `!data` branch present the spec
  passes, and with it deleted **no refusal appears at all**. Both changes reverted.

**Verified (agent, Node v26.5.0):**
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` **230/230** (211 prior
  + 19 new); `npm run test:e2e` **313 passed / 3 skipped** (295 prior + 18) from a
  deleted `e2e/.auth`; `npm run build` green with **15 routes** and
  `ƒ Proxy (Middleware)` still printing.
- **Cancellation checked against the table, never the page.** After a UI cancel the row
  reads `status = 'cancelled'` while `check_in`, `check_out`, `price_per_night`,
  `service_fee` and `total` are **byte-identical to before** — the `0006` column grant
  proving itself rather than being read about.
- **The nights are genuinely freed, proven against anon.** The first night of a booked
  stay is disabled on an anonymous visitor's calendar, and enabled again after the
  cancel — so the change came through `listing_occupied_ranges`, not through a session
  that could read `bookings`.
- **Both gate proofs fire**, each run against the broken build and then reverted:
  deleting `.eq('guest_id', user.id)` makes a host see a stranger's booking in their own
  Trips (`Expected 0, Received 1`), and deleting the `!data` branch removes the refusal
  entirely while the row stays `confirmed`.
- All four temporal states asserted end to end: upcoming (cancellable), in-progress
  (Upcoming, reason stated, no control), finished (Past, no control), cancelled (Past,
  badged, no control) — plus the unpublished-listing fallback, still cancellable.
- **Responsive measured at 320 / 375 / 744 / 1128 / 1440** — each band's lower boundary,
  no horizontal page overflow either before or **after** the two-step confirm puts two
  controls on one row, and the cancel control ≥44px on its shorter side at every width.
- `get_advisors(security)` — **exactly 7 WARNs**, unchanged. F13 adds no migration.
- **`seed-verification.sql` — 46/46 PASS** after a full suite run: 26 / 24 / 130 / 17 /
  7 / 5 / 0 favorites, and exactly one admin.
- **Smoke-tested on a PRODUCTION build** (`next dev` cannot prove status codes): `/`
  **200**, `/trips` **307** signed out, `/favorites` **307**, and no errors in the
  server log.
- Migration filenames match remote `schema_migrations` **8/8**.

**Not verified — honestly outstanding:**
- **`cancelBooking`'s zero-row refusal never runs in the normal suite.** `canCancel`
  hides the control for exactly the stays the policy would refuse, so reaching it needs
  a forged request — or a stay whose check-in passes while the page sits open. Proven
  once, with the UI deliberately relaxed.
- **The `{ ok: false }` Supabase-error branch is unexercised**, as in every action since
  F08.
- **The 100-trip ceiling (`MAX_TRIPS`) has never been approached** — it is a defensive
  bound, not pagination, and no fixture comes close.
- **No keyboard or screen-reader pass** on the two-step cancel. Swapping "Cancel
  reservation" for "Confirm cancellation" moves focus nowhere, so a keyboard user lands
  on whatever follows in DOM order. F18 owns it, now eight features running.
- **The "listing no longer available" card is proven only for an *unpublished* listing**,
  not a deleted one. A hard delete cascades the booking away entirely (F10's finding), so
  that state is unreachable by design — worth knowing before someone tries to test it.

**Deferred / follow-ups:**
- **F14 must prune a Key Decision** before adding its own; the list is back at the cap.
- **F14 inherits the `guest_id` lesson directly.** `getHostReservations` asks the
  mirror-image question, and the same SELECT policy admits all three principals — so it
  needs its own explicit scoping and its own "not mine" gate proof.
- **F17's admin cancel, unpublish and delete all inherit the zero-row guard.** Each is an
  RLS-scoped write whose refusal arrives as success; `cancelBooking` is the pattern to
  copy, not re-derive.
- **The developer's own Google account now holds a real upcoming booking** (Jul 27–30, a
  seeded listing). Harmless — every seed assertion is prefix-scoped — but a whole-table
  `bookings` count is no longer 17, and F14's fixtures should not assume it is.
