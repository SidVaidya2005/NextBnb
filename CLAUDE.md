# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

This is an **npm workspaces monorepo** with two top-level packages:

- `backend/` — Express REST API (JSON only). Express + Mongoose + Passport.
- `frontend/` — Vite + React 18 + TypeScript + Tailwind v3 + Axios + React Query + React Router.

A single `npm install` at the root installs both. CI lives at `.github/workflows/ci.yml`. Style is one shared `.prettierrc` at the root; lint is per-workspace flat ESLint configs.

## Running things

There are no shell-level shortcuts beyond the workspace scripts. Always go through npm.

```bash
npm install              # installs both workspaces from the root lockfile
npm run dev              # boots backend (8080) + frontend (5173) via concurrently
npm run dev:backend      # backend only
npm run dev:frontend     # frontend only
npm run seed             # destructive: wipes listings collection, re-inserts init/data.js
npm test                 # runs backend tests then frontend tests
npm run test:backend
npm run test:frontend
npm run lint             # both workspaces
npm run format           # prettier --write across the repo
npm run format:check
npm run build            # frontend production build (also runs tsc -b)
```

Backend needs a local MongoDB at `mongodb://127.0.0.1:27017` _for `npm run dev` and `npm run seed`_. Tests do **not** need a local Mongo — they use `mongodb-memory-server` (in-process, downloaded on first run).

## Backend architecture

Layered. Each layer has a single responsibility:

- **`backend/routes/`** — Express routers, mounted by `routes/index.js` under `/api/*` and `/auth/*`. Routes are thin: they map URLs to controller methods, attach `requireAuth` where needed, nothing else.
- **`backend/controllers/`** — Reads `req.body` / `req.params`, calls a service, sends JSON. Every async handler is wrapped in `utils/asyncHandler` so thrown errors hit the central error middleware. Controllers do not touch Mongoose directly.
- **`backend/services/`** — All Mongoose calls live here. Services throw `new ApiError(404, ...)` when a lookup returns null — never silently 200 with `undefined`. This is the _one_ layer to grep when changing data access.
- **`backend/models/`** — Mongoose schemas. PascalCase filenames (`Listing.js`, not `listing.js`). `Listing` has a load-bearing setter that rewrites empty/null `image` values to a default Unsplash URL — preserve it if you touch the schema.
- **`backend/middleware/error.js`** — Last middleware mounted. Translates `ApiError` → `{ error: msg }` with the right status. Catches `CastError` (400) and Mongoose `ValidationError` (400). Everything else becomes 500.

**JSON-only contract.** Controllers send `res.json(...)` — no `res.render`, no redirects (except the OAuth callback). Request bodies are flat: `{ title, price, ... }`, not `{ listing: { ... } }`. The old EJS form convention is gone; do not reintroduce `req.body.listing`.

**No `express-async-errors`, no `express-session`.** Async errors flow through the explicit `asyncHandler` wrapper. Passport OAuth runs with `{ session: false }`; CSRF/state rides in the OAuth `state` query param. Don't add either dep back without revisiting the plan.

**Auth flow.** OAuth (Google + GitHub via Passport) hits `/auth/<provider>` → callback issues a JWT via `services/authService.signToken` → redirects to `${FRONTEND_URL}/oauth?token=...`. The frontend stashes the JWT in `localStorage` under `neobnb.token` (see `frontend/src/api/client.ts`) and the axios request interceptor attaches it as `Authorization: Bearer <jwt>`. `middleware/auth.requireAuth` decodes the JWT on protected routes.

## Frontend architecture

