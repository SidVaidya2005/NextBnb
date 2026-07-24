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
