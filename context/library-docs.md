# Library Docs

> **Role:** Project-specific usage patterns for each third-party library.
> **Read the relevant section** before using a library.
> **Relates to:** covers the integrations in `architecture.md`; defers to MCP servers and skills first.

Project-specific usage patterns for every third party library in this project.
This file only covers how we use each library in **this** specific project —
rules, patterns, and constraints specific to NextBnb.

Read the relevant section before implementing any feature that touches these
libraries.

---

## Before Using Any Library

Before implementing any feature that uses a third party library:

1. **Check the project instruction file** (`CLAUDE.md`) at the project root — it lists standing rules and the authority order for libraries.
2. **Check if an MCP server is configured** for that library — the **Context7** MCP (`resolve-library-id` → `query-docs`) and the **Supabase** MCP are available; use them for current API shapes before falling back to general knowledge.
3. **Read this file** for project-specific patterns that override general library knowledge.

The order of authority is:

```
MCP server (Context7 / Supabase) → Skills via CLAUDE.md → This file (project rules) → General training knowledge
```

Never rely on general training knowledge alone for library APIs — they change
frequently and training data may be outdated.

---

## @supabase/ssr + @supabase/supabase-js

**Check first:** Context7 `/supabase/ssr` for auth/cookie APIs; `/supabase/supabase` (or the Supabase MCP `search_docs`) for queries, Storage, and Realtime. Client construction lives only in `src/lib/supabase/` — read `server.ts` / `client.ts` / `middleware.ts` themselves, and `architecture.md` → Key Patterns for why each looks the way it does. Do not re-create them elsewhere.

### Setup

Two clients, one per runtime. Never mix them.

