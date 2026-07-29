# Architecture

> **Role:** How the system is built — stack, structure, boundaries, data, and the invariants that must never be violated.
> **Read after** `project-overview.md`, before writing any code.
> **Relates to:** the stack here drives `code-standards.md` and `library-docs.md`.

## Stack

| Layer | Tool | Purpose |
| ----- | ---- | ------- |
| Framework | Next.js 16 (App Router) | Full-stack React — routing, React Server Components, server actions |
| Language | TypeScript ≥5.1 (strict) | Type safety across client and server (Next 16 requires TS ≥5.1) |
| Runtime | Node.js ≥20.9 (LTS) | Next 16 minimum; Node 18 is unsupported. Pin via `.nvmrc` + `engines` |
| UI runtime | React 19 | Component model |
| Styling engine | Tailwind CSS v4 | Utility-first styling. Design tokens (colors, type scale, radii, spacing, breakpoints) come from `context/DESIGN.md` and live in the `@theme` block of `src/app/globals.css` |
| Design system | `context/DESIGN.md` (Airbnb-style) | Source of truth for visual language: Rausch `#ff385c` on white canvas, `#222222` ink, soft radii, one shadow tier. Component specs map to `src/components/ui/` |
| Font | Inter via `next/font/google` | Ships as the Airbnb Cereal VF substitute named in DESIGN.md; mapped onto the DESIGN.md type scale |
| Icons | lucide-react | Icon set |
| Database | Supabase Postgres | Relational store for all application data |
| Auth | Supabase Auth (Google OAuth) | Google sign-in with cookie-based sessions via `@supabase/ssr` |
| Authorization | Postgres Row Level Security | Per-user ownership enforced in the database |
| Image storage & delivery | Cloudinary | User-uploaded listing photos (and optional custom avatars); on-the-fly responsive transforms (`f_auto`, `q_auto`, per-width) over a CDN |
| Sample images | Unsplash (curated direct URLs) | Seed-only listing photos via stable `images.unsplash.com/photo-…` URLs |
| Realtime | Supabase Realtime | Live message delivery in messaging |
| Validation | Zod | Schema validation for form and server-action inputs |
| Forms | react-hook-form | Client-side form state, bound to Zod schemas |
| Dates | date-fns | Date math for availability and booking ranges |
| Package manager | npm | Dependency management |
| Deployment target | Render (Web Service) | Node web service: `npm run build` → `npm start`; env vars set in the Render dashboard |

---

## Folder Structure

```
NextBnb/
├── CLAUDE.md                     → entry point; redirects agent to context/
├── context/                      → project source-of-truth docs (this folder)
├── public/                       → static assets (favicon, placeholder images)
├── supabase/
│   ├── migrations/               → SQL migrations: tables, enums, RLS policies, triggers
│   └── seed.sql                  → sample listings, photos, demo users
├── src/
│   ├── app/                      → App Router routes (RSC by default)
│   │   ├── globals.css           → Tailwind + @theme design tokens (from DESIGN.md)
│   │   ├── layout.tsx            → root layout: nav bar, providers, Inter font
│   │   ├── page.tsx              → Home / search results
│   │   ├── listings/[id]/page.tsx→ Listing detail
│   │   ├── favorites/page.tsx    → saved listings (protected)
│   │   ├── trips/page.tsx        → guest reservations (protected)
│   │   ├── host/
│   │   │   ├── listings/page.tsx  → manage own listings (protected)
│   │   │   ├── listings/new/page.tsx
│   │   │   ├── listings/[id]/edit/page.tsx
│   │   │   └── reservations/page.tsx
│   │   ├── messages/page.tsx     → inbox + threads (protected)
│   │   ├── admin/page.tsx        → moderation dashboard (admins only)
│   │   ├── auth/callback/route.ts→ OAuth code exchange
│   │   └── api/sign-cloudinary/route.ts → server-signs Cloudinary upload params
│   ├── components/
│   │   ├── ui/                   → design-system primitives (per DESIGN.md component specs)
│   │   └── <domain>/             → feature components (ListingCard, SearchBar, …)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts         → createServerClient (RSC / server actions)
│   │   │   ├── client.ts         → createBrowserClient (client components)
│   │   │   └── middleware.ts     → session-refresh helper used by proxy.ts
│   │   ├── cloudinary.ts         → configured Cloudinary Node SDK (server-only)
│   │   ├── actions/              → server actions grouped by domain (bookings.ts, listings.ts, …)
│   │   ├── queries/              → read functions for RSC (listings.ts, bookings.ts, …)
│   │   ├── validations/          → Zod schemas per domain
│   │   ├── constants.ts          → PROPERTY_TYPES, AMENITIES, fee rates, limits
│   │   └── utils.ts              → pure helpers (formatPrice, nightsBetween, …)
│   ├── types/
│   │   └── database.types.ts     → generated Supabase types (source of truth for row shapes)
│   └── proxy.ts                  → refreshes session, guards protected routes
│                                   (Next 16 renamed the `middleware` convention)
├── .env.local                    → secrets (gitignored)
└── package.json
```

