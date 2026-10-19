# Architecture

> **Role:** Explain the system's responsibilities and the rules that must always hold. Read after the product overview in every session.

## Stack

The browser handles interaction. Next.js renders pages and handles server actions. Supabase stores the data and enforces access rules. Cloudinary stores user-uploaded images. The application deploys as a Node service on Render.

| Responsibility | Project choice |
| --- | --- |
| Language and runtime | TypeScript ≥5.1 in strict mode; Node ≥20.9, pinned to the Node 20 line in `.nvmrc` |
| Framework and UI | Next.js 16 App Router; React 19 |
| Server operations | Next.js Server Components, server actions and two HTTP handlers |
| Package manager | npm, with exact resolutions in `package-lock.json` |
| Database and authorization | Supabase Postgres, Row Level Security and column grants |
| Sign-in | Supabase Auth with Google OAuth and cookie sessions |
| Images | Cloudinary for uploads; direct Unsplash URLs for sample data |
| Live messages | Supabase Realtime on `messages` |
| Validation and forms | Zod 4; react-hook-form where a multi-field form needs it |
| Dates | date-fns; booking dates are calendar dates |
| Styling and icons | Tailwind CSS v4, Inter, lucide-react |
| Testing | Vitest, Playwright and SQL verification scripts |
| Lint and formatting | ESLint; no separate formatter is declared in the manifest |
| Hosting | Render Web Service: build, then start |