```ts
// Server Components, server actions, route handlers:
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Components ('use client') — realtime subscriptions + Cloudinary uploads:
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### Querying with filters (reads)

Reads live in `src/lib/queries/*`. Compose filters conditionally; RLS already
restricts rows, so filters are for the feature, not for security.

```ts
let query = supabase
  .from('listings')
  .select('*, listing_photos(url, public_id, is_cover), reviews(rating)')
  .eq('is_published', true)

if (filters.city)         query = query.ilike('city', `%${filters.city}%`)
if (filters.propertyType) query = query.eq('property_type', filters.propertyType)
if (filters.minPrice)     query = query.gte('price_per_night', filters.minPrice)
if (filters.maxPrice)     query = query.lte('price_per_night', filters.maxPrice)
if (filters.guests)       query = query.gte('max_guests', filters.guests)
if (filters.amenities?.length) query = query.contains('amenities', filters.amenities)

const { data, error } = await query.order('created_at', { ascending: false })
```

**Rules:**
- Availability (dates) is **not** a column filter and **not** an application-code filter: RLS hides `bookings` from anon, so a nested select returns `[]` and every listing looks free. Call the `unavailable_listing_ids(p_check_in, p_check_out)` RPC and exclude its ids (`.not('id', 'in', '(…)')`). See `architecture.md` → Availability Rules.
- An empty id list must **skip** the `.not(...)` call entirely — `in ()` is a SQL syntax error.
- Select only the columns/relations you render; use nested selects for related rows (`listing_photos`, `reviews`) instead of N+1 queries.
- A read never mutates and never uses the service-role key.

### Image storage

Images are **not** stored in Supabase Storage — they live in Cloudinary. See the
Cloudinary section below. The `listing_photos` row holds the delivery `url` and
Cloudinary `public_id`.

### Realtime (messaging)

Subscribe in a client component; unsubscribe on unmount. Postgres changes are
gated by RLS, so a user only receives rows they may read.

```ts
'use client'
const supabase = createClient()

useEffect(() => {
  const channel = supabase
    .channel(`messages:thread=${threadId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
      (payload) => setMessages((prev) => [...prev, payload.new as Message]),
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [threadId])
```

**Rules:**
- Always `removeChannel` in the effect cleanup — leaked channels multiply on re-render.
- Sending a message is a server action (validates + inserts + bumps `last_message_at`); Realtime is for **receiving**, not sending.
- Realtime must be enabled on the `messages` table in the migration (added to the `supabase_realtime` publication).

### Auth

- `signInWithOAuth({ provider: 'google', options: { redirectTo } })` starts the flow; `/auth/callback` exchanges the code (see `architecture.md`).
- Authorization uses `supabase.auth.getUser()` — it revalidates with the auth server. Never authorize on `getSession()` alone.

**Rules:**
- Regenerate `src/types/database.types.ts` after any schema migration (Supabase MCP `generate_typescript_types` or the CLI); code depends on it.
- The service-role key bypasses RLS — use it only in standalone seed/migration scripts, never in a request path or client bundle. Privileged reads in a request path (e.g. the admin user list) go through a `security definer` function like `admin_list_users()`, not the service-role key.

---

## Cloudinary (`cloudinary` + `next-cloudinary`)

**Check first:** Context7 `/cloudinary-community/next-cloudinary` (components) and `/cloudinary/cloudinary_npm` (server SDK). All user image uploads and delivery go through Cloudinary; the DB stores only `url` + `public_id`. The API secret lives only in `src/lib/cloudinary.ts` and `/api/sign-cloudinary` (see `architecture.md` → Key Patterns).

### Setup

```ts
// src/lib/cloudinary.ts — server-only
import { v2 as cloudinary } from 'cloudinary'
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})
export { cloudinary }
```

### Signed upload (client widget → server signature)

The widget requests a signature from our auth-guarded route, then uploads
directly to Cloudinary. On success, a server action records the row.

```tsx
'use client'
import { CldUploadWidget } from 'next-cloudinary'

<CldUploadWidget
  signatureEndpoint="/api/sign-cloudinary"
  options={{ folder: `nextbnb/listings/${listingId}`, multiple: true, maxFiles: 15 }}
  onSuccess={(result) => {
    const info = result?.info as { public_id: string; secure_url: string }
    // call server action: addListingPhoto({ listingId, publicId: info.public_id, url: info.secure_url })
  }}
>
  {({ open }) => <button type="button" onClick={() => open()}>Upload photos</button>}
</CldUploadWidget>
```

### Responsive, optimized delivery

Always render Cloudinary assets with `CldImage` (never a bare `<img>`), and
always pass `sizes` so the right width is delivered per breakpoint.

```tsx
import { CldImage } from 'next-cloudinary'

<CldImage
  src={photo.public_id}          // Cloudinary public_id
  width={960} height={640}
  sizes="(max-width: 744px) 100vw, (max-width: 1128px) 50vw, 25vw"
  crop="fill" gravity="auto"
  format="auto" quality="auto"   // f_auto / q_auto
  alt={listing.title}
/>
```

### Delete

```ts
// inside the delete server action, for rows where public_id is set:
import { cloudinary } from '@/lib/cloudinary'
await cloudinary.uploader.destroy(publicId, { invalidate: true })
```

### Environment — three public values, one secret

> **`CldUploadWidget` needs `NEXT_PUBLIC_CLOUDINARY_API_KEY` as well as
> `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`** (found in F09). The widget uploads from
> the browser and sends the `api_key` with the request so Cloudinary knows which
> account the signature belongs to. Without it the widget throws *"A Cloudinary
> API Key is required for signed requests"* — and because it throws during
> render, the **whole route 500s** rather than the button simply not working.
>
> This is safe and is Cloudinary's design: the `api_key` is a public identifier
> that appears in every browser upload, while `CLOUDINARY_API_SECRET` — the value
> that actually authorises anything — stays server-side in
> `/api/sign-cloudinary`. Duplicate the key's value into the `NEXT_PUBLIC_`
> variable; never the secret.
>
> **Both `CldImage` and `CldUploadWidget` throw on missing config rather than
> degrading**, so guard on the env vars before rendering either (see
> `ListingImage` and `PhotoManager`). `CldImage` also calls `useState`, so it is
> a **Client Component** — importing it into a Server Component fails with
> *"useState only works in Client Components"*.

**Rules:**
- The API secret never reaches the client — uploads are signed by `/api/sign-cloudinary`, which verifies the user, **whitelists the signable keys**, and confirms the `folder` (`nextbnb/listings/<id>`) belongs to a listing the caller owns before signing (see `architecture.md` → Key Patterns). Never sign a client-supplied `public_id`/`upload_preset`.
- The widget's `options.folder` is what gets signed; keep it exactly `nextbnb/listings/${listingId}` so the server's ownership check and the signature agree.
- Store both `secure_url` (as `url`) and `public_id`. Render from `public_id` via `CldImage`; only fall back to a raw `url` for seed/Unsplash rows where `public_id` is null.
- `sizes` is required on every `CldImage`, matching the component's responsive width (see the breakpoint map in `code-standards.md`).
- Enforce `MAX_PHOTOS_PER_LISTING` and basic type/size checks before opening the widget.
- Deleting a listing or photo must `destroy(public_id)` for Cloudinary-hosted images; skip rows with `public_id = null` (external Unsplash seeds).
- Seed images are curated `images.unsplash.com/photo-…` URLs — never the deprecated `source.unsplash.com/random` endpoint.

---

## Zod

**Check first:** Context7 `/colinhacks/zod`. Zod schemas are the single source of truth for every client input; they live in `src/lib/validations/<domain>.ts`.

> **The installed version is Zod 4** (`4.4.3`, added in F06). Context7's top hits are
> often the v3 docs, and two APIs differ in ways that matter here:
> `z.string().date()` / `.datetime()` are superseded by **`z.iso.date()` /
> `z.iso.datetime()`**, and `.flatten()` is deprecated in favour of
> `z.flattenError()`. `z.enum(READONLY_ARRAY)`, `.catch()`, `z.coerce.*` and
> `safeParse` behave the same as v3. Verify an API shape against the installed
> package before trusting a snippet.

### Setup

```ts
import { z } from 'zod'
import { PROPERTY_TYPES, AMENITIES, MAX_GUESTS } from '@/lib/constants'

export const createBookingSchema = z
  .object({
    listing_id: z.string().uuid(),
    check_in: z.coerce.date(),
    check_out: z.coerce.date(),
    guests_count: z.number().int().min(1).max(MAX_GUESTS),
  })
  .refine((v) => v.check_out > v.check_in, {
    message: 'Check-out must be after check-in',
    path: ['check_out'],
  })

export type CreateBookingInput = z.infer<typeof createBookingSchema>
```

### Validating in a server action

Use `safeParse` (never throw across the action boundary) and infer types from
the schema rather than declaring them twice.

```ts
const parsed = createListingSchema.safeParse(input)
if (!parsed.success) {
  // For forms, surface field errors. Zod 4: the top-level `z.flattenError()`,
  // not the deprecated `parsed.error.flatten()` method (see the version note above).
  const { fieldErrors } = z.flattenError(parsed.error)
  return { ok: false, error: 'Please fix the highlighted fields.' }
}
// parsed.data is fully typed
```

**Rules:**
- Every server action and route input is `safeParse`d before use — inputs are `unknown` until then.
- Derive TS types with `z.infer<typeof schema>`; never maintain a separate hand-written type for the same shape.
- Enums that mirror DB enums/constants use `z.enum(PROPERTY_TYPES)` / `z.enum(AMENITIES)` so they stay in sync with `constants.ts`.
- Use `z.flattenError(parsed.error).fieldErrors` when the caller is a form; return a single safe `error` string otherwise. **Not `parsed.error.flatten()`** — that method still exists in 4.4.3 but is deprecated; the top-level function returns the identical `{ formErrors, fieldErrors }` shape (verified against the installed package).

---

## react-hook-form

**Check first:** Context7 `/react-hook-form/react-hook-form`. Used for all multi-field forms (create/edit listing, booking widget). Pairs with Zod via `@hookform/resolvers`.

### Setup

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createListingSchema, type CreateListingInput } from '@/lib/validations/listings'

export function ListingForm() {
  const form = useForm<CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    defaultValues: { property_type: 'apartment', amenities: [], guests_count: 1 },
  })

  async function onSubmit(values: CreateListingInput) {
    const res = await createListing(values)      // server action
    if (!res.ok) form.setError('root', { message: res.error })
    // else: router.push / revalidation handles the redirect
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* fields */}</form>
}
```

**Rules:**
- The `resolver` uses the **same** Zod schema the server action validates with — client and server never diverge.
- On a failed `ActionResult`, map the error onto the form (`setError('root', …)` or a specific field); do not swallow it.
- Keep forms as leaf client components; the page around them stays a Server Component.

---

## date-fns

**Check first:** Context7 `/date-fns/date-fns`. Used for booking date math, nights calculation, availability ranges, and display formatting.

### Usage

```ts
import { differenceInCalendarDays, eachDayOfInterval, subDays, format, isBefore } from 'date-fns'

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return differenceInCalendarDays(checkOut, checkIn)
}