---

## System Boundaries

| Folder | Owns |
| ------ | ---- |
| `src/app/` | Routing, page composition, layouts. Server Components fetch via `lib/queries` and render; they must not contain raw SQL/Supabase table queries inline or business logic — delegate to `lib/`. |
| `src/app/**/route.ts` | HTTP endpoints only (OAuth callback, Cloudinary signature). No UI. |
| `src/components/ui/` | Presentational design-system primitives only, built to `DESIGN.md` specs. No data fetching, no Supabase, no business rules. |
| `src/components/<domain>/` | Feature UI. Client interactivity and calling server actions; no direct database access. |
| `src/lib/supabase/` | The **only** place Supabase clients are constructed. Nothing else may call `createServerClient`/`createBrowserClient`. |
| `src/lib/cloudinary.ts` | The **only** place the Cloudinary Node SDK (holding `CLOUDINARY_API_SECRET`) is configured. Server-only; never imported by a client component. |
| `src/lib/queries/` | Read-side data access (server-only). Returns typed rows; no mutations. |
| `src/lib/actions/` | Write-side server actions: validate → authorize → mutate → revalidate. The only place mutations live. |
| `src/lib/validations/` | Zod schemas. Single source of truth for input shapes; no side effects. |
| `src/lib/constants.ts` | Fixed shared values (property types, amenities, fee rates, limits). |
| `src/types/` | Generated DB types and shared TS types. No runtime code. |
| `supabase/` | Schema, RLS policies, triggers, and seed data. The database is the source of truth for authorization. |

---

## Data Flow

### Server-rendered read

```
Server Component (app/**/page.tsx)
  → lib/queries/<domain> function
    → createServerClient() (lib/supabase/server.ts)
      → Supabase Postgres  [RLS scopes rows to the current user]
    ← typed rows
  ← render HTML
```

### Mutation via server action

```
Client component (form) → server action (lib/actions/<domain>.ts)
  → zod schema.safeParse(input)      [invalid → return { ok:false, error }]
  → getUser()                        [no user → return { ok:false, error:'Unauthorized' }]
  → createServerClient().from(...).insert/update/delete()  [RLS re-checks ownership]
  → revalidatePath(affected route)
  ← ActionResult<T>  ({ ok:true, data } | { ok:false, error })
```

### Image upload (listing photos / avatar)

```
Client requests a signature → /api/sign-cloudinary (server signs params with API secret)
  → Cloudinary upload widget/SDK uploads the File directly to Cloudinary (signed)
    → returns { public_id, secure_url }
→ server action records the row (listing_photos: public_id + url) → revalidatePath
Delete: server action removes the row AND cloudinary.uploader.destroy(public_id)
```

### Realtime messaging

```
Client component subscribes: supabase.channel('messages:thread=<id>')
  .on('postgres_changes', { event:'INSERT', table:'messages', filter:'thread_id=eq.<id>' })
Send: server action inserts message + bumps thread.last_message_at
  → Postgres change event → subscribed clients append message to the thread
```

### Google auth

```
<form action={signInWithGoogle}> → server action (lib/actions/auth.ts)
  → supabase.auth.signInWithOAuth({ provider:'google',
      options:{ redirectTo: `${SITE_URL}/auth/callback?next=…`, skipBrowserRedirect:true } })
  → redirect(data.url)              [PKCE verifier cookie written server-side]
  → Google consent → redirect /auth/callback?code=...
  → route.ts: exchangeCodeForSession(code) sets cookies
  → DB trigger on auth.users insert upserts a profiles row
  → redirect to safeNextPath(next) (or /)
```

Sign-in runs **server-side**, not from the browser client: the same client that
writes the PKCE code verifier reads it back in the callback, and the sign-in
button needs no `'use client'`. `signInWithGoogle` and `signOut` are the one
documented exception to the `ActionResult` contract — their only outcome is
navigation, and `redirect()` signals by throwing, so they return `void` and
surface failure as `/?signin=error`.

---

## Data Model

Postgres via Supabase. All monetary amounts are **integers in cents** (single
currency). `id` columns are `uuid default gen_random_uuid()` unless noted.
Timestamps are `timestamptz default now()`.

### `profiles`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | references `auth.users(id)` on delete cascade |
| full_name | text | from Google profile |
| avatar_url | text | Google avatar or uploaded avatar |
| is_admin | boolean | default `false`; gates `/admin` |
| created_at | timestamptz | |

