# CLAUDE.md (backend)

Express REST API. JSON only — no EJS, no redirects (except the OAuth callback).

## Layered flow

- `routes/` are thin: URL → controller method, attach `requireAuth` where needed.
- `controllers/` read `req.body` / `req.params`, call a service, send JSON. Always wrapped in `utils/asyncHandler`.
- `services/` are the _only_ place that touches Mongoose. Throw `new ApiError(404, ...)` on null lookups — never silently return 200.
- `models/` use PascalCase filenames (`Listing.js`).

## Rules

- Request bodies are **flat**: `{ title, price }`, not `{ listing: { ... } }`. The old EJS form convention is gone.
- Read env via `config/env.js`, not `process.env` directly.
- `JWT_SECRET` must be set in `backend/.env` — `signToken` / `verifyToken` silently produce unverifiable tokens otherwise. OAuth provider IDs (`GOOGLE_*`) are only needed if you're exercising the login flow.
- No `express-async-errors`, no `express-session`. Passport runs with `{ session: false }`.
- 501-returning controllers (bookings, wishlist, reviews, uploads) are scaffold placeholders — fill them in, don't add new directories.

## Tests

- CJS test files **do not** `require('vitest')`. Rely on `globals: true` in `vitest.config.js`; just use `describe` / `it` / `expect` bare.
- Unit tests are co-located: `services/foo.test.js`. HTTP-level tests live in `__tests__/integration/` and use `supertest(app)` — `app`, not `server` (no port binding in tests).
- `test-setup.js` boots `mongodb-memory-server` (downloads a ~30MB Mongo binary on first run, cached afterwards). No local MongoDB needed for tests.