// Nights OCCUPIED by a booking — half-open [check_in, check_out): the checkout
// day is NOT occupied, so exclude it. eachDayOfInterval is inclusive of `end`,
// so pass checkOut - 1 day.
export function occupiedNights(checkIn: Date, checkOut: Date): Date[] {
  return eachDayOfInterval({ start: checkIn, end: subDays(checkOut, 1) })
}

// Blocked ranges are INCLUSIVE [start, end] — both ends are blocked.
export function blockedDays(start: Date, end: Date): Date[] {
  return eachDayOfInterval({ start, end })
}

// A booking is "completed" once its checkout day has passed:
const isCompleted = isBefore(checkOut, new Date())
```

**Rules:**
- Compute nights with `differenceInCalendarDays` (calendar days, half-open `[check_in, check_out)`), consistent with the DB `daterange(..., '[)')` exclusion constraint.
- `eachDayOfInterval` **includes the end date** — for booking occupancy (half-open) pass `subDays(checkOut, 1)`; for `blocked_dates` (inclusive) pass `end` as-is. Mixing these up double-blocks the checkout day.
- Treat dates as calendar dates (no time component) for availability; store `date` columns, not `timestamptz`, for `check_in`/`check_out`/`blocked_dates`.
- Format for display only at the edge (`format(...)`); keep `Date`/ISO strings internally.

---

## Tailwind CSS (v4) + design tokens

**Check first:** Context7 `/tailwindlabs/tailwindcss.com`. The design system is defined by `context/DESIGN.md`; encode its tokens once in the `@theme` block of `src/app/globals.css` and consume them as utilities. Full token/breakpoint rules are in `code-standards.md` → Design System & Responsive Standards.

### Tokens + custom breakpoints (`src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  /* Colors (DESIGN.md) */
  --color-primary: #ff385c;      /* Rausch — the only accent */
  --color-primary-active: #e00b41;
  --color-ink: #222222;
  --color-body: #3f3f3f;
  --color-muted: #6a6a6a;
  --color-hairline: #dddddd;
  --color-canvas: #ffffff;
  --color-surface-soft: #f7f7f7;
  --color-error: #c13515;

  /* Radii */
  --radius-sm: 8px;  --radius-md: 14px;  --radius-lg: 20px;  --radius-xl: 32px;

  /* Custom breakpoints — differ from Tailwind defaults so iPad maps cleanly */
  --breakpoint-tablet: 744px;
  --breakpoint-desktop: 1128px;
  --breakpoint-wide: 1440px;
}
```

### Font (Inter as the Cereal VF substitute)

```tsx
// src/app/layout.tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
// <html className={inter.variable}> and map --font-sans in @theme (--font-sans: var(--font-sans))
```

**Rules:**
- Use token utilities (`bg-primary`, `text-ink`, `rounded-md`); never hardcode a hex/size a token already covers.
- Rausch (`primary`) is reserved for primary CTAs, the search orb, and the saved-heart state — used scarcely.
- Compose conditional classes with `clsx` + `tailwind-merge`; do not concatenate class strings by hand.
- Mobile-first: default styles target `<744px`; layer `tablet:` / `desktop:` / `wide:` upward. Grids drop columns, never reflow rows. Verify every screen at all four breakpoints.

---