- **`frontend/src/api/`** — One file per resource (`listings`, `auth`, `bookings`, `wishlist`, `reviews`). All call through the single `apiClient` axios instance in `api/client.ts`. The TOKEN_KEY constant is exported from there too; nothing else writes to localStorage for auth.
- **`frontend/src/components/`** — Grouped by concern: `layout/` (AppShell, Header, Footer, Container, ProductTabs; legacy `Sidebar.tsx` is not mounted), `listings/` (Card, Grid, Form, HeartButton, GuestFavoriteBadge, RatingDisplay, CityLinkGrid), `search/` (SearchBarPill), `auth/` (login buttons, `ProtectedRoute`), `states/` (Empty, Loading, Error), `common/` (Button, Input, Card, Spinner, Icon). The design system is the Airbnb-style spec in `Design.md` (Rausch #ff385c accent, white canvas, Inter via Google Fonts). Tailwind tokens (`rausch`/`ink`/`surface`/`hairline`, `xxs`–`section` spacing scale, single `shadow-card` tier) live in `frontend/tailwind.config.ts`; typography utility classes (`.t-display-xl`, `.t-title-md`, `.t-body-sm`, `.t-uppercase-tag`, …) live in `frontend/src/index.css` — prefer those over arbitrary `text-[Npx]`. `AppShell` has no SubNav row; categories live on the home page itself.
- **`frontend/src/pages/`** — Route-level components. Each page composes layout + atoms + state components.
- **`frontend/src/routes/AppRoutes.tsx`** — Public vs. protected split. Protected routes (`/listings/new`, `/listings/:id/edit`, `/profile`, `/bookings`, `/wishlist`) wrap in `<ProtectedRoute>`, which renders `null` while the token is mid-verification and `<Navigate to="/login">` if no token.
- **`frontend/src/context/AuthContext.tsx`** — Single source of truth for `{ user, token, isAuthenticated, login, logout }`. The `<App>` is wrapped in `<AuthProvider>` in `main.tsx`. Use `useAuth()` everywhere — don't read the token directly from localStorage in components.

## Scaffold-only areas

A lot of feature surface exists as **skeleton files only** (no business logic):

- Backend: `controllers/{auth,user,booking,wishlist,review,upload}Controller.js`, the matching `services/`, the matching `routes/`, and `middleware/upload.js`, `services/cloudinaryService.js`. The 501-returning controllers are placeholders, not real endpoints.
- Frontend: pages for `/profile`, `/bookings`, `/wishlist` render real layouts but call no API. The `api/{auth,bookings,wishlist,reviews}.ts` functions are typed and ready, but the backend they call returns 501.
- Frontend `/oauth` callback page is **not built yet**: the backend OAuth callback redirects to `${FRONTEND_URL}/oauth?token=...`, but `AppRoutes.tsx` has no matching route. Implementing OAuth end-to-end means adding that route + reading the `token` query param + calling `useAuth().login(token)`.

When implementing one of these features, fill in the existing files rather than introducing new directories. The scaffold reserves the namespaces deliberately.

## Tests

Vitest on both sides; the test runners are identical.

- **Backend** (`backend/vitest.config.js`): `node` env, `test-setup.js` boots `mongodb-memory-server` in `beforeAll` and clears collections in `afterEach`. Tests can call Mongoose directly. Co-locate unit tests next to the file under test (`services/listingService.test.js`); HTTP-level integration tests go in `__tests__/integration/` and use `supertest(app)` (not `server` — no port binding in tests).
- **Frontend** (`frontend/vitest.config.ts`, separate from `vite.config.ts`): `happy-dom` env, `@testing-library/jest-dom` matchers via `src/test/setup.ts`. The setup file also installs a `MemoryStorage` shim on `globalThis.localStorage` and `window.localStorage` — Node 22+ ships an experimental `globalThis.localStorage` backed by a missing file that masks the DOM one; without the shim, `localStorage.getItem(...)` in component code returns undefined in tests. Render through `MemoryRouter` + `QueryClientProvider` + `AuthProvider` (see `App.test.tsx` for the harness shape).

Many tests are `it.todo(...)` stubs reserving the surface for features that aren't built yet. Adding a real test on top of a stub is the expected workflow — don't delete the stub block, just convert items to real `it(...)` calls.

## Conventions worth not relearning

- `backend/.env` and `frontend/.env` are gitignored. Copy from the matching `.env.example` after cloning. Backend env vars are exposed through `backend/config/env.js` — read from there, not `process.env` directly, so defaults are consistent. Required to fill in: `JWT_SECRET` (auth signs/verifies fail otherwise) and `VITE_API_BASE_URL` (axios `baseURL` has no fallback — every API call breaks if unset). OAuth client IDs are only needed if you're exercising the login flow.
- Backend filenames: PascalCase for models (`Listing.js`), camelCase for everything else (`listingService.js`, `listingController.js`).
- Frontend filenames: PascalCase for components and pages (`ListingCard.tsx`), camelCase for non-component modules (`client.ts`, `listings.ts`).
- The hardcoded default-image URL on `Listing` lives in `backend/models/Listing.js` and is also exported as `Listing.DEFAULT_IMAGE` for tests.
- Vitest 2.x throws if you `require('vitest')` from a CJS test file — backend tests rely on `globals: true` and use bare `describe` / `it` / `expect`.
- Frontend Vitest config lives in `frontend/vitest.config.ts`, not in a `test` block inside `vite.config.ts` — the block in `vite.config.ts` is silently ignored when you run `vitest`.
- `frontend/tsconfig.node.json` is a composite reference, so it sets `emitDeclarationOnly: true` + `outDir` instead of `noEmit: true` (the latter breaks `tsc -b`).
- Seed data in `backend/init/data.js` stores `image` as `{ filename, url }` but the Listing schema stores `image: String`. `backend/init/index.js` flattens `.url` before insert — don't re-add the object shape without also widening the schema.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every PR: `npm ci` → `npm run lint` → `npm run format:check` → `npm run test:backend` → `npm run test:frontend` → `npm run build`. All six must pass. `mongodb-memory-server` downloads a Mongo binary on first CI run (~30s); subsequent runs hit the Actions cache.