**No `email` column.** `profiles` is publicly readable (host names, reviewer
names, message participants), so storing email here would expose every user's
email. Email lives in `auth.users.email`: the current user reads their own via
`supabase.auth.getUser()`; the admin user list reads others' **only** via the
`admin_list_users()` `security definer` function gated on `is_admin()` — never
through the public `profiles` policy, and never via the service-role key in a
request path.

`admin_list_users()` returns exactly **`(id uuid, email text)`** — nothing more.
Names, join dates, and listing/booking counts are already visible to an admin
through ordinary RLS-scoped reads, so the one function that bypasses RLS exposes
only the one column RLS cannot reach.

### `listings`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| host_id | uuid | references `profiles(id)` on delete cascade; not null |
| title | text | not null |
| description | text | |
| property_type | `property_type` enum | not null |
| city | text | not null |
| state | text | |
| country | text | not null |
| neighborhood | text | text location only (no lat/lng) |
| max_guests | int | not null, ≥ 1 |
| bedrooms | int | not null, default 0 |
| beds | int | not null, default 1 |
| bathrooms | numeric(3,1) | not null, default 1 |
| price_per_night | int | not null; **cents** |
| cleaning_fee | int | not null, default 0; **cents** |
| amenities | text[] | not null, default `'{}'`; values from `AMENITIES` constant |
| house_rules | text | |
| check_in_time | text | e.g. `'15:00'` |
| check_out_time | text | e.g. `'11:00'` |
| min_nights | int | not null, default 1 |
| is_published | boolean | not null, default `false` |
| created_at / updated_at | timestamptz | |

### `listing_photos`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| listing_id | uuid | references `listings(id)` on delete cascade |
| url | text | not null; delivery URL (Cloudinary `secure_url`, or a seed Unsplash URL) |
| public_id | text | Cloudinary public id; **null** for external/seed (Unsplash) images. Used for transforms + delete |
| position | int | not null, default 0; gallery order |
| is_cover | boolean | not null, default false; exactly one cover per listing |
| created_at | timestamptz | |

### `bookings`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| listing_id | uuid | references `listings(id)` on delete cascade; not null |
| guest_id | uuid | references `profiles(id)` on delete cascade; not null |
| check_in | date | not null |
| check_out | date | not null; check `check_out > check_in` |
| guests_count | int | not null, default 1 |
| nights | int | not null; snapshot of `check_out - check_in` |
| price_per_night | int | not null; **cents** snapshot at booking time |
| cleaning_fee | int | not null, default 0; **cents** snapshot |
| service_fee | int | not null; **cents** snapshot (guest service fee) |
| total | int | not null; **cents** |
| status | `booking_status` enum | not null, default `'confirmed'` |
| created_at / cancelled_at | timestamptz | |

Overlap prevention: an exclusion constraint (`btree_gist`) forbids two rows with
`status = 'confirmed'` from having overlapping `daterange(check_in, check_out, '[)')`
for the same `listing_id`. "Completed" is **derived** (`status='confirmed' AND
check_out < current_date`), not a stored status.

### `blocked_dates` (host-set availability)

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| listing_id | uuid | references `listings(id)` on delete cascade; not null |
| start_date | date | not null |
| end_date | date | not null; check `end_date >= start_date` |
| created_at | timestamptz | |

### `favorites`

| Column | Type | Notes |
| ------ | ---- | ----- |
| user_id | uuid | references `profiles(id)` on delete cascade |
| listing_id | uuid | references `listings(id)` on delete cascade |
| created_at | timestamptz | |
| — | PK | composite `(user_id, listing_id)` |

### `reviews`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| listing_id | uuid | references `listings(id)` on delete cascade; not null |
| booking_id | uuid | references `bookings(id)` on delete cascade; not null; **unique** (one review per booking) |
| reviewer_id | uuid | references `profiles(id)` on delete cascade; not null |
| rating | int | not null; check between 1 and 5 |
| comment | text | |
| created_at | timestamptz | |

### `message_threads`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| listing_id | uuid | references `listings(id)` on delete set null; nullable |
| guest_id | uuid | references `profiles(id)` on delete cascade; not null |
| host_id | uuid | references `profiles(id)` on delete cascade; not null |
| last_message_at | timestamptz | for inbox ordering |
| created_at | timestamptz | unique `(guest_id, host_id, listing_id)` |

### `messages`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| thread_id | uuid | references `message_threads(id)` on delete cascade; not null |
| sender_id | uuid | references `profiles(id)` on delete cascade; not null |
| body | text | not null |
| read_at | timestamptz | null until read |
| created_at | timestamptz | |

