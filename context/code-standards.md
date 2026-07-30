# Code Standards

> **Role:** The rules every change must follow — language, framework, naming, error handling, dependencies.
> **Read before writing code**; obey on every change.
> **Relates to:** derives from the stack in `architecture.md`.

Implementation rules and conventions for the entire project. The AI agent must
follow these in every session without exception. These rules prevent pattern
drift across sessions.

---

## Engineering Mindset

The AI agent on this project operates as a senior engineer. This means:

- **Think before implementing** — understand what is being built and why before writing a single line
- **Read context files first** — never assume, always verify against `architecture.md` and `project-overview.md`
- **Scope is sacred** — only build what the current feature requires; never go beyond scope even if it seems helpful
- **Every feature must be testable** — if it cannot be verified immediately after implementation, it is incomplete
- **Clean over clever** — simple readable code a junior can follow beats clever abstractions
- **One thing at a time** — complete one feature fully before touching the next
- **Failures are expected** — handle errors deliberately; never let one failure crash everything

---

## TypeScript

- `strict` mode is on. No implicit `any`; if a type is truly unknown, use `unknown` and narrow.
- TypeScript ≥5.1 (Next 16 minimum). Prefer `type` aliases for data shapes; reserve `interface` for extensible object contracts.
- Server-action and query inputs from the client are `unknown` until validated by Zod — never trust their shape.
- Row and enum types come from `src/types/database.types.ts` (generated). Derive with helpers like `type Listing = Database['public']['Tables']['listings']['Row']`; do not re-declare table columns by hand.
- No non-null assertions (`!`) except on **env vars read at a client/SDK construction boundary** — the Supabase client factories (`lib/supabase/*`) and the Cloudinary signing call in `/api/sign-cloudinary`, whose rationale is recorded in `architecture.md` → Key Patterns. Handle `null`/`undefined` explicitly everywhere else.
- Use `async/await`; no floating promises (await or explicitly void them).
- Prefer immutable data — `const`, and don't mutate function parameters or shared arrays/objects.
- Exhaustively handle union/enum branches (e.g. `booking_status`); use a `never` check in the default case where practical.

---

## Next.js (App Router) Conventions

- Components are **Server Components by default**. Add `'use client'` only when the file needs interactivity, browser APIs, state/effects, or realtime subscriptions — keep client components small and at the leaves.
- Data **reads** for a page happen in Server Components via `src/lib/queries/*`; do not fetch in `useEffect` when the data can be rendered on the server.
- Data **writes** happen only through server actions in `src/lib/actions/*` (`'use server'`). Client components call these actions; they never touch Supabase directly.
- After a mutation, call `revalidatePath` (or `revalidateTag`) for every route whose data changed. Never rely on the client to refetch stale data.
- Route files use framework names: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`. Provide `loading.tsx` and `error.tsx` for data-backed routes — **except on a route that can 404** (see below).
- **A route that can `notFound()` must not have a `loading.tsx`.** That file wraps the page in an implicit `<Suspense>`, so the response starts streaming and the HTTP status is committed **before** `notFound()` runs. Next's own docs: *"a 404 HTTP status code for non-streamed responses and a 200 status code for streamed responses"* — the headers are already sent, so the status cannot be updated. A 200 on a missing or unpublished resource means search engines index it and monitoring never sees it. Prefer the correct status; stream only what genuinely cannot 404. (Found in F07: with `loading.tsx`, every draft listing returned 200.)
- Request-level interception lives in `src/proxy.ts` exporting `proxy` — Next 16 renamed the `middleware` convention. The proxy runtime is Node-only (no edge).
- Read search/filter state from `searchParams` (the URL is the source of truth for search); do not mirror it into client state.
- Never import `src/lib/supabase/server.ts`, `next/headers`, or any secret-bearing module into a client component.
- `params`, `searchParams`, `cookies()`, and `headers()` are **async and must be awaited** — Next 16 removed synchronous access.
- **Runtime:** Node.js ≥20.9 (LTS) and TypeScript ≥5.1 (Next 16 minimums). Pin with a `.nvmrc` (`20`) and `"engines": { "node": ">=20.9" }` in `package.json`. Do not use Next 16 Cache Components / `use cache` — authenticated pages read cookies and render dynamically.

---

## Design System & Responsive Standards

The visual language is defined by `context/DESIGN.md` (Airbnb-style). Tokens are
encoded once in the Tailwind v4 `@theme` block of `src/app/globals.css` and used
via utilities — never hardcode a hex, size, or radius that a token already covers.

**Applying DESIGN.md to NextBnb.** DESIGN.md is an analysis of Airbnb's live site, so
it contains Airbnb-specific structure that NextBnb does **not** build. Take the
*visual language*, not the literal product:

- **USE:** the color tokens, type scale, radii, spacing, elevation (one shadow tier), and the component specs — `button-primary`, `search-bar-pill`, `search-orb`, `property-card`, `reservation-card`, `text-input`, `date-picker-day`, `amenity-row`, `host-card`, `footer-light`, and the responsive breakpoints/behaviors.
- **IGNORE (Airbnb-only, out of scope):** the three-product nav (Homes / Experiences / Services) — NextBnb has one product, stays; the **Airbnb wordmark and any "Airbnb" name/branding** (use "NextBnb"); the **"© Airbnb, Inc." legal copy** and legal-link blue band; the **Luxe (`#460479`) / Plus (`#92174d`) sub-brand colors**; and the **Mapbox map view** (maps are out of scope).
- The top nav is a single-product marketplace bar (logo "NextBnb" + search + account menu), not a product-tab switcher. Never render Experiences/Services tabs or Airbnb branding.