No product AI integration or analytics service is declared in the inspected manifest or existing architecture. This rewrite adds neither. Dependency ranges and exact local resolutions are in the [Library guide](library-docs.md#dependency-versions); they are not a claim that vendor APIs were rechecked today.

## System boundaries

| Location | Responsibility |
| --- | --- |
| `src/app/` | Routes, layouts and page composition; reads are delegated to query modules |
| `src/app/**/route.ts` | OAuth callback and upload signing; no page UI |
| `src/components/ui/` | Reusable presentation and interaction primitives; no database or business rules |
| `src/components/<domain>/` | Feature UI and calls to server actions |
| `src/lib/supabase/` | Supabase client construction and session-refresh plumbing |
| `src/lib/queries/` | Server-only reads and typed view models |
| `src/lib/actions/` | Authenticated, validated writes |
| `src/lib/validations/` | Shared input schemas |
| `src/lib/hooks/` | Browser behavior such as dismissal and focus management; no fetching, database access or business rules |
| `src/lib/cloudinary.ts` | Server-only SDK configuration and asset operations |
| `src/lib/constants.ts` | Shared property types, amenities, fees and limits |
| `src/types/database.types.ts` | Database row and enum types generated from the schema |
| `src/proxy.ts` | Request interception; delegates session work to `src/lib/supabase/middleware.ts` |
| `supabase/` | SQL migrations, seed data and SQL verification |

The upload-signing route has one deliberate inline ownership read. That check authorizes the signature it is about to issue. It is the documented exception to read queries living in `lib/queries/`. Some actions also read the records needed to authorize and validate their write; the boundary separates page reads from writes, not every individual database statement. See D-003 and D-016.

## Data flow

A page reads through a server-only query and renders the result. Database policies decide which rows the caller can see. A failed read logs the internal error and returns the documented safe empty or unavailable result.

For a write, a component calls a server action. The action validates the input, verifies the signed-in user, checks the relevant business rules, writes the change, and invalidates affected pages. It returns an `ActionResult` with either data or a safe error message. Sign-in and sign-out are navigation-only exceptions: they redirect and return no result value. See D-004 and D-017.

For a photo, the server authorizes an upload signature for a listing the caller owns. The browser uploads directly to Cloudinary. A server action saves the photo's URL and `public_id`. Deletion also removes the Cloudinary asset when one exists.

For messaging, the server creates threads and writes messages. The open thread receives new messages through a subscription authorized with the user's session. The inbox itself is server-rendered. See D-030.

## Data model

The nine tables are `profiles`, `listings`, `listing_photos`, `bookings`, `blocked_dates`, `favorites`, `reviews`, `message_threads` and `messages`. A profile is shared by guest and host behavior; hosting is not a separate account type.

Listings belong to hosts. Bookings connect a guest to a listing and retain the price accepted at reservation time. Photos and blocked dates belong to listings. A favorite connects a user and a listing. A review belongs to a completed booking. A thread connects a guest and host, optionally about a listing; its messages belong to that thread.

Money is stored in integer cents. Booking status is `confirmed` or `cancelled`; completion is derived from the checkout date. Sample photos have no Cloudinary `public_id` and use the external-image rendering branch.

The complete original column tables, policy matrix and grants are preserved in [Schema and policy notes](../docs/reference/architecture-notes.md). Treat them as a dated explanation; migrations and generated types establish the current schema. Read the actual foreign-key actions before changing any deletion path. See D-005, D-008 and D-023.

## Access and privacy

Row Level Security (RLS) is a database feature that restricts which rows a caller can read or change. Column grants separately restrict which fields they may write. Both matter: permission to update a profile row must not permit changing `is_admin`.

Authenticated writes to sensitive rows are limited to these columns; their row policies still apply:

| Table | Writable columns |
| --- | --- |
| `profiles` | `full_name`, `avatar_url`; never `is_admin` |
| `bookings` | `status`, `cancelled_at`; never the dates or price snapshot |
| `message_threads` | `last_message_at` |
| `messages` | `read_at`; never the message body |

Profiles are public so host and reviewer names can display. Email stays in `auth.users`; the admin user list gets only IDs and emails through the guarded `admin_list_users()` function. The service-role key is reserved for standalone seed and migration scripts, never application requests.

Availability needs narrow database functions because visitors cannot read other guests' bookings. `unavailable_listing_ids()` answers search availability and `listing_occupied_ranges()` supplies a listing's calendar. They expose availability for published listings without returning private booking rows. `admin_unpublish_listing()` changes only publication state; widening an admin UPDATE policy would permit changing unrelated listing fields. These four task-specific helpers are distinct from the `is_admin()` policy helper and the signup trigger. See D-006, D-009 and D-033.

The app offers Google sign-in. The last recorded project configuration also enabled an email/password provider for the test accounts; that configuration gap remains open. Admin access is checked in the route and database, and sensitive admin actions re-check the role. Private message threads are limited to participants, including when the caller is an admin.

## Availability and booking

A booking occupies its check-in date through the night before checkout: `[check_in, check_out)`. Another guest may check in on the checkout day. Host blocks include both their start and end dates. When combining the two range models, convert an inclusive block's end to the following day. See D-007.

A new booking must meet the listing's minimum nights and guest capacity, start today or later, and avoid both confirmed bookings and blocked dates. The database prevents overlapping confirmed bookings. Rules involving listing fields or blocked-date rows also need checks in the action; the accepted block/booking race is described in Standing constraints.

A guest can cancel a confirmed booking while `check_in >= current_date`. This includes the check-in day, not later days of an in-progress stay. Cancellation changes status and records its time. Admin cancellation has a wider policy. A review becomes eligible only after the checkout date has passed. Prices are never recalculated after booking. See D-008, D-010 and D-011.

## Authentication and uploads

Session checks on the server use `getUser()`. The proxy refreshes cookies and guards signed-in routes; `/admin` checks the admin flag in the page so ordinary requests do not pay for an extra role query. Return the response carrying refreshed cookies rather than replacing it. Missing Supabase configuration must fail visibly rather than disable route protection. See D-012.

Sign-in begins on the server, returns through `/auth/callback`, and uses `safeNextPath` to reject unsafe return destinations. On Render, the callback accounts for the forwarded host. Provider error text is stripped to letters/underscores and limited to 64 characters before logging; OAuth authorization codes are never logged. M1 is present in the checkout and merged as PR #6; whether GitHub has closed the alert was not checked. See D-013 and D-037.

Three settings must agree during deployment: Google's redirect points to Supabase; Supabase's allowed return URL points to the app callback; and `NEXT_PUBLIC_SITE_URL` is the app's origin, without `/auth/callback`. Public environment values are built into the artifact, so fixing a value requires rebuilding. The [Render runbook](../docs/deploy-render.md) explains the checks. See D-014.

The upload-signing route verifies the user, permits only the intended signing parameters, and confirms the folder belongs to their listing. It signs the validated parameters as received. Image rendering uses the shared `ListingImage` component: Cloudinary assets use `CldImage`; external seed images use `next/image`; missing Cloudinary configuration falls back to the stored URL. See D-015.

## Invariants

Each sentence below is a rule to check whenever the affected behavior changes. Its reason is explained above or in essential Standing constraints.

- Supabase clients are constructed only within `src/lib/supabase/`.
- Application writes go through authenticated, validated server actions in `src/lib/actions/`.
- Components never write directly to the database.
- Every mutating server action validates its input with its Zod schema and verifies its user before writing.
- Every application table has RLS policies, and authorization never relies on application code alone.
- Restrictions on writable columns are enforced with database privileges as well as policies.
- Server authorization uses `getUser()`, not an unverified session value.
- Post-authentication return paths pass through `safeNextPath` before use.
- Missing Supabase configuration never turns protected-route checks into a silent no-op.
- Two confirmed bookings for the same listing never overlap.
- A booking's nights and price fields remain the snapshot written at creation.
- Money is stored and calculated in integer cents, with fees rounded half-up to whole cents.
- Every availability calculation considers both confirmed bookings and host blocks using their defined date boundaries.
- Guest-facing availability uses the database availability helpers rather than a bookings read filtered by the guest's permissions.
- A host never books their own listing.
- Signed photo uploads target only the caller's owned listing and never expose the API secret.
- Reviews are created only by the booking's guest, only after checkout has passed, and at most once per booking.
- Search exposes only published listings, while hosts and admins may inspect permitted drafts.
- Private threads and messages are readable and writable only by their participants, subject to the recorded thread-creation limitation.
- Admin-only screens and operations verify the admin role at their applicable route, action and database boundaries.
- An admin action whose database policy also admits hosts re-checks admin status before using its broader capability.
- Admin unpublishing uses the narrow database helper rather than a direct listing UPDATE.
- Database row types come from the generated database types rather than duplicate handwritten columns.
- Secret values never reach browser components, public environment variables or documentation.
- Deleting a listing or photo also removes any associated Cloudinary asset with a real `public_id`.
- Cloudinary images use `CldImage` with responsive sizes and automatic delivery transforms when configured.
- Visual values follow the design tokens in `context/DESIGN.md` and `globals.css`.
- Rausch is the only product accent, and ratings use ink rather than gold.
- Every screen is built mobile-first and checked at the documented breakpoints.

## How this file is maintained

Update boundaries and invariants when an approved change alters them. Keep consequential choices and reasons in their one decision record. Update the affected standards, library guide, work notes and tracker together. Keep task-specific column lists and historical diagnoses out of essential reading; link to their preserved detail. Do not describe a dated remote observation as a fresh measurement.
