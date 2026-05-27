# NextBnB 🏡

NextBnb is a modern full-stack Airbnb clone built with a refreshed UI and improved developer architecture.  
It allows users to browse, create, and manage property listings with authentication, image uploads, booking features, and responsive design.

## 🚀 Features

- 🔐 User Authentication & Authorization
- 🏠 Create, Edit & Delete Listings
- 📸 Image Upload Support
- 📍 Location-based Listings
- 💳 Booking System
- ❤️ Wishlist / Favorites
- 📱 Fully Responsive UI
- 🌙 Airbnb-style design system ([`Design.md`](./Design.md)) — Rausch #ff385c accent, white canvas, Inter typography
- ⚡ Fast Performance

## 🛠 Tech Stack

### Frontend

- React.js
- Tailwind CSS
- Axios
- React Router

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose

### Authentication

- JWT / Session Auth

### Other Tools

- Cloudinary (Image Uploads)
- Map API
- Vercel / Render Deployment

---

## 📂 Project Structure

```bash
NextBnb/
├── frontend/                 # Vite + React + TypeScript + Tailwind
│   └── src/
│       ├── api/              # Axios + React Query data layer
│       ├── components/       # layout, listings, search, auth, states, common
│       ├── context/          # AuthContext + useAuth()
│       ├── lib/              # listingMeta deterministic visual-shell helper
│       ├── pages/            # ListingsIndex, ListingShow, Login, ...
│       ├── routes/AppRoutes  # React Router config (public + protected)
│       └── types/            # shared TS interfaces
├── backend/                  # Express REST API (JSON only)
│   ├── config/               # db, env, passport
│   ├── controllers/          # one per resource
│   ├── middleware/           # auth, error, validate, upload
│   ├── models/               # Mongoose schemas
│   ├── routes/               # /api/* and /auth/* routers
│   ├── services/             # business logic + Mongoose calls
│   ├── utils/                # ApiError, asyncHandler, logger
│   ├── init/                 # seed script
│   ├── app.js                # express setup
│   └── server.js             # entrypoint (connects DB, listens)
├── .github/workflows/ci.yml  # GitHub Actions (lint, format, test, build)
├── .prettierrc               # shared Prettier config
├── package.json              # npm workspaces root
└── README.md
```

This is an npm workspaces monorepo: a single `npm install` at the root installs both `frontend/` and `backend/`.

---

## ⚙️ Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/nextbnb.git
cd nextbnb
```

### Install dependencies (installs both workspaces)

```bash
npm install
```

### Setup environment variables

Create `backend/.env` (copy from `backend/.env.example`):

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/wanderlust
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

And `frontend/.env` (copy from `frontend/.env.example`):

```env
VITE_API_BASE_URL=http://localhost:8080
```

### Run the development servers

```bash
# Both frontend (http://localhost:5173) and backend (http://localhost:8080) together:
npm run dev

# Or individually:
npm run dev:backend
npm run dev:frontend

# Seed the database (drops + repopulates listings):
npm run seed
```

### Tests, lint, format

```bash
npm test            # runs backend (Vitest + supertest + in-memory Mongo) then frontend (Vitest + RTL)
npm run lint        # ESLint across both workspaces
npm run format      # Prettier writes
npm run format:check
```

---

## 🌐 Deployment

Frontend deployed on:

- Vercel

Backend deployed on:

- Render / Railway

Database:

- MongoDB Atlas

---

## 📸 Screenshots

Add your project screenshots here.

---

## 🎯 Future Improvements

- Real-time messaging
- Payment integration
- Advanced search filters
- Admin dashboard
- Reviews & Ratings

---

## 🤝 Contributing

Contributions are welcome!

Fork the repository and create a pull request.

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Built with ❤️ by Your Name

---

## 📌 Current Implementation Status

The sections above describe the **target product**. The codebase has now been restructured into a `frontend/` + `backend/` monorepo with full file skeletons for every roadmap feature. Listings CRUD is real; the rest is scaffolded but not implemented (`[~] scaffolded`).

### ✅ Fully implemented

- **npm workspaces** monorepo (`frontend/` + `backend/`) with root scripts for dev, test, lint, format, build
- **Backend (Express REST API, JSON only)**:
  - Listings CRUD at `/api/listings` (`GET`/`POST`/`GET :id`/`PUT :id`/`DELETE :id`) with 404 handling via `ApiError`
  - Layered architecture: routes → controllers → services → models
  - `helmet`, `cors`, `morgan`, `cookieParser`, central error middleware
  - `Listing` model preserves the default-image setter quirk
  - `connectDB()` reads `MONGO_URI` from env
  - Seed script (`npm run seed`) drops + reseeds listings from `init/data.js`
- **Frontend (Vite + React 18 + TypeScript + Tailwind v3)**:
  - Real `AppShell` layout (`Header` + `<main>` + `Footer`) styled to the Airbnb-inspired spec in [`Design.md`](./Design.md) — Rausch #ff385c accent, white canvas, Inter via Google Fonts, single `shadow-card` tier
  - Signature components: pill-shaped `SearchBarPill` with circular Rausch search orb, `HeartButton`, `GuestFavoriteBadge`, `RatingDisplay`, `ProductTabs` (Homes / Experiences / Services), `CityLinkGrid` — visual shells without backend wiring
  - React Router with **public** (`/`, `/login`, `/listings`, `/listings/:id`) and **protected** (`/listings/new`, `/listings/:id/edit`, `/profile`, `/bookings`, `/wishlist`) routes gated by `<ProtectedRoute>`
  - Typed Axios layer + React Query for the Listings index/show/edit pages
  - `AuthContext` with `useAuth()`, JWT persisted in `localStorage`
- **Tests**: Vitest on both sides. Backend has unit tests for `listingService` and a supertest integration test against `mongodb-memory-server`. Frontend has an `<App>` smoke test and a `<ProtectedRoute>` redirect test. Stub `it.todo` tests reserve the rest of the surface.
- **Lint + format**: ESLint flat config per workspace, shared Prettier at the root, `eslint-config-prettier` to avoid conflicts.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) runs install → lint → format:check → tests → build on every push and PR.

### 🚧 Scaffolded (skeleton files in place, no logic yet)

- [~] User authentication via OAuth (Passport.js with Google + GitHub strategies, JWT issued back to the client)
- [~] User model + `/auth/google`, `/auth/github`, `/auth/me`, `/auth/logout` routes
- [~] Booking / reservation system (`Booking` model, `/api/bookings` routes, controller + service files)
- [~] Wishlist / favorites (`Wishlist` model, `/api/wishlist` routes)
- [~] Reviews & ratings (`Review` model, `/api/reviews` routes)
- [~] Image upload via Cloudinary (`/api/uploads` routes, upload middleware, cloudinary service)
- [~] Frontend pages for Login / Profile / Bookings / Wishlist (rendered with real layouts and `EmptyState` placeholders; no data wired)

### 🚧 Yet to implement

- [ ] Map API / location-based search
- [ ] Real-time messaging
- [ ] Payment integration
- [ ] Advanced search filters
- [ ] Admin dashboard
- [ ] Pre-commit hooks (Husky / lint-staged)
- [ ] Deployment configuration for Vercel / Render / MongoDB Atlas
- [ ] Docker / containerization