- **Color:** white canvas (`#ffffff`), ink text (`#222222`), body `#3f3f3f`, muted `#6a6a6a`, hairline `#dddddd`. The **only** accent is Rausch `#ff385c` (`primary`), reserved for primary CTAs, the search orb, and the saved-heart state — used scarcely. Errors use `#c13515`. No off-palette colors.
- **Type:** ship **Inter** via `next/font/google` (the Cereal VF substitute named in DESIGN.md), mapped to the DESIGN.md scale. Display headlines stay modest (22–28px, weight 500–600); the one loud moment is the 64px rating number. Body is 16px/400.
- **Radii:** buttons/inputs `8px` (`sm`), cards `14px` (`md`), search bar / hearts / orbs fully pill (`full`). No hard corners on interactive elements.
- **Spacing:** 4px base scale; major sections `64px`, card padding `24px`, card-grid gutters `16px`.
- **Elevation:** one shadow tier only (the DESIGN.md card-hover/dropdown shadow); everything else is flat. Depth comes from photography and hairlines, not stacked shadows.
- Build components in `src/components/ui/` to the DESIGN.md component specs (`button-primary`, `search-bar-pill`, `property-card`, `reservation-card`, `text-input`, etc.); feature components compose these.

**Responsive is mandatory and mobile-first.** Every screen must be verified at all four DESIGN.md breakpoints — phone, iPad, laptop, desktop. Define these custom Tailwind breakpoints in `@theme` (they intentionally differ from Tailwind defaults so iPad maps cleanly):

| Screen | Range | Tailwind key | Layout rules |
| ------ | ----- | ------------ | ------------ |
| Mobile | `<744px` | (base, no prefix) | 1-up cards; nav → logo + hamburger; search → single pill opening a full-screen overlay; reservation card → sticky bottom bar |
| Tablet / iPad | `744–1128px` | `tablet:` (744px) | 2-up cards; product tabs visible; reservation card stays as a narrower right rail |
| Desktop / laptop | `1128–1440px` | `desktop:` (1128px) | 4-up cards; full search pill with 3 segments; 2-column listing detail with sticky rail |
| Wide | `>1440px` | `wide:` (1440px) | content caps at 1440px (search/listing) / ~1280px (editorial); gutters absorb the rest |

