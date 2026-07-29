# NextBnb

A full-stack Airbnb-style marketplace where users discover, filter, and instantly book short-term stays, and any user can host — create listings, upload photos, set pricing and availability, and manage reservations — with favorites, reviews, and guest↔host messaging.

**Status: all 18 features shipped; the app is live and in maintenance.** New work is not a
feature in `build-plan.md` — it comes from `progress-tracker.md` → **Open work**, or from you.

## Project context lives in `context/`

The `context/` folder is the source of truth for this project. **Read it before
writing any code**, and keep it current as you work. Read in this order:

1. **`context/project-overview.md`** — what the product is, who it's for, what's in and out of scope.
2. **`context/architecture.md`** — stack, folder structure, system boundaries, data model, and the **invariants you must never violate**.
3. **`context/code-standards.md`** — the rules every change must follow.
4. **`context/library-docs.md`** — project-specific usage patterns for each library (read the relevant section before using one).
5. **`context/progress-tracker.md`** — live status, current baselines, and the open worklist.
6. **`context/build-journal.md` → Standing Constraints** — what still binds, by topic. Read before any change that might conflict with past work.

Two files are read on demand rather than every session: **`context/build-plan.md`** (the
build record — read a feature's entry before changing the code it produced) and
**`context/build-journal.md` → Feature Log** (the dated archive — read when investigating a
regression or revisiting how one feature went).

## Standing rules

- **Read `context/` first.** Never assume — verify against `project-overview.md` and `architecture.md`.
- **Obey the invariants** in `architecture.md`. They are non-negotiable (RLS everywhere, mutations only via server actions, money in cents, no double-booking, `getUser()` for auth).
- **Follow `code-standards.md`** on every change.
- **Check Standing Constraints before deciding something is a bug.** `build-journal.md` holds a dozen limitations that are deliberate and a dozen branches that are untested-but-reasoned. "Untested" is not "broken", and a documented won't-fix is not a defect to go and fix.
- **For libraries**, follow the authority order: **Context7** (`resolve-library-id` → `query-docs`) and the **Supabase MCP** → `context/library-docs.md` → official docs via web search. Never write an API shape from training-data memory — if none of those answers it, ask.
- **Stay in scope.** No real payments, no maps, no notifications (see out-of-scope). Do not widen a change beyond what was asked.
- **Design system is `context/DESIGN.md`.** Use its tokens (encoded in `globals.css @theme`); Rausch `#ff385c` is the only accent, canvas is white, ink is `#222222`, font is Inter. Don't introduce off-palette colors or ad-hoc values.
- **Fully responsive, mobile-first.** Verify every screen at the DESIGN.md breakpoints (`tablet:744` / `desktop:1128` / `wide:1440`) — phone, iPad, laptop, desktop. Images render via `next-cloudinary` `CldImage` with `sizes`, never a bare `<img>`.
- **Use logical commits.** Keep each commit focused, easy to review, and in a working state whenever possible.
- **Ask before committing.** Never create a commit without explicit approval, and never add coauthors unless explicitly requested.
- **Verify against the baselines before claiming done.** `progress-tracker.md` → Live baselines holds the current numbers for typecheck, lint, unit, e2e, build routes, migrations and security advisors. Run what the change touches and compare; a deviation is a finding to report, not a number to overwrite.
- **Update `progress-tracker.md`** after every completed change — tick any box, **overwrite** Current Status (never append to it), and add the single most important decision to the **top** of Key Decisions. That section holds the 10 most recent, newest first — when adding an 11th, **move** the oldest into `build-journal.md` → Standing Constraints under its topic.
- **Append to `build-journal.md` → Feature Log** after each completed piece of work — a dated entry with decisions, gotchas, and verification results.
- **Maintain the journal, don't just append to it.** Follow its "How this file is maintained" block: when a past claim turns out false add a dated `> **Corrected …:**` note *beneath the original*; when a "Not verified"/"Deferred" item closes append `→ **Closed by F<NN>**`; when a prediction fails append `→ **Did not happen.**`. Never delete wrong turns, verification numbers, or gotchas.
- **The Feature Log is never compacted** — a deliberate deviation from the `setup-context` skill, recorded in the journal itself. The build is complete and the file is read on demand, so its length costs nothing per session, while the `Verified:` lines are measurements that cannot be re-taken.

## Runtime & Commands

Requires **Node.js ≥20.9 (LTS)** and **TypeScript ≥5.1** (Next.js 16 minimums). Pin via `.nvmrc` + `package.json` `engines`.

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
- `npx tsc --noEmit` — typecheck without emitting
- `npm run test` — Vitest unit/component tests
- `npm run test:e2e` — Playwright end-to-end tests

Deploys to **Render** as a Web Service: build `npm run build`, start `npm start`. Env vars are set in the Render dashboard (see `code-standards.md` → Environment Variables).

## Tooling available

- **Context7 MCP** — current library docs (`resolve-library-id` → `query-docs`) for Next.js, Supabase SSR, Zod, react-hook-form, date-fns, Tailwind, Cloudinary. Use before writing library code.
- **Supabase MCP** — inspect/manage the project: `list_tables`, `apply_migration`, `execute_sql`, `generate_typescript_types`, `get_advisors`, `get_logs`. Regenerate `src/types/database.types.ts` after every schema change.
- **Cloudinary** — image storage/delivery (not an MCP): configured in `src/lib/cloudinary.ts`, signed via `/api/sign-cloudinary`. See `library-docs.md` → Cloudinary.