Enums: `property_type` = `home | apartment | villa | cabin | cottage | loft |
guesthouse | tiny_home | treehouse | other`; `booking_status` = `confirmed |
cancelled`.

---

## Row Level Security (per-table policies)

RLS is **enabled on every table** and is the authoritative access control. `auth.uid()`
is the current user. `is_admin()` is a `security definer` helper returning
`profiles.is_admin` for the current user (avoids recursive policy evaluation).

| Table | SELECT (read) | INSERT | UPDATE | DELETE |
| ----- | ------------- | ------ | ------ | ------ |
| `profiles` | anyone (public — safe: no email/sensitive columns) | via signup trigger only | own row (`id = auth.uid()`), **`full_name` + `avatar_url` columns only** | none (cascade from auth) |
| `listings` | `is_published = true` **OR** `host_id = auth.uid()` **OR** `is_admin()` | `host_id = auth.uid()` | `host_id = auth.uid()` — **no admin branch**, see below | `host_id = auth.uid()` **OR** `is_admin()` |
| `listing_photos` | photo's listing is readable (published, or owner, or admin) | listing `host_id = auth.uid()` | listing `host_id = auth.uid()` | owner **OR** `is_admin()` |
| `blocked_dates` | listing is readable | listing `host_id = auth.uid()` | listing `host_id = auth.uid()` | listing `host_id = auth.uid()` |
| `bookings` | `guest_id = auth.uid()` **OR** listing `host_id = auth.uid()` **OR** `is_admin()` | `guest_id = auth.uid()`, listing `host_id <> auth.uid()` (no self-booking), and listing `is_published` | guest while `status='confirmed'` **AND** `check_in >= current_date` **OR** `is_admin()` — **`status` + `cancelled_at` columns only** | none (cancel is a status UPDATE) |
| `favorites` | `user_id = auth.uid()` | `user_id = auth.uid()` | none | `user_id = auth.uid()` |
| `reviews` | anyone (public) | reviewer is the booking's guest, booking completed, one per booking | none — **reviews are immutable** (to change, delete and re-post) | reviewer **OR** `is_admin()` |
| `message_threads` | `guest_id = auth.uid()` **OR** `host_id = auth.uid()` | participant creating for self | participants, **`last_message_at` column only** | none |
| `messages` | thread participant | sender is a thread participant (`sender_id = auth.uid()`) | **recipient** — participant where `sender_id <> auth.uid()`, **`read_at` column only** | none |

- "Listing is readable" = the referencing listing satisfies the `listings` SELECT policy.
- Ownership on child tables is checked by joining to the parent `listings.host_id` inside the policy (an `EXISTS (…)` subquery), never trusted from the client.
- Unpublished listings and their photos are invisible to everyone except the owner and admins — this is enforced here, not only in queries.
- **An admin can read, delete and moderate a listing but cannot UPDATE one.**
  `listings_update_own` names only the host, in both USING and WITH CHECK. That
  asymmetry is deliberate and it is why F17's admin unpublish is a definer
  function (`admin_unpublish_listing()`, below) rather than a policy branch —
  widening the policy would grant an admin *every* listing column, `host_id`
  included, because no column grant restricts listing writes. An admin `.update()`
  on `listings` matches zero rows and returns success; treat that as the failure
  mode it is.

### The three `security definer` functions, and what each exists to reach

RLS is the authority, so a function that bypasses it needs a stated reason and a
narrow return. There are three, each hardened the same way — `set search_path =
''`, fully-qualified references, `EXECUTE` revoked from `PUBLIC`:

| Function | Migration | Bypasses RLS to reach | Granted to |
| -------- | --------- | --------------------- | ---------- |
| `admin_list_users()` | `0002` | `auth.users.email` — `profiles` has no email column because it is publicly readable. Returns `(id, email)` and nothing else; self-guarded on `is_admin()` | `authenticated` |
| `unavailable_listing_ids(check_in, check_out)` | `0007` | `bookings` rows an anon visitor cannot see. Returns **published listing ids only** | `anon`, `authenticated` |
| `listing_occupied_ranges(listing_id)` | `0008` | the same, transposed — which nights are taken for one listing. Returns inclusive date spans, published listings only | `anon`, `authenticated` |
| `admin_unpublish_listing(listing_id)` | `0009` | the `listings` UPDATE policy, which has no admin branch. Writes `is_published = false` and **no other column**; self-guarded on `is_admin()`, raises `42501` otherwise, returns the id or null | `authenticated` |

Each shows up as a security-advisor WARN for every role it grants EXECUTE to.
That is expected and the count is a tracked baseline (`progress-tracker.md`) —
a *new* WARN beyond it is a finding.

### Column-level grants — RLS filters rows, not columns

