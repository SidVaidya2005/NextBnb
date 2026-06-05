# CLAUDE.md (frontend)

Vite + React 18 + TypeScript + Tailwind v3 + Axios + React Query + React Router.

## Auth + data layer

- All HTTP goes through `src/api/client.ts` (axios instance with a JWT interceptor that reads `localStorage[TOKEN_KEY]`).
- `VITE_API_BASE_URL` **must** be set in `frontend/.env` — `client.ts` reads it with no fallback. Without it, every API call hits a relative URL and silently breaks in dev.
- `useAuth()` from `src/context/AuthContext.tsx` is the single source of truth for `{ user, token, isAuthenticated, login, logout }`. **Never** touch `localStorage` for auth directly in components — go through `useAuth`.
- API modules are grouped per resource (`api/listings.ts`, `api/auth.ts`, `api/uploads.ts`, etc.). Add new endpoints to the matching file, don't create new ones. `api/uploads.ts` posts a `File` as `multipart/form-data` (field `image`) and returns `{ url, publicId }`; `ListingForm`'s file picker calls it and writes the URL into the controlled image field.
- OAuth landing route is built: the backend redirects to `${FRONTEND_URL}/oauth?token=...` after Google login, and `pages/OAuthCallback.tsx` (routed at `/oauth` in `AppRoutes.tsx`) reads the `token`/`error` query param, calls `useAuth().login(token)`, and bounces home.

## Routes

- `routes/AppRoutes.tsx` splits public vs protected. Protected routes nest under `<ProtectedRoute>`, which renders `null` while a stashed JWT is being verified and `<Navigate to="/login">` when there's no token.

## Layout / components

- Pages compose `Container` + atoms from `components/common` + `components/states` (`EmptyState`, `LoadingState`, `ErrorState`).
- `AppShell` wraps everything from `App.tsx`. It composes `Header` + `<main>` + `Footer` — there is no SubNav row.
- **Design system: `tailwind.config.ts` + `src/index.css` are the source of truth.** Airbnb-style: Rausch (#ff385c) accent, white canvas, Inter via Google Fonts (loaded in `index.html`). Tailwind tokens live in `tailwind.config.ts` (`rausch`/`ink`/`surface`/`hairline` color families, `xxs`–`section` spacing scale, `sm`/`md`/`xl`/`full` radii, single `shadow-card` tier). Typography is utility classes in `src/index.css` — `.t-display-xl` / `.t-display-lg` / `.t-display-md` / `.t-title-md` / `.t-body-md` / `.t-body-sm` / `.t-caption` / `.t-uppercase-tag` / `.t-rating-display` etc. — not arbitrary `text-[Npx]` values. Modify the class definitions in `index.css` if a weight or size needs tuning.
- `Container` exposes `width="wide"` (1280px, default — browse pages) and `width="narrow"` (1080px — listing detail).
- Signature pieces still visual-only: `GuestFavoriteBadge`. `SearchBarPill` is a full search popover (composes `DateRangeCalendar` / `DestinationPicker` / `GuestSelector`) that navigates to `/listings?where=`; the home `CategoryStrip` filters the grid via `?category=` (multi-tag, server-backed by `Listing.categories`). `HeartButton` is wired to the wishlist via `useWishlist`, and `RatingDisplay` is fed real server aggregates.
- Shared data hooks live in `src/hooks/` (e.g. `useWishlist.ts` — the wishlist React Query cache behind `HeartButton`). Reuse/extend these rather than re-querying in components.
- `src/components/listings/listingMeta.ts` exposes `deriveListingMeta(listing)`. Ratings are now real: `listing.rating` / `listing.reviewCount` are server-populated by `reviewService` and read directly by `ListingCard` / `ListingShow` (with a "New" state when `reviewCount === 0`). `deriveListingMeta` is retained only for the decorative `isGuestFavorite` shown on `ListingCard`. The same module's `handleListingImageError` swaps a broken image `src` to a unique, always-loading picsum fallback — wire it into any new `<img>` that renders `listing.image`.

## Tests

- Config lives in `vitest.config.ts`, **not** in `vite.config.ts`'s `test` block (the block is silently ignored when running `vitest`).
- `happy-dom` environment, not `jsdom`. Node 22+ ships an experimental `globalThis.localStorage` that masks the DOM one — `src/test/setup.ts` installs a `MemoryStorage` shim to fix it. Don't remove the shim.
- Render through `MemoryRouter` + `QueryClientProvider` + `AuthProvider` (see `App.test.tsx` for the harness shape).
- Header has two links containing "NextBnb": the wordmark (`aria-label="NextBnb"`) and the "NextBnb your home" host CTA. Tests querying the brand must use exact `getByRole('link', { name: 'NextBnb' })`, not a `/nextbnb/i` regex (it matches both).

## Build

- `npm run build` runs `tsc -b && vite build`. `tsconfig.node.json` is a composite project, so it uses `emitDeclarationOnly: true` + `outDir`, not `noEmit: true`.
