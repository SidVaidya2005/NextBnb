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