Wherever the matrix says *"may update, but only this column"*, **the policy alone
cannot enforce it**. A row-level policy admits or rejects the whole row, so
`profiles` UPDATE scoped to "own row" would happily accept
`set is_admin = true`. Postgres checks column privileges *in addition to* RLS,
so those rules are carried by `GRANT`, not by policy text:

| Table | Writable columns for `authenticated` |
| ----- | ------------------------------------ |
| `profiles` | `full_name`, `avatar_url` — **never `is_admin`** (no self-promotion) |
| `bookings` | `status`, `cancelled_at` — the price snapshot and dates are unwritable |
| `message_threads` | `last_message_at` |
| `messages` | `read_at` — message bodies are never editable |

Cells the matrix marks **"none"** are revoked outright rather than left to the
absence of a policy: an UPDATE/DELETE against a table with RLS on and no
matching policy affects **zero rows and returns success**, which is
indistinguishable from "it worked". Revoked: DELETE on `profiles`, `bookings`,
`message_threads`, `messages`; UPDATE on `reviews` (immutable) and `favorites`.
`anon` holds no INSERT/UPDATE/DELETE on any table.

### Policy conventions

- Predicates use **`(select auth.uid())`**, never bare `auth.uid()` — the subselect is hoisted into an InitPlan and evaluated once per query instead of once per row.
- Every policy names its roles (`to authenticated`, or `to anon, authenticated`). Public-readable tables whose predicate consults `is_admin()` are split into a separate anon policy that omits the call, because a signed-out visitor is never an admin — this keeps `EXECUTE` on `is_admin()` off `anon` entirely and shortens the hottest read path in the app.

---

## Availability Rules

Availability is derived, never a stored flag. A listing is available for a
requested `[check_in, check_out)` range iff **none** of these overlap it:

1. Any `confirmed` booking on the listing, compared as half-open `daterange(check_in, check_out, '[)')`.
2. Any `blocked_dates` range on the listing.

- **Booking dates are half-open `[check_in, check_out)`**: the checkout day is *not* occupied — a new guest may check in on another's checkout day. All availability math and the `btree_gist` exclusion constraint use `'[)'`.
- **`blocked_dates` are inclusive `[start_date, end_date]`** (both ends blocked). When unioning with bookings for a calendar or overlap test, convert a block to the half-open `daterange(start_date, end_date + 1, '[)')` so the two models compose correctly.
- A host **cannot block dates that already have a confirmed booking**; the add-block action rejects a range overlapping any confirmed booking.
- A guest **cannot book a range** overlapping either a confirmed booking or a blocked range; the booking action checks both, and the exclusion constraint is the final guard against races.
- Minimum stay: `check_out - check_in >= listings.min_nights`; dates must be today or later (no past bookings).

### Availability must be computed in the database, not in application code

RLS scopes `bookings` SELECT to the guest, the listing's host, and admins — so an
**anonymous visitor reads zero booking rows**. Any client- or RSC-side
availability check built on a `bookings` read therefore concludes that the whole
catalogue is free, silently and without error. (`blocked_dates` is anon-readable
for published listings, so only the bookings half is affected — which is worse,
because half the answer looks right.)

The date check is therefore a `security definer` function, added in `0007`:

```sql
public.unavailable_listing_ids(p_check_in date, p_check_out date) returns setof uuid
```

It returns **published listing ids only** — never guest ids, price snapshots, or
booking rows — unioning confirmed bookings (`'[)'`) with blocked dates
(`daterange(start_date, end_date + 1, '[)')`). It is hardened like
`admin_list_users()`: `set search_path = ''`, fully-qualified references,
`EXECUTE` revoked from `PUBLIC` and granted to `anon, authenticated`. It refuses
null bounds, because an unbounded `daterange` overlaps everything and would mark
every listing unavailable — the difference between "no date filter" and "no
results at all".

Occupancy is public information in this product (F12's date picker must render
it), so exposing it is the design, not a leak. Search, the listing calendar, and
the booking action all read availability through this one function.

## Booking Rules

- **Instant Book only**: a valid reservation is inserted as `confirmed` immediately; there is no pending/host-approval state.
- **No self-booking**: a host cannot book their own listing (enforced in the action and the `bookings` INSERT policy).
- **Cancellation**: the **guest** may cancel while `status = 'confirmed'` and `check_in` is today or later (an upcoming/in-progress stay); a stay whose `check_in` has fully passed and started is not cancellable in this build. Cancel sets `status = 'cancelled'` + `cancelled_at`, which frees the dates (cancelled rows are excluded from the exclusion constraint). Admins may also cancel.
- **Completed** is derived (`status = 'confirmed' AND check_out < current_date`), enabling reviews; it is never a stored status.
- **Price snapshot & rounding**: at booking time compute in integer cents — `subtotal = nights × price_per_night`, `service_fee = round(subtotal × SERVICE_FEE_PCT)` (round half-up to whole cents), `total = subtotal + cleaning_fee + service_fee`. All five fields are stored and never recomputed later.

