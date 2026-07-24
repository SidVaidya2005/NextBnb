# NextBnb

A full-stack Airbnb-style marketplace where users discover, filter, and instantly book short-term stays, and any user can host — create listings, upload photos, set pricing and availability, and manage reservations — with favorites, reviews, and guest↔host messaging.

## Project context lives in `context/`

The `context/` folder is the source of truth for this project. **Read it before
writing any code**, and keep it current as you work. Read in this order:

1. **`context/project-overview.md`** — what the product is, who it's for, what's in and out of scope.
2. **`context/architecture.md`** — stack, folder structure, system boundaries, data model, and the **invariants you must never violate**.
3. **`context/code-standards.md`** — the rules every change must follow.
4. **`context/library-docs.md`** — project-specific usage patterns for each library (read the relevant section before using one).
5. **`context/build-plan.md`** — the ordered phases and features to build.
6. **`context/progress-tracker.md`** — what's done, in progress, and next.

## Standing rules

- **Read `context/` first.** Never assume — verify against `project-overview.md` and `architecture.md`.
- **Obey the invariants** in `architecture.md`. They are non-negotiable (RLS everywhere, mutations only via server actions, money in cents, no double-booking, `getUser()` for auth).
- **Follow `code-standards.md`** on every change.
- **For libraries**, follow the authority order: **Context7** (`resolve-library-id` → `query-docs`) and the **Supabase MCP** → `context/library-docs.md` → general knowledge. If Context7 has no match, use web search for official docs — never rely on training-data memory for API shapes.
- **Stay in scope.** Build only what the current feature in `build-plan.md` requires — no real payments, no maps, no notifications (see out-of-scope).
- **Design system is `context/DESIGN.md`.** Use its tokens (encoded in `globals.css @theme`); Rausch `#ff385c` is the only accent, canvas is white, ink is `#222222`, font is Inter. Don't introduce off-palette colors or ad-hoc values.
- **Fully responsive, mobile-first.** Verify every screen at the DESIGN.md breakpoints (`tablet:744` / `desktop:1128` / `wide:1440`) — phone, iPad, laptop, desktop. Images render via `next-cloudinary` `CldImage` with `sizes`, never a bare `<img>`.
- **Update `progress-tracker.md`** after every completed feature — check the box, set current status, and add the single most important decision to "Key Decisions" (cap ~10 bullets).
- **Archive detail in `build-journal.md`** — after each feature, append a dated entry with full decisions, gotchas, and verification results. Prune `progress-tracker.md` "Key Decisions" into here when it exceeds ~10 bullets. Consult it when revisiting a completed feature, investigating a regression, or making a decision that might conflict with past work.

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
