# Build Journal

> **Role:** Full archive of build decisions, gotchas, and verification results, organized by feature.
> **Write to after every completed feature.** When `progress-tracker.md` "Key Decisions" exceeds ~10 bullets, prune the older/lower-stakes ones here.
> **Relates to:** mirrors the feature order in `build-plan.md`.

<!-- Entry format — repeat per completed feature:

## Phase {{N}} · Feature {{NN}} — {{FEATURE_NAME}}  *(YYYY-MM-DD)*
- Decision: …
- Gotcha: …
- Verified: …

-->

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
- Next 16 warns that **the `middleware` file convention is deprecated in favour of `proxy`**. Pre-existing from F01 and harmless today; worth handling in F04 when auth actually exercises the middleware.
- A stray `~/package-lock.json` makes Next infer the wrong workspace root ("detected multiple lockfiles"). Cosmetic, outside the repo, unrelated to this feature.

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
- The stray `~/package-lock.json` multiple-lockfile warning persists. Cosmetic, outside the repo.
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
- **`access_denied` handling** (cancelling at the Google consent screen should return home with
  no error banner) has not been exercised — it needs a deliberate cancel.
- **Responsive verification of the account menu** at the four DESIGN.md breakpoints has not been
  done — the dropdown drives both the tablet+ control and the mobile hamburger, so it is the one
  new piece of UI whose collapse behaviour still needs eyes on it.

**Deferred / follow-ups:**
- After the first real Google sign-in, flip `is_admin` by hand on that profile (F02's step) to
  make `/admin` reachable; the non-admin redirect is already covered by a spec.
- `supabase/seed.sql`'s commented "adopt" snippet can now be used to point seeded listings at
  the real profile, filling `/host/listings` before F09.
- The stray `~/package-lock.json` multiple-lockfile warning persists. Cosmetic, outside the repo.

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
- **`access_denied` handling** (cancelling at the Google consent screen) — needs a human
  to click Cancel on a real consent screen; cannot be automated.
- **Whether `disable_signup: true` blocks first-time Google users** — asserted from
  GoTrue behaviour, deliberately *not* tested, because testing it means flipping the
  project's auth config and risking real onboarding.
- Mobile search-overlay collapse is still unbuilt, not unverified — the nav's search pill
  is a placeholder until F06, so `<744px` currently has no search affordance by design.

**Deferred / follow-ups:**
- If leaked-password protection is wanted, it needs the Pro plan
  (Authentication → Sign In / Providers → Email). Free-plan hardening that *is* available:
  raise the minimum password length and required character classes on the same screen.
- A **separate Supabase project for E2E** so production can disable the email provider
  entirely — the real answer to the open-signup finding. Decide during F18/deploy.
- The stray `~/package-lock.json` (dated 2026-03-11, outside the repo) still triggers
  Next's multiple-lockfile warning. Cosmetic; left alone deliberately since it lives in
  the developer's home directory.

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
- F06 extends `getPublishedListings()` with the filters parameter and the date-based
  availability exclusion; the `MAX_LISTINGS = 48` ceiling becomes real pagination
  pressure only if the catalogue grows past it.
- F08 adds the saved heart to `ListingCard` (deliberately omitted — a card that cannot
  save anything should not show the control).
- The stray `~/package-lock.json` multiple-lockfile warning persists. Cosmetic, outside
  the repo.

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
- The seed's dates are frozen at seed time, not recomputed daily, so absolute-date probes
  drift. The specs derive their windows from the database for this reason.

**Deferred / follow-ups:**
- F07 and F12 must read availability through `unavailable_listing_ids()`, never from
  `bookings`; F12 additionally fills the calendar's `unavailableRanges`.
- `MAX_LISTINGS = 48` is still a ceiling, not pagination. Filters make it less pressing,
  not resolved.
- The stray `~/package-lock.json` multiple-lockfile warning persists. Cosmetic, outside
  the repo.

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

**Deferred / follow-ups:**
- Disabling the GitHub integration is a **dashboard action** (Project Settings → Integrations);
  there is no MCP tool for it, so the developer does it.
- If branching is re-enabled in F18: move migrations to CLI-first, and use `config.toml`'s
  `[auth]` block to disable the email provider on production instead of the dashboard toggle.