- Grids **drop columns** at each breakpoint — never reflow or reorder rows.
- Touch targets: primary CTAs and the search orb ≥ 48×48px; never ship a tap target below 44px.
- Test the mobile collapse behaviors explicitly (search overlay, sticky reserve bar, hamburger) — they are part of "done", not polish.

### Accessibility rules that have already been broken here twice

- **`aria-label` on a bare `<div>` or `<span>` is announced by nothing.** Those map to
  `role="generic"`, where ARIA *prohibits* an accessible name. If a wrapper needs a name,
  give it a role that accepts one — `role="img"` for a value drawn from icons,
  `role="group"` for a set, or use the real element (`<aside>`, `<section>`, `<ul>`,
  `<nav>`). `<section>`/`<ul>` **do** accept `aria-label`; a bare `div`/`span` does not.
  Found and fixed three times: F12 (`BookingWidget`'s reservation summary), and the
  2026-07-29 audit (`StarRating`, silent on every review; `PhotoGallery`'s strip).
- **Do not gate an accessible name with Playwright's `getByLabel()`.** It matches the
  `aria-label` *attribute*, not the computed accessible name, so it passes against markup
  no screen reader can read — which is exactly how `StarRating` stayed green from F15 to
  F19 while announcing nothing. **Assert `getByRole(role, { name })`**, which resolves the
  real name and fails when the role is wrong.
- **A live region must be in the DOM before it has content.** A polite region mounted
  together with its text often never announces. The always-mounted `sr-only` span with
  changing text (`MessageThread`, `SaveButton`) is the pattern to copy; `role="alert"` on
  a conditionally-rendered error paragraph is the sanctioned exception.
- Decorative icons carry `aria-hidden`; an icon-only control carries `aria-label` on the
  **button**, never on a wrapping div.
- **A skip link's target needs `tabindex="-1"`, or focus never lands on it** — the viewport
  scrolls and the page *looks* like it jumped while nothing is actually focused. Measured in
  F21: with `tabindex` deleted, `document.activeElement` after activating `href="#main"` was
  `BODY`; with `tabindex="-1"` present, it was the target. The rule matters because a screen
  reader announces arrival only at a genuinely focused element — that announcement itself is
  unverified (no screen-reader pass has been run; Open work item 1), so this is the standing
  reason for the rule, not an F21 finding. The target is programmatically focusable **only**;
  it is never a Tab stop. Reference: `<main id="main" tabIndex={-1}>` in `src/app/layout.tsx`.
- **For a skip link, assert the target actually received DOM focus —
  `expect(target).toBeFocused()`. Do *not* rely on "the next Tab lands inside the target":
  that passes with or without `tabindex="-1"`,** because Chromium implements the HTML
  Standard's *sequential focus navigation starting point* fixup and moves the Tab **origin**
  to the fragment target whether or not it is focusable. Measured in F21: with `tabindex`
  deleted, `activeElement` after activation was `BODY` while the next Tab still landed on a
  `<summary>` inside the target. Assert the focus, keep the next-Tab check as documentation
  of the user-visible outcome, and know which of the two is load-bearing.

---

## File and Folder Naming

- Folders: `kebab-case` (`listing-photos/`, `host/`).
- React component files: `PascalCase.tsx`, one primary component per file (`ListingCard.tsx`, `SearchBar.tsx`). The component's name matches the file.
- Non-component modules (queries, actions, validations, utils, hooks): `camelCase.ts` (`bookings.ts`, `useFavorite.ts`, `formatPrice.ts`). Domain modules are named after the domain (`lib/actions/listings.ts`).
- Route segment folders and route files follow Next.js conventions (lowercase, `[id]` for dynamic segments).
- Zod schemas live in `src/lib/validations/<domain>.ts`; export names end in `Schema` (`createListingSchema`).
- No barrel `index.ts` re-export files; import directly from the module.

---

## Module / Component Structure

Canonical ordering for a component file: imports, then types, then the component,
then any small local helpers. Server Component by default.

```tsx
// 1. External imports
import Link from 'next/link'
// 2. Internal imports (via @/ alias)
import { formatPrice } from '@/lib/utils'
import type { Database } from '@/types/database.types'

// 3. Types
type Listing = Database['public']['Tables']['listings']['Row']
type Props = { listing: Listing; coverUrl: string }

// 4. Component (named export, PascalCase)
export function ListingCard({ listing, coverUrl }: Props) {
  return (
    <Link href={`/listings/${listing.id}`}>
      {/* ... */}
      <span>{formatPrice(listing.price_per_night)}</span>
    </Link>
  )
}
```

- One primary export per file; helpers used only by that file stay in that file, below the component.
- Props are a named `Props` type, destructured in the signature.
- No default exports except where a framework requires them (`page.tsx`, `layout.tsx`, `route.ts` handlers). `src/proxy.ts` is a named export (`proxy`), not a default.

---

## Boundary Patterns

Return-shape contract used across all boundaries:

```ts
// src/lib/utils.ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }
```

### Server action (`src/lib/actions/*.ts`)

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { someSchema } from '@/lib/validations/<domain>'
import type { ActionResult } from '@/lib/utils'

export async function doThing(input: unknown): Promise<ActionResult<ResultShape>> {
  const parsed = someSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized.' }

  const { data, error } = await supabase.from('table')./* mutate */.select().single()
  if (error) {
    console.error('[actions/<domain>] doThing failed:', error.message)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/affected-route')
  return { ok: true, data }
}
```

- Always `'use server'`, validate first, authorize with `getUser()`, mutate, revalidate, return `ActionResult` — in that order.
- **Exception — actions whose only outcome is navigation** (`signInWithGoogle`, `signOut`) return `Promise<void>`, not `ActionResult`: `redirect()` signals by throwing `NEXT_REDIRECT`, so nothing after it runs and there is no value to return. Keep the `redirect()` call outside any `try`, and surface failure as a redirect flag the UI renders (`/?signin=error`).
- Never `throw` for expected failures; return `{ ok: false, error }` with a **user-safe** message. Log the real error with the `[actions/<domain>]` prefix.
- Rely on RLS as the authorization backstop; the `getUser()` check is for UX, not the only guard.

### Read query (`src/lib/queries/*.ts`)

```ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type Listing = Database['public']['Tables']['listings']['Row']

export async function getPublishedListings(filters: ListingFilters): Promise<Listing[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('is_published', true)
  if (error) {
    console.error('[queries/listings] getPublishedListings failed:', error.message)
    return []
  }
  return data ?? []
}
```

- Queries are read-only and server-only (`import 'server-only'`); they never mutate.
- On error, log with the `[queries/<domain>]` prefix and return a safe empty value (`[]` / `null`), so a page renders an empty state rather than crashing.

### Route handler (`src/app/**/route.ts`)

- Handlers do HTTP only — the OAuth callback (`/auth/callback`) and the Cloudinary signature route (`/api/sign-cloudinary`). No UI. Keep them thin: verify the user, do the one job (code exchange, or ownership-checked signing), return a `Response`/redirect. Any real mutation belongs in a server action, not a route handler.
- **The one sanctioned read outside `lib/queries/`** is the sign route's ownership check (`.from('listings').select('id').eq('host_id', user.id)`), whose rationale is recorded in `architecture.md` → Key Patterns. It stays inline because it *is* the handler's one job — the authorization decision the signature depends on — and routing it through a query module would put the guard a call away from the thing it guards. Do not read this as licence for other inline reads.

---

## Testing

Every feature ships with tests — "verifiable" means automated, not just clickable.

**Frameworks & commands:**
- `vitest` — unit/component tests (`*.test.ts` / `*.test.tsx`), run with `npm run test`.
- `@playwright/test` — end-to-end tests, run with `npm run test:e2e`.

**Unit-test (Vitest) — the pure logic:**
- Price breakdown & fee rounding (`nights × rate + cleaning + service_fee`, half-up cents).
- `nightsBetween` and availability/overlap helpers (half-open bookings, inclusive blocks, `blocked ∪ booked`).
- Zod schemas (accept valid input; reject invalid — e.g. `check_out ≤ check_in`, out-of-range rating).

**E2E-test (Playwright) — the core flows:**
- Protected route bounces to sign-in when signed out; signed-in user reaches it.
- Search + filters narrow results; booked/blocked dates are excluded.
- Book → `confirmed` → shows in Trips; the same dates are then unavailable to a second guest.
- Cancel an upcoming booking → dates freed.
- Host: create listing (with a photo) → publish → it appears in search.
- Guest cannot book their own listing; a review can be left only after checkout.

**Rules:**
- Keep pricing/date/availability logic as pure functions (`src/lib/utils.ts` + helpers) so it is unit-testable without a database.
- E2E runs against a seeded test database (Feature 03); a **seed-verification** step asserts expected listing/user counts before the suite runs.
- **Two fixture accounts exist, and the second one is not interchangeable with the first.** `TEST_USER` is the shared signed-in session almost every spec uses; `SECOND_USER` exists so RLS can be asked the question one principal structurally cannot ask — "what does someone who is *not* the host / *not* the owner see?". Reach for it whenever an assertion depends on the viewer being a different person, and keep specs that own a second-user global (favorites, `is_admin`) in `second-user.spec.ts` under `mode: 'serial'`.
- **Never leave a fixture account privileged.** A spec that needs `is_admin` grants it, asserts, and revokes it in a `finally`, with `global-teardown.ts` as the backstop — fixture passwords are committed, so a standing admin is a privilege path rather than an untidy row.
- Mock Cloudinary and the OAuth provider in tests — never call real external services in CI.
- A feature is "done" only when its unit tests and any relevant E2E flow pass.

---

## Error Handling

- User-facing messages are generic and safe ("Those dates are no longer available."). Never surface raw Postgres/Supabase error text, SQL, IDs of other users, or stack traces to the client.
- Log internal detail server-side with a bracketed source prefix: `[actions/bookings]`, `[queries/listings]`, `[auth/callback]`. Include the operation and the error message.
- A failed read returns a safe empty value and renders an empty/error state; a failed write returns `{ ok:false, error }`. One failure must not crash the page.
- Expected, foreseeable failures (validation, unavailable dates, unauthorized) are returned as results — not thrown. Reserve throwing for truly unexpected/programmer errors.

---

## Environment Variables

| Variable | Used In | Secret? |
| -------- | ------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client factories (server + browser) | No (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client factories (server + browser) | No (public; RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only seed/migration scripts only — bypasses RLS; **never in a request path** (incl. the admin dashboard, which uses `admin_list_users()`) | **Yes — never expose** |
| `NEXT_PUBLIC_SITE_URL` | OAuth `redirectTo` base for callbacks (localhost in dev, Render URL in prod) | No (public) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary config + `CldImage` delivery | No (public) |
| `CLOUDINARY_API_KEY` | Cloudinary SDK config (`src/lib/cloudinary.ts`) | No — a public identifier (see below) |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | `CldUploadWidget` — sent with a **signed** browser upload so Cloudinary knows which account the signature belongs to | No (public) |
| `CLOUDINARY_API_SECRET` | Signing uploads in `/api/sign-cloudinary` (server-only) | **Yes — never expose** |

- **The Cloudinary `api_key` is public; the `api_secret` is not.** `CldUploadWidget`
  performs the upload from the browser and must send the key with it, so the same
  value is duplicated as `NEXT_PUBLIC_CLOUDINARY_API_KEY` (found in F09: without
  it the widget throws *"A Cloudinary API Key is required for signed requests"*
  and the whole route 500s). This does **not** weaken the upload path — the key
  identifies the account, the **signature** authorises the upload, and that is
  minted only by `/api/sign-cloudinary` after verifying the session, whitelisting
  the signable params, and confirming the target folder belongs to a listing the
  caller hosts. `architecture.md`'s invariant is worded for exactly this: it
  names `CLOUDINARY_API_SECRET`, never the key.
- Never hardcode keys, URLs, or secrets — read them from `process.env`.
- `SUPABASE_SERVICE_ROLE_KEY` and `CLOUDINARY_API_SECRET` may be used only server-side and never imported into any client component or `NEXT_PUBLIC_*` value. The service-role key is further restricted to **standalone seed/migration scripts** — never a request path (route handler, server action, or RSC); privileged reads in a request path go through a `security definer` function like `admin_list_users()`.
- The same variables must be set locally in `.env.local` and in the **Render dashboard** for production.
- Add any new variable to this table and to `.env.example` before using it.

---

## Shared Constants

Fixed values live once in `src/lib/constants.ts` and are imported everywhere;
never duplicate these literals inline.

```ts
// src/lib/constants.ts
export const PROPERTY_TYPES = [
  'home', 'apartment', 'villa', 'cabin', 'cottage',
  'loft', 'guesthouse', 'tiny_home', 'treehouse', 'other',
] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const AMENITIES = [
  'wifi', 'kitchen', 'washer', 'dryer', 'air_conditioning', 'heating',
  'workspace', 'tv', 'free_parking', 'pool', 'hot_tub', 'ev_charger',
  'crib', 'gym', 'bbq_grill', 'breakfast', 'fireplace', 'smoke_alarm',
] as const
export type Amenity = (typeof AMENITIES)[number]

export const SERVICE_FEE_PCT = 0.14   // guest service fee, applied to (nights * price)
export const MAX_GUESTS = 16
export const MIN_NIGHTS_DEFAULT = 1
export const MAX_PHOTOS_PER_LISTING = 15
```

- Amenity/property-type values stored in the DB must come from these constants; the DB `property_type` enum must stay in sync with `PROPERTY_TYPES`.
- Fee math uses these rates and rounds to whole cents.

---

## Import Conventions

- Import from the `@/` alias (`@/lib/...`, `@/components/...`, `@/types/...`), configured to `src/*` in `tsconfig.json`. No `../../..` deep relative paths.
- Import order: external packages → `@/` internal modules → type-only imports (`import type`). Keep type-only imports as `import type`.
- Import Supabase clients only from `@/lib/supabase/server` or `@/lib/supabase/client`, matching the runtime (server vs client component).

---

## Comments

- Comment the **why**, not the **what** — explain non-obvious decisions, invariants, and gotchas (e.g. why the `setAll` try/catch is empty).
- No commented-out code and no redundant narration of self-evident lines.
- `TODO:` comments must name the pending work and, ideally, who/what unblocks it (`// TODO: paginate host reservations once a listing exceeds ~50 bookings`).

---

## Dependencies

Before installing anything new, check:

1. Can it be done with the existing stack (Next.js, Supabase, Zod, react-hook-form, date-fns, Tailwind)?
2. Is it small, actively maintained, and typed?
3. Does it belong on the server only, and if so is it kept out of client bundles?

Approved dependencies for this project:

- `next` — framework (App Router, RSC, server actions)
- `react`, `react-dom` — UI runtime
- `typescript` — language
- `@supabase/supabase-js` — Supabase client
- `@supabase/ssr` — cookie-based auth for Server Components / actions / middleware
- `zod` — input validation and inferred types
- `react-hook-form` — client form state
- `@hookform/resolvers` — binds Zod schemas to react-hook-form
- `date-fns` — date math for availability and bookings
- `server-only` — marks read/query modules as server-only (build-time guard against client imports)
- `tailwindcss` — styling engine (tokens from `DESIGN.md` in `globals.css @theme`)
- `lucide-react` — icons
- `clsx` / `tailwind-merge` — conditional class composition
- `cloudinary` — Node SDK: server-side config, upload signing, and asset delete
- `next-cloudinary` — `CldImage` (responsive delivery) and `CldUploadWidget` (signed uploads)
- `vitest` + `@testing-library/react` + `@testing-library/jest-dom` — unit/component tests
- `@playwright/test` — end-to-end tests (dev-only)

Do not install any other packages without updating this list first. If a headless
UI-primitive library is needed for accessibility (dialogs, popovers, date picker —
e.g. Radix/shadcn), it must be styled to the `DESIGN.md` component specs and added
here before install.
