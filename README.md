# NextBnb

Full-stack Airbnb-style listings app built as an npm workspaces monorepo. The backend is a JSON-only Express REST API backed by MongoDB; the frontend is React 18 + TypeScript + Tailwind v3. Authentication is Google OAuth, which issues a stateless JWT.

Listings, bookings, wishlist, reviews, image upload, and Google login are implemented end to end. Image upload requires Cloudinary credentials; without them the upload routes return `501 Not Implemented`.

## Features

- Listings CRUD with owner-scoped edit/delete and a text search across title, location, and country (`?where=`)
- Google OAuth login via Passport, with a CSRF `state` check and a 7-day JWT
- Bookings with check-in/check-out validation and overlap detection (returns `409` on a date clash)
- Wishlist for saving and removing listings, with an optimistic React Query cache
- Reviews that recompute a listing's average rating and review count on every write
- Image upload to Cloudinary (multipart, image-only, 5 MB cap) wired into the listing form; returns `501` until Cloudinary credentials are set

## Prerequisites

- Node.js 18+
- MongoDB running locally at `mongodb://127.0.0.1:27017` — only needed for `npm run dev` and `npm run seed`. Tests use an in-memory MongoDB and need no local instance.

## Installation

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`npm install` at the root installs both workspaces from the shared lockfile.

Two variables must be set before anything works:

- `JWT_SECRET` in `backend/.env` — token signing and verification fail without it (the backend refuses to boot outside test mode if it's missing)
- `VITE_API_BASE_URL` in `frontend/.env` — the Axios client reads it with no fallback, so every API call breaks if it's unset

Google OAuth and Cloudinary credentials are optional and only needed if you exercise those flows.

## Development

```bash
npm run dev           # frontend (:5173) + backend (:8080) concurrently
npm run dev:backend
npm run dev:frontend
npm run seed          # drops the listings collection and re-seeds from backend/init/data.js
```

`npm run seed` is destructive: it wipes the listings collection before re-inserting.

## Configuration

Both `.env` files are gitignored. Backend variables are read through `backend/config/env.js`, which supplies the defaults shown below.

`backend/.env`:

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/nextbnb
JWT_SECRET=                            # required
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=                      # optional — Google login only
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
CLOUDINARY_CLOUD_NAME=                 # optional — image uploads only
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## Project structure

```
NextBnb/
├── backend/                  # Express REST API (JSON only)
│   ├── config/               # db connection, env, Passport setup
│   ├── controllers/          # read req, call a service, send JSON
│   ├── middleware/           # auth (requireAuth, OAuth state), error handler
│   ├── models/               # Mongoose schemas (PascalCase filenames)
│   ├── routes/               # /api/* and /auth/* routers
│   ├── services/             # all Mongoose calls; throw ApiError on null lookups
│   ├── utils/                # ApiError, asyncHandler, logger
│   ├── init/                 # seed data (data.js) and seed script (index.js)
│   ├── app.js                # Express app setup
│   └── server.js             # entrypoint
└── frontend/                 # Vite + React 18 + TypeScript + Tailwind v3
    └── src/
        ├── api/              # typed Axios layer, one file per resource
        ├── components/       # layout/, listings/, search/, auth/, states/, common/
        ├── context/          # AuthContext — JWT in localStorage, useAuth() hook
        ├── hooks/            # shared React Query hooks (e.g. useWishlist)
        ├── pages/            # route-level components
        ├── routes/           # AppRoutes.tsx (public + protected splits)
        └── types/            # shared TypeScript interfaces
```

The backend is layered: routes map URLs to controllers, controllers call services, and services are the only layer that touches Mongoose. A service throws `ApiError(404, ...)` on a missing record rather than returning an empty `200`, and `middleware/error.js` translates those into JSON responses with the right status.

## API

Request and response bodies are flat JSON. Protected routes expect an `Authorization: Bearer <jwt>` header.

### Auth (`/auth`)

| Method | Path                    | Auth | Description                                                                |
| ------ | ----------------------- | ---- | -------------------------------------------------------------------------- |
| `GET`  | `/auth/google`          | —    | Start Google OAuth (sets a CSRF `state` cookie)                            |
| `GET`  | `/auth/google/callback` | —    | Verify `state`, issue a JWT, redirect to `${FRONTEND_URL}/oauth?token=...` |
| `GET`  | `/auth/me`              | JWT  | Return the current user                                                    |
| `POST` | `/auth/logout`          | —    | Stateless `204`                                                            |

### Listings (`/api/listings`)

| Method   | Path                 | Auth | Description                                                                                 |
| -------- | -------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `GET`    | `/api/listings`      | —    | Paginated list; `?where=` filters title/location/country, `?category=`, `?page=`, `?limit=` |
| `GET`    | `/api/listings/mine` | JWT  | The caller's own listings (newest first)                                                    |
| `POST`   | `/api/listings`      | JWT  | Create a listing (caller becomes the owner)                                                 |
| `GET`    | `/api/listings/:id`  | —    | Return one listing                                                                          |
| `PUT`    | `/api/listings/:id`  | JWT  | Update a listing (owner only)                                                               |
| `DELETE` | `/api/listings/:id`  | JWT  | Delete a listing (owner only)                                                               |

`GET /api/listings` returns a page envelope: `{ items, total, page, pageSize, totalPages }` (default `pageSize` 12, max 50). Body for create/update: `{ title, description, image, price, location, country }`.

### Bookings (`/api/bookings`)

| Method   | Path                | Auth | Description                                         |
| -------- | ------------------- | ---- | --------------------------------------------------- |
| `GET`    | `/api/bookings`     | JWT  | List the caller's bookings (listing populated)      |
| `POST`   | `/api/bookings`     | JWT  | Create a booking; rejects past or overlapping dates |
| `GET`    | `/api/bookings/:id` | JWT  | Return one booking (owner only)                     |
| `PUT`    | `/api/bookings/:id` | JWT  | Update booking status (owner only)                  |
| `DELETE` | `/api/bookings/:id` | JWT  | Cancel a booking — sets status to `cancelled`       |

Body: `{ listingId, checkIn, checkOut, guests: { adults, children, infants, pets } }`.

### Wishlist (`/api/wishlist`)

| Method   | Path                       | Auth | Description                        |
| -------- | -------------------------- | ---- | ---------------------------------- |
| `GET`    | `/api/wishlist`            | JWT  | Return the caller's saved listings |
| `POST`   | `/api/wishlist/:listingId` | JWT  | Save a listing (idempotent)        |
| `DELETE` | `/api/wishlist/:listingId` | JWT  | Remove a listing                   |

### Reviews (`/api/reviews`)

| Method   | Path               | Auth | Description                                          |
| -------- | ------------------ | ---- | ---------------------------------------------------- |
| `GET`    | `/api/reviews`     | —    | List reviews for a listing (`?listingId=`)           |
| `POST`   | `/api/reviews`     | JWT  | Create a review; recomputes the listing's rating     |
| `GET`    | `/api/reviews/:id` | —    | Return one review                                    |
| `DELETE` | `/api/reviews/:id` | JWT  | Delete a review (author only); recomputes the rating |

Body: `{ listing, rating, comment }`.

### Uploads (`/api/uploads`)

| Method   | Path                     | Auth | Notes                                                             |
| -------- | ------------------------ | ---- | ----------------------------------------------------------------- |
| `POST`   | `/api/uploads`           | JWT  | `multipart/form-data` with an `image` field → `{ url, publicId }` |
| `DELETE` | `/api/uploads/:publicId` | JWT  | Remove an uploaded image by its Cloudinary `publicId`             |

Images stream to Cloudinary (folder `nextbnb/listings`). Only JPEG/PNG/WebP/GIF up to 5 MB are accepted. When Cloudinary credentials are unset the routes return `501 Not Implemented`.

### Health

`GET /health` returns `{ "status": "ok" }`.

## Tests, lint, and formatting

```bash
npm test                  # backend then frontend suites
npm run test:backend      # Vitest + supertest, in-memory MongoDB (no local Mongo)
npm run test:frontend     # Vitest + Testing Library + happy-dom
npm run test:e2e          # Playwright smoke flow (boots its own backend + frontend)
npm run lint              # ESLint across both workspaces
npm run format            # Prettier --write
npm run format:check
npm run build             # tsc -b && vite build
```

The first backend test run downloads a MongoDB binary for `mongodb-memory-server`; later runs reuse the cache.

`npm run test:e2e` is self-contained: Playwright boots a throwaway backend (in-memory MongoDB seeded with a known user + listings, on `:8090`) and the frontend via Vite in `e2e` mode (`:4321`), then drives a real Chromium browser through browse → paginate → open a listing → view the signed-in profile. Auth is injected as a pre-signed JWT (`e2e/setup/global-setup.ts`), so the Google OAuth flow never runs. Install the browser once with `npx playwright install chromium`.

## License

MIT — see [LICENSE](./LICENSE).
</content>
</invoke>