---

## Image Storage & Delivery (Cloudinary)

All user-uploaded images live in Cloudinary (not Supabase Storage). The DB stores
only the `url` + `public_id`; Cloudinary handles optimization and responsive
delivery. Uploads are **signed server-side** — the browser never sees the API secret.

| Folder (Cloudinary) | Naming | Contents | Access |
| ------------------- | ------ | -------- | ------ |
| `nextbnb/listings/{listing_id}` | `{public_id}` returned by Cloudinary | Listing gallery images | Public delivery URLs; uploads require a server-generated signature; delete via SDK `destroy(public_id)` |
| `nextbnb/avatars/{user_id}` | `{public_id}` | Optional custom avatars (default is the Google `avatar_url`) | Same signed-upload rule |

- Delivery uses `f_auto` (auto AVIF/WebP), `q_auto` (auto quality), and per-width transforms via the `sizes`/`width` props of `next-cloudinary`'s `CldImage`.
- Upload authorization is enforced by the `/api/sign-cloudinary` route (only signed-in users get a signature); the DB row insert is a separate auth-guarded server action.
- Seed images are curated Unsplash URLs stored directly in `listing_photos.url` with `public_id = null`; they are never uploaded to Cloudinary.

---

## Authentication

- Provider: Supabase Auth via Google OAuth (PKCE flow), using `@supabase/ssr` for cookie-based sessions.
- Methods: "Sign in with Google" only. No email/password, no other providers.
- **Caveat — the app offers Google only, the Supabase project does not.** The
  email/password provider is enabled at the project level because the Playwright
  fixture signs in through it (Google consent cannot be automated), and
  `disable_signup` is `false`, so email registration is reachable via the Auth API
  even though no UI exposes it. Low severity — email confirmation is required and the
  resulting account is an ordinary guest with no privilege path (RLS + column grants) —
  but it is a real gap between this document and the live config. Turning signups off
  globally is **not** the fix: it would also block first-time Google users. The fix is
  a separate Supabase project for E2E so production can disable the email provider
  outright; deferred to F18. See `build-journal.md` → Phase 1 close-out.
- Protected: `/trips`, `/favorites`, `/messages`, `/host/**`, and all mutating server actions. `/admin/**` additionally requires `profiles.is_admin = true`.
- Public: `/`, `/listings/[id]`, `/auth/callback`, and static assets.
- The session check for pages/actions uses `supabase.auth.getUser()` (verifies with the auth server) — never trust `getSession()` alone for authorization. `src/proxy.ts` refreshes the session cookie on every request and redirects unauthenticated users away from protected routes.
- The proxy guards **authentication only**. `/admin` additionally needs `is_admin`, and that check lives in `src/app/admin/page.tsx` — putting it in the proxy would add a database round trip to every request in the app. RLS remains the backstop for the data itself.
- Post-login destination: the `next` query param passed into the OAuth `redirectTo`, defaulting to `/`. The `redirectTo` base is `NEXT_PUBLIC_SITE_URL`.
- A Postgres trigger on `auth.users` insert creates the matching `profiles` row, so a profile always exists after first sign-in.

### Redirect URL responsibilities (three distinct places — a common source of "OAuth works locally, breaks in prod")

The OAuth hop is **Browser → Google → Supabase → our app**. Each leg has its own allow-list:

1. **Google Cloud OAuth client → Authorized redirect URIs.** This points at **Supabase, not our app**:
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (Add exactly this one. It is the same for local and prod because Google talks to Supabase, never directly to our app.)
2. **Supabase Auth → URL Configuration → Redirect URLs** (where Supabase is allowed to send the user back into *our* app). Add both:
   - `http://localhost:3000/auth/callback`
   - `https://<app>.onrender.com/auth/callback`
   Also set **Site URL** to the production `https://<app>.onrender.com`.
3. **Our app route `/auth/callback`** (`src/app/auth/callback/route.ts`) — receives `?code=…`, calls `exchangeCodeForSession`, and redirects to `next`. `signInWithOAuth({ redirectTo })` builds this URL from `NEXT_PUBLIC_SITE_URL`.

Missing #1 → Google rejects the sign-in. Missing #2 → Supabase refuses to redirect back and the user lands on an error. Setting the wrong `NEXT_PUBLIC_SITE_URL` → users get bounced to the wrong origin after login.

---

## Key Patterns

Every file named in this section exists in `src/` — **read the file, not a copy of
it.** What follows records *why* each looks the way it does, because that is the
part source cannot tell you. Verbatim snippets used to live here and three of them
had silently drifted from their source by F12; a stale snippet is worse than a
pointer, because it is confidently wrong and it is what gets read *instead of* the
real file.

