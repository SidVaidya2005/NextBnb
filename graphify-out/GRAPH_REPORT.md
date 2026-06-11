# Graph Report - .  (2026-06-11)

## Corpus Check
- 133 files · ~168,083 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 742 nodes · 1123 edges · 51 communities (43 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.89)
- Token cost: 63,263 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend API Client & Listings|Frontend API Client & Listings]]
- [[_COMMUNITY_Bookings & Reviews Frontend|Bookings & Reviews Frontend]]
- [[_COMMUNITY_Image Upload & Cloudinary Service|Image Upload & Cloudinary Service]]
- [[_COMMUNITY_Frontend Dependencies & Tooling|Frontend Dependencies & Tooling]]
- [[_COMMUNITY_Mongoose Data Models|Mongoose Data Models]]
- [[_COMMUNITY_Backend Dependencies|Backend Dependencies]]
- [[_COMMUNITY_Auth Buttons & Icon Library|Auth Buttons & Icon Library]]
- [[_COMMUNITY_Wishlist & Listing Cards|Wishlist & Listing Cards]]
- [[_COMMUNITY_Booking & Listing Controllers|Booking & Listing Controllers]]
- [[_COMMUNITY_Monorepo Root Scripts & Config|Monorepo Root Scripts & Config]]
- [[_COMMUNITY_Home Page UI Components|Home Page UI Components]]
- [[_COMMUNITY_Wishlist Backend|Wishlist Backend]]
- [[_COMMUNITY_Frontend TypeScript Config|Frontend TypeScript Config]]
- [[_COMMUNITY_Express App & Middleware|Express App & Middleware]]
- [[_COMMUNITY_Seed Data & Init|Seed Data & Init]]
- [[_COMMUNITY_Server Bootstrap & Config|Server Bootstrap & Config]]
- [[_COMMUNITY_Architecture Concepts (README)|Architecture Concepts (README)]]
- [[_COMMUNITY_Listings & Uploads Integration Tests|Listings & Uploads Integration Tests]]
- [[_COMMUNITY_TS Node Build Config|TS Node Build Config]]
- [[_COMMUNITY_Upload Middleware & Routes|Upload Middleware & Routes]]
- [[_COMMUNITY_User Model & Auth Service|User Model & Auth Service]]
- [[_COMMUNITY_Auth Controller|Auth Controller]]
- [[_COMMUNITY_API Route Index|API Route Index]]
- [[_COMMUNITY_Bookings Integration Test|Bookings Integration Test]]
- [[_COMMUNITY_Auth Middleware (JWTOAuth state)|Auth Middleware (JWT/OAuth state)]]
- [[_COMMUNITY_Auth Routes|Auth Routes]]
- [[_COMMUNITY_E2E Backend Server|E2E Backend Server]]
- [[_COMMUNITY_Frontend Test Setup (localStorage shim)|Frontend Test Setup (localStorage shim)]]
- [[_COMMUNITY_Auth Integration Test|Auth Integration Test]]
- [[_COMMUNITY_Passport Google Strategy|Passport Google Strategy]]
- [[_COMMUNITY_Playwright E2E Config|Playwright E2E Config]]
- [[_COMMUNITY_Booking Routes|Booking Routes]]
- [[_COMMUNITY_Listing Routes|Listing Routes]]
- [[_COMMUNITY_Review Routes|Review Routes]]
- [[_COMMUNITY_Wishlist Routes|Wishlist Routes]]
- [[_COMMUNITY_CIE2E Quality Gates|CI/E2E Quality Gates]]
- [[_COMMUNITY_Backend ESLint Config|Backend ESLint Config]]
- [[_COMMUNITY_Backend Test Setup|Backend Test Setup]]
- [[_COMMUNITY_Backend Contracts & Layering|Backend Contracts & Layering]]
- [[_COMMUNITY_NoSQL Injection Defense & CodeQL|NoSQL Injection Defense & CodeQL]]
- [[_COMMUNITY_Design System & SPA Entry|Design System & SPA Entry]]
- [[_COMMUNITY_Claude Settings Permissions|Claude Settings Permissions]]
- [[_COMMUNITY_Vite Env Types|Vite Env Types]]
- [[_COMMUNITY_Backend Vitest Config|Backend Vitest Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_useWishlist Hook|useWishlist Hook]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `Listing` - 15 edges
3. `useAuth()` - 13 edges
4. `scripts` - 13 edges
5. `scripts` - 11 edges
6. `scripts` - 11 edges
7. `Container()` - 11 edges
8. `compilerOptions` - 11 edges
9. `signToken()` - 10 edges
10. `requireAuth()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `CodeQL NoSQL Injection Security Check` --conceptually_related_to--> `Mongo Query Param Coercion (NoSQL injection defense)`  [INFERRED]
  .github/workflows/codeql.yml → backend/CLAUDE.md
- `Google OAuth + Stateless JWT Auth Flow` --conceptually_related_to--> `AuthContext Single Source of Truth`  [INFERRED]
  README.md → frontend/CLAUDE.md
- `Google OAuth + Stateless JWT Auth Flow` --conceptually_related_to--> `OAuth Callback Landing Route (/oauth)`  [INFERRED]
  README.md → frontend/CLAUDE.md
- `Paginated Listings Page Envelope` --shares_data_with--> `Axios Client with JWT Interceptor`  [INFERRED]
  README.md → frontend/CLAUDE.md
- `Review-Driven Rating Recompute` --conceptually_related_to--> `Denormalized rating/reviewCount Aggregates`  [INFERRED]
  README.md → backend/CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three CI Quality Gate Workflows** — workflows_ci_pipeline, workflows_codeql_analysis, workflows_e2e_pipeline [EXTRACTED 0.90]
- **Frontend Auth Flow (client + context + protected routes + callback)** — claude_frontend_axios_jwt_client, claude_frontend_authcontext_source_of_truth, claude_frontend_protected_route_split, claude_frontend_oauth_callback_landing [INFERRED 0.85]
- **Backend Layer Responsibilities + Contracts** — claude_backend_layered_flow, claude_backend_apierror_contract, claude_backend_flat_json_contract, claude_backend_query_coercion [INFERRED 0.85]

## Communities (51 total, 8 thin omitted)

### Community 0 - "Frontend API Client & Listings"
Cohesion: 0.05
Nodes (57): fetchMe(), apiClient, createListing(), deleteListing(), getListing(), listListings(), listMyListings(), Page (+49 more)

### Community 1 - "Bookings & Reviews Frontend"
Cohesion: 0.06
Nodes (36): cancelBooking(), createBooking(), listMyBookings(), createReview(), deleteReview(), listReviewsForListing(), formatDay(), guestLabel() (+28 more)

### Community 2 - "Image Upload & Cloudinary Service"
Cohesion: 0.06
Nodes (35): ApiError, asyncHandler, cloudinaryService, create, listingService, remove, ApiError, deleteImage() (+27 more)

### Community 3 - "Frontend Dependencies & Tooling"
Cohesion: 0.04
Nodes (45): dependencies, axios, react, react-dom, react-router-dom, @tanstack/react-query, devDependencies, autoprefixer (+37 more)

### Community 4 - "Mongoose Data Models"
Cohesion: 0.06
Nodes (34): bookingSchema, mongoose, Listing, listingSchema, mongoose, mongoose, reviewSchema, ApiError (+26 more)

### Community 5 - "Backend Dependencies"
Cohesion: 0.05
Nodes (41): dependencies, cloudinary, cookie-parser, cors, dotenv, express, express-rate-limit, helmet (+33 more)

### Community 6 - "Auth Buttons & Icon Library"
Cohesion: 0.10
Nodes (22): googleLoginUrl(), GoogleLoginButton(), Globe(), Hamburger(), HeartOutline(), IconProps, LaurelLeft(), LaurelRight() (+14 more)

### Community 7 - "Wishlist & Listing Cards"
Cohesion: 0.16
Nodes (17): addToWishlist(), getWishlist(), removeFromWishlist(), HeartFilled(), useWishlist(), WISHLIST_KEY, GuestFavoriteBadge(), HeartButton() (+9 more)

### Community 8 - "Booking & Listing Controllers"
Cohesion: 0.08
Nodes (21): asyncHandler, bookingService, create, index, remove, show, update, asyncHandler (+13 more)

### Community 9 - "Monorepo Root Scripts & Config"
Cohesion: 0.08
Nodes (23): devDependencies, concurrently, @playwright/test, prettier, name, overrides, vite, private (+15 more)

### Community 10 - "Home Page UI Components"
Cohesion: 0.10
Nodes (23): Airbnb-style Design Language, NextBnb Brand Logo (Rausch accent), Category Strip, Category Tag (Villas, Beachfront, etc.), Date Picker (Add dates), Destination Picker (Search destinations), Google Sign-in Button, Guest Favorite Badge (+15 more)

### Community 11 - "Wishlist Backend"
Cohesion: 0.10
Nodes (12): add, asyncHandler, index, remove, wishlistService, mongoose, wishlistSchema, Listing (+4 more)

### Community 12 - "Frontend TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+11 more)

### Community 13 - "Express App & Middleware"
Cohesion: 0.12
Nodes (16): apiLimiter, app, cookieParser, cors, env, express, helmet, morgan (+8 more)

### Community 14 - "Seed Data & Init"
Cohesion: 0.12
Nodes (14): ADJECTIVES, CITIES, DESCRIPTIONS, IMAGES, sampleListings, TYPES, env, initData (+6 more)

### Community 15 - "Server Bootstrap & Config"
Cohesion: 0.18
Nodes (10): app, { connectDB }, env, logger, start(), connectDB(), env, mongoose (+2 more)

### Community 16 - "Architecture Concepts (README)"
Cohesion: 0.15
Nodes (14): Denormalized rating/reviewCount Aggregates, Image Upload Pipeline (multer to cloudinaryService), AuthContext Single Source of Truth, Axios Client with JWT Interceptor, OAuth Callback Landing Route (/oauth), Public vs Protected Route Split, Booking Overlap Detection (409 on date clash), Cloudinary Image Upload (501 when unconfigured) (+6 more)

### Community 17 - "Listings & Uploads Integration Tests"
Cohesion: 0.16
Nodes (12): app, Listing, makeUser(), request, { signToken }, User, app, makeUser() (+4 more)

### Community 18 - "TS Node Build Config"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, composite, emitDeclarationOnly, module, moduleResolution, noEmit, outDir (+4 more)

### Community 19 - "Upload Middleware & Routes"
Cohesion: 0.18
Nodes (10): ALLOWED_MIME, ApiError, multer, upload, uploadSingle, express, { requireAuth }, router (+2 more)

### Community 20 - "User Model & Auth Service"
Cohesion: 0.22
Nodes (8): mongoose, userSchema, env, jwt, { signToken, verifyToken, upsertOAuthUser }, User, upsertOAuthUser(), User

### Community 21 - "Auth Controller"
Cohesion: 0.22
Nodes (8): ApiError, asyncHandler, env, logout, me, oauthCallback, { signToken }, User

### Community 22 - "API Route Index"
Cohesion: 0.22
Nodes (8): authRoutes, bookingRoutes, express, listingRoutes, reviewRoutes, router, uploadRoutes, wishlistRoutes

### Community 23 - "Bookings Integration Test"
Cohesion: 0.25
Nodes (6): app, Listing, makeUser(), request, { signToken }, User

### Community 24 - "Auth Middleware (JWT/OAuth state)"
Cohesion: 0.29
Nodes (7): ApiError, crypto, env, requireAuth(), verifyOAuthState(), { verifyToken }, verifyToken()

### Community 25 - "Auth Routes"
Cohesion: 0.25
Nodes (7): issueOAuthState(), authController, env, express, passport, {
  requireAuth,
  issueOAuthState,
  verifyOAuthState,
}, router

### Community 26 - "E2E Backend Server"
Cohesion: 0.25
Nodes (6): BACKEND, { MongoMemoryServer }, mongoose, path, PORT, SEED_COUNT

### Community 28 - "Auth Integration Test"
Cohesion: 0.33
Nodes (5): app, env, request, { signToken }, User

### Community 29 - "Passport Google Strategy"
Cohesion: 0.40
Nodes (4): env, passport, { Strategy: GoogleStrategy }, { upsertOAuthUser }

### Community 31 - "Booking Routes"
Cohesion: 0.40
Nodes (4): bookingController, express, { requireAuth }, router

### Community 32 - "Listing Routes"
Cohesion: 0.40
Nodes (4): express, listingController, { requireAuth }, router

### Community 33 - "Review Routes"
Cohesion: 0.40
Nodes (4): express, { requireAuth }, reviewController, router

### Community 34 - "Wishlist Routes"
Cohesion: 0.40
Nodes (4): express, { requireAuth }, router, wishlistController

### Community 35 - "CI/E2E Quality Gates"
Cohesion: 0.40
Nodes (5): CI Lint + Format + Test + Build Gate, mongodb-memory-server Binary Cache, CI Workflow, E2E Workflow, Playwright Chromium Smoke Flow

### Community 36 - "Backend ESLint Config"
Cohesion: 0.50
Nodes (3): globals, js, prettier

### Community 38 - "Backend Contracts & Layering"
Cohesion: 0.67
Nodes (3): ApiError Throw-on-Null Contract, Flat JSON-Only Request/Response Contract, Backend Layered Flow (routes/controllers/services/models)

### Community 39 - "NoSQL Injection Defense & CodeQL"
Cohesion: 0.67
Nodes (3): Mongo Query Param Coercion (NoSQL injection defense), CodeQL Advanced Workflow, CodeQL NoSQL Injection Security Check

### Community 40 - "Design System & SPA Entry"
Cohesion: 0.67
Nodes (3): Airbnb-Style Design System (Rausch/Inter tokens), Inter Google Fonts Preconnect/Stylesheet, SPA Root Mount + main.tsx Entry

## Knowledge Gaps
- **386 isolated node(s):** `allow`, `request`, `app`, `env`, `User` (+381 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Listing` connect `Wishlist & Listing Cards` to `Frontend API Client & Listings`, `Bookings & Reviews Frontend`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `signToken()` connect `Listings & Uploads Integration Tests` to `User Model & Auth Service`, `Auth Integration Test`, `Auth Controller`, `Bookings Integration Test`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `allow`, `request`, `app` to the rest of the system?**
  _392 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend API Client & Listings` be split into smaller, more focused modules?**
  _Cohesion score 0.05351170568561873 - nodes in this community are weakly interconnected._
- **Should `Bookings & Reviews Frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Should `Image Upload & Cloudinary Service` be split into smaller, more focused modules?**
  _Cohesion score 0.05990338164251208 - nodes in this community are weakly interconnected._
- **Should `Frontend Dependencies & Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._