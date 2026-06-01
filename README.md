# NextBnb

Full-stack Airbnb-style listings app built as an npm workspaces monorepo. The backend is an Express REST API backed by MongoDB; the frontend is React 18 + TypeScript + Tailwind v3.

Listings CRUD is fully implemented. Bookings, wishlist, reviews, and image upload have route/controller/service skeletons in place but return 501 until wired up.

## Prerequisites

- Node.js 18+
- MongoDB running locally at `mongodb://127.0.0.1:27017` (only needed for `npm run dev` and `npm run seed` — tests use an in-memory MongoDB)

## Installation

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Two env variables are required before anything works:

- `JWT_SECRET` in `backend/.env` — token signing and verification fail without it
- `VITE_API_BASE_URL` in `frontend/.env` — the API client has no fallback; every API call breaks if this is unset

## Development

```bash
npm run dev           # frontend (:5173) + backend (:8080) concurrently
npm run dev:backend
npm run dev:frontend
npm run seed          # drops the listings collection and re-seeds from init/data.js
```

## Project structure

```
NextBnb/
├── backend/                  # Express REST API (JSON only)
│   ├── config/               # db connection, env, Passport setup
│   ├── controllers/          # read req, call service, send JSON
│   ├── middleware/           # auth (requireAuth), error handler, upload
│   ├── models/               # Mongoose schemas (PascalCase filenames)
│   ├── routes/               # /api/* and /auth/* routers
│   ├── services/             # all Mongoose calls live here; throw ApiError on null
│   ├── utils/                # ApiError, asyncHandler, logger
│   ├── init/                 # seed data (data.js) and seed script (index.js)
│   ├── app.js                # Express app setup
│   └── server.js             # entrypoint
└── frontend/                 # Vite + React 18 + TypeScript + Tailwind v3
    └── src/
        ├── api/              # typed Axios + React Query layer, one file per resource
        ├── components/       # layout/, listings/, search/, auth/, states/, common/
        ├── context/          # AuthContext — JWT in localStorage, useAuth() hook
        ├── lib/              # listingMeta helper for deterministic display data
        ├── pages/            # route-level components
        ├── routes/           # AppRoutes.tsx (public + protected splits)
        └── types/            # shared TypeScript interfaces
```

## Configuration

**`backend/.env`**

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/wanderlust
JWT_SECRET=                            # required
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=                      # optional — OAuth only
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
GITHUB_CLIENT_ID=                      # optional — OAuth only
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8080/auth/github/callback
CLOUDINARY_CLOUD_NAME=                 # optional — image uploads only
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**`frontend/.env`**

```env
VITE_API_BASE_URL=http://localhost:8080
```

## API

### Listings (implemented)

| Method   | Path                | Auth       | Description           |
| -------- | ------------------- | ---------- | --------------------- |
| `GET`    | `/api/listings`     | —          | Return all listings   |
| `POST`   | `/api/listings`     | Bearer JWT | Create a listing      |
| `GET`    | `/api/listings/:id` | —          | Return one listing    |
| `PUT`    | `/api/listings/:id` | Bearer JWT | Update listing fields |
| `DELETE` | `/api/listings/:id` | Bearer JWT | Delete a listing      |

Request body shape: `{ title, description, image, price, location, country }` (flat JSON).

`GET /health` returns `{ "status": "ok" }`.

### Scaffolded (return 501)

`/api/bookings`, `/api/wishlist`, `/api/reviews`, `/api/uploads`, `/api/users`

### OAuth (Google)

Authentication is OAuth-only — there is no email/password login. `GET /auth/google` runs through Passport with a CSRF `state` cookie and issues a JWT on success, redirecting to `${FRONTEND_URL}/oauth?token=<jwt>`. The frontend `/oauth` route hands the token to `useAuth().login()`, completing the flow end-to-end. `GET /auth/me` returns the current user; `POST /auth/logout` is a stateless 204. A GitHub strategy (`/auth/github`) is wired in the backend but not exposed in the UI.

## Tests, lint, and formatting

```bash
npm test                  # runs backend then frontend test suites
npm run test:backend      # Vitest + supertest, in-memory MongoDB (no local Mongo needed)
npm run test:frontend     # Vitest + Testing Library + happy-dom
npm run lint              # ESLint across both workspaces
npm run format            # Prettier --write
npm run format:check
npm run build             # tsc -b && vite build
```

## License

MIT — see [LICENSE](./LICENSE).