### Supabase server client — `src/lib/supabase/server.ts`

Server Components, server actions, and route handlers. Reads/writes session cookies
via `next/headers`.

- **`setAll`'s try/catch is empty on purpose.** Server Components cannot set cookies —
  only the proxy and server actions can. The proxy refresh writes them, so swallowing
  the throw here is correct, not a missing error handler.
- **`setAll`'s parameter needs an explicit `Parameters<SetAllCookies>[0]` annotation**,
  with `SetAllCookies` imported from `@supabase/ssr`. `createServerClient` has two
  cookie overloads (`getAll`/`setAll` vs the deprecated `get`/`set`/`remove`) and
  strict TS cannot infer the param across them — omitting it is 10 implicit-any
  errors (F01).
- The two env vars carry non-null assertions; this is one of the sanctioned
  boundaries in `code-standards.md` → TypeScript.
- **Both factories are generic over `Database`** (`createServerClient<Database>` /
  `createBrowserClient<Database>`) from `@/types/database.types`. Drop the generic and
  every query silently degrades to `never` — F04 lost an afternoon to exactly that,
  surfacing as one opaque `TS2698` rather than as a type error where the fault was.

### Supabase browser client — `src/lib/supabase/client.ts`

Client Components only (`'use client'`) — realtime subscriptions and client-side
Cloudinary uploads. No cookie plumbing: `createBrowserClient` handles it.

**These two files are the only places a Supabase client may be constructed** (see
System Boundaries). Match the client to the runtime — importing the server module
into a client component is a build error, and the reverse silently loses the session.

### Proxy session refresh — `src/proxy.ts` + `src/lib/supabase/middleware.ts`

Next 16 renamed the `middleware` file convention to `proxy` (and the export with it);
the proxy runtime is Node-only, which is what the Supabase client wants. **It is two
files:** `src/proxy.ts` holds only the convention — the `proxy` export and the
`matcher` — and delegates to `updateSession`. All logic lives in
`src/lib/supabase/middleware.ts`, which keeps its filename because it is a library
helper rather than a file convention, and because client construction is restricted
to `src/lib/supabase/`.

- **Return the response object the helper builds, unmodified** — it carries the
  refreshed cookies. Constructing a fresh `NextResponse` instead drops them and
  silently signs the user out.
- **Add no logic between client creation and `getUser()`.** That call is what
  refreshes the token.
- **It throws when its Supabase env vars are missing.** It is the only thing standing
  between a signed-out visitor and every protected route, so it must never degrade to
  a silent no-op — F04 hardened F01's env-skip for exactly this reason.
- `PROTECTED` is a prefix list; a path matches on exact equality or on `path + '/'`.

### Server action with auth guard + validation — `src/lib/actions/*.ts`

The canonical mutation shape — validate with Zod → `getUser()` → mutate (RLS
re-checks ownership) → `revalidatePath` → return `ActionResult` — is specified once,
with a worked example, in **`code-standards.md` → Boundary Patterns**. Follow it
there; the same sequence is drawn under Data Flow above.

Two domain rules this project's actions add on top:

- **A Supabase error on a `bookings` insert usually means the overlap exclusion
  constraint fired** (`23P01`). Surface it as "Those dates are no longer available." —
  never the raw error.
- **The action is the only enforcement for any rule spanning two tables.** No
  constraint can express `min_nights`, the per-listing `max_guests`, past dates, or a
  booking over `blocked_dates` (F12).

### OAuth callback route — `src/app/auth/callback/route.ts`

- **`next` is attacker-controlled** — it round-trips through the provider — so it
  passes through `safeNextPath` before use. A bare `startsWith('/')` check still
  admits the protocol-relative `//evil.com`, which browsers treat as absolute.
- **Behind Render's load balancer `origin` is the internal address**, so the redirect
  base is built from `x-forwarded-host` in production and from `origin` in
  development.
- **`error=access_denied` redirects home with no error banner** — declining at the
  consent screen is a choice, not a failure. Any other failure lands on
  `/?signin=error`.

### Cloudinary config + signature route — `src/lib/cloudinary.ts`, `src/app/api/sign-cloudinary/route.ts`

- **`cloudinary.ts` begins with `import 'server-only'`.** That line is what makes
  "never imported by a client component" a build-time error rather than a convention,
  and this module holds `CLOUDINARY_API_SECRET`. Do not drop it.
- **Never blindly sign what the client sends.** The route verifies the user (401),
  **whitelists** the signable keys — `timestamp`, `folder`, `source`, rejecting
  `public_id`, `upload_preset`, `eager`, `notification_url` (403) — and confirms the
  `folder` matches `nextbnb/listings/<uuid>` for a listing the caller hosts (403).
- **Sign the validated params exactly as received.** Rebuilding a different object
  makes the signature mismatch the widget's actual upload.
- The ownership read in that route is the one sanctioned `.from()` outside
  `lib/queries/` (see `code-standards.md` → Route handler).


---

## Invariants

- Supabase clients are created **only** in `src/lib/supabase/`; no other file calls `createServerClient` / `createBrowserClient`.
- Every mutation goes through a server action in `src/lib/actions/`; components never write to the database directly.
- Every server action validates input with a Zod schema and verifies the user with `supabase.auth.getUser()` before mutating.
- Authorization is never enforced by application code alone — every table has Row Level Security policies, and RLS is the backstop for every read and write.
- Where a rule limits *which columns* a user may write, it is enforced by a column-level `GRANT`, not by a policy — RLS filters rows, not columns. A user can never write `profiles.is_admin`, a booking's price snapshot or dates, or a message body.
- Use `getUser()` (not `getSession()`) for any authorization decision on the server.
- Any post-auth redirect target taken from the URL passes through `safeNextPath` before use — a rooted path only, never a protocol-relative or absolute URL.
- `src/lib/supabase/middleware.ts` **throws** when its Supabase env vars are missing. It is the only thing standing between a signed-out visitor and every protected route, so it must never degrade to a silent no-op.
- Two `confirmed` bookings can never overlap for the same listing — enforced by the Postgres exclusion constraint, and checked in the booking action before insert.
- A booking's price fields (`price_per_night`, `cleaning_fee`, `service_fee`, `total`, `nights`) are snapshots written at creation and never recomputed from the current listing afterward.
- All money is stored and computed as integer **cents**; never store or arithmetic on floating-point currency.
- Availability = confirmed bookings ∪ `blocked_dates`; every availability check and calendar considers both, with bookings half-open `[check_in, check_out)` and blocks inclusive `[start, end]` (see Availability Rules).
- Availability for a date range is resolved by the `unavailable_listing_ids()` definer function — never by reading `bookings` from a query or component. RLS hides bookings from anon, so such a read returns "everything is available" instead of failing.
- A host can never book their own listing (enforced in the action and the `bookings` INSERT policy).
- The Cloudinary signature route verifies the user, whitelists the signable keys, and signs only when the `folder` targets a listing the caller owns — it rejects `public_id`, `upload_preset`, and any malformed or unowned folder.
- A review may be created only by the booking's guest, only after checkout has passed, and at most one review per booking (DB unique on `booking_id`).
- Only listings with `is_published = true` are visible in search and to non-owners; a host always sees their own unpublished listings.
- Messages and threads are readable and writable only by the thread's `guest_id` and `host_id`.
- `/admin/**` and admin-only queries require `profiles.is_admin = true`; this is checked in the DB (RLS) as well as the route.
- **An admin write that RLS also permits to a non-admin must re-check `is_admin` in the action.** `listings_delete_own_or_admin` is `host_id = auth.uid() OR is_admin()`, so `adminDeleteListing` — which deliberately omits `deleteListing`'s upcoming-booking guard — would otherwise be a route for any host to erase their own listing's live reservations. Here the action narrows the policy rather than the other way round.
- An admin unpublishes a listing through `admin_unpublish_listing()`; a direct `.update()` on `listings` as an admin affects zero rows and reports success.
- Row shapes come from `src/types/database.types.ts` (generated); do not hand-write types that duplicate table columns.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`) never reach client components or `NEXT_PUBLIC_*` variables.
- All user image uploads go to Cloudinary via a **server-signed** request; the browser never holds the Cloudinary API secret, and every upload is preceded by an auth check.
- Deleting a listing or a photo also deletes its Cloudinary asset (`destroy(public_id)`) when `public_id` is set; seed images (`public_id = null`) are skipped.
- Images render through `next-cloudinary` `CldImage` with `f_auto`/`q_auto` and a `sizes` prop — never a bare `<img>` for a Cloudinary asset, so responsive/optimized delivery is guaranteed.
- The visual design system is defined by `context/DESIGN.md`. Colors, type scale, radii, and spacing come from its tokens (encoded in `globals.css` `@theme`); do not introduce off-palette colors or ad-hoc values.
- The single accent color is Rausch `#ff385c`, used scarcely (primary CTAs, search orb, saved-heart state); the canvas is white, ink is `#222222`. Star ratings render in ink, not gold.
- Every screen is built mobile-first and verified at the DESIGN.md breakpoints (mobile `<744`, tablet `744–1128`, desktop `1128–1440`, wide `>1440`); layouts drop columns rather than reflow rows.
