# Library guide

> **Role:** Locate NextBnb's integration code, dependency versions and documentation evidence. Read the relevant section before changing an integration.

## Evidence and limits

This guide describes the repository inspected on 2026-10-19. Its dependency ranges come from `package.json`; exact resolutions below come from `package-lock.json`. These are local facts, not newly selected versions.

Context7 is not callable in this session. No vendor API example has been refreshed or certified as current during this rewrite. The old examples are preserved in [Historical library examples](../docs/reference/library-examples.md) for their original explanations; do not copy them without checking their version and shape. For example, the old illustrative booking schema does not match the camelCase fields and ISO date strings in the real schema.

TODO: verify the documented integration APIs through Context7 before adding or refreshing copyable library examples.

Before changing an integration, check whether Context7 and the relevant service tools are available. Verify current API behavior there, use official documentation only for missing or ambiguous coverage, and record the documentation version, URL or library ID, date, and any fallback. If Context7 remains unavailable, stop the dependent API-guidance work and continue tasks that do not need it. See D-052 and D-068.

## Supabase clients, reads and auth

Start with [Server client](../src/lib/supabase/server.ts), [Browser client](../src/lib/supabase/client.ts), [Session refresh](../src/lib/supabase/middleware.ts) and [Proxy](../src/proxy.ts). They contain the runtime-specific cookie behavior and database generic. Keep construction within this directory. A Server Component cannot write cookies; the proxy/server-action path handles the refresh.

Page reads belong in [Query modules](../src/lib/queries). Read the actual select shape before changing a view model. Availability is deliberately delegated to the database helpers because a guest cannot read other guests' private bookings. Shared invariants and exceptions are in Architecture and Standing constraints.

For sign-in, read [Auth actions](../src/lib/actions/auth.ts) and [Callback handler](../src/app/auth/callback/route.ts). Check the sanitized return path, server-side flow, cookie response and production origin handling as one contract. Do not replace a verified user check with a locally held session value.

Current lookup hints retained from the previous guide: `/supabase/ssr` for cookies and `/supabase/supabase` for queries/auth. These identifiers are lookup starting points, not evidence of a fresh query. Regenerate [Database types](../src/types/database.types.ts) after every schema change.

## Messaging

Read [Message actions](../src/lib/actions/messages.ts), [Message queries](../src/lib/queries/messages.ts) and the components under [Messages](../src/components/messages). Sending, updating the inbox timestamp and receiving an event are separate operations. A test asserting inbox order must wait for the timestamp, not merely the earlier message row.

The open thread uses the signed-in session for its subscription and cleans up on unmount. The inbox has no continuous live subscription. Read receipts deliberately succeed when there was nothing unread. Preserve those contracts when checking the current Supabase APIs.

## Cloudinary

Read [SDK configuration and deletion](../src/lib/cloudinary.ts), [Signing handler](../src/app/api/sign-cloudinary/route.ts), [Shared image renderer](../src/components/ui/ListingImage.tsx) and [Photo manager](../src/components/host/PhotoManager.tsx).

The signing route verifies the caller, permits only approved parameters and checks listing ownership. The widget uploads directly; a server action records the URL and asset ID. Cloudinary assets and external seed URLs use different rendering branches. Missing configuration must not take down an otherwise readable listing.

The browser-visible API key identifies the account; the API secret stays server-only. See Code standards → Environment Variables. Historical lookup hints are `/cloudinary-community/next-cloudinary` and `/cloudinary/cloudinary_npm`; re-resolve them before treating them as documentation evidence.

## Zod and forms

Read [Validation modules](../src/lib/validations), especially [Booking validation](../src/lib/validations/bookings.ts) and [Listing validation](../src/lib/validations/listings.ts), with their call sites. The real booking input uses `listingId`, `checkIn`, `checkOut` and `guests`. Dates are calendar-date strings. The action maps those inputs to database columns.

Forms and server actions share schemas. A schema must accept its own parsed output, including normalized nulls. A library example using an older Zod version or a different row shape is not a substitute for these contracts. For multi-field form state, inspect [Listing form](../src/components/host/ListingForm.tsx); simpler controls may use local state instead.

Historical lookup hints are `/colinhacks/zod` and `/react-hook-form/react-hook-form`. Record version-specific evidence before updating an example or resolver pattern.

## Dates, styling and fonts

Read [Pure helpers](../src/lib/utils.ts) for pricing and calendar-date behavior. Keep checkout-exclusive booking ranges distinct from inclusive host blocks. Date validation in a shared schema and a server-only time check have different jobs; do not accidentally evaluate the booking deadline twice at different moments.

Read [Theme](../src/app/globals.css) and [Root layout](../src/app/layout.tsx) for tokens and Inter setup. The actual font variable is `--font-inter`. Use the custom breakpoints in DESIGN.md rather than Tailwind defaults.

Historical lookup hints are `/date-fns/date-fns` and `/tailwindlabs/tailwindcss.com`. No new library-call example is supplied here while current documentation is unavailable.

## Dependency versions

The following is the existing approved inventory, including development tools. Updating a range requires the dependency review in Code standards and an updated evidence record. Do not install packages during context setup.

| Package | Manifest range | Lockfile resolution |
| --- | --- | --- |
| `@hookform/resolvers` | `5.4.0` | `5.4.0` |
| `@supabase/ssr` | `^0.12.3` | `0.12.3` |
| `@supabase/supabase-js` | `^2.48.1` | `2.110.8` |
| `cloudinary` | `^2.5.1` | `2.10.0` |
| `clsx` | `^2.1.1` | `2.1.1` |
| `date-fns` | `^4.1.0` | `4.4.0` |
| `lucide-react` | `^0.469.0` | `0.469.0` |
| `next` | `^16.0.0` | `16.2.11` |
| `next-cloudinary` | `^6.17.5` | `6.17.5` |
| `react` | `^19.0.0` | `19.2.8` |
| `react-dom` | `^19.0.0` | `19.2.8` |
| `react-hook-form` | `^7.83.0` | `7.83.0` |
| `server-only` | `^0.0.1` | `0.0.1` |
| `tailwind-merge` | `^2.6.0` | `2.6.1` |
| `zod` | `^4.4.3` | `4.4.3` |
| `@playwright/test` | `^1.49.1` | `1.61.1` |
| `@tailwindcss/postcss` | `^4.0.0` | `4.3.3` |
| `@testing-library/jest-dom` | `^6.6.3` | `6.9.1` |
| `@testing-library/react` | `^16.1.0` | `16.3.2` |
| `@types/node` | `^20.17.12` | `20.19.43` |
| `@types/react` | `^19.0.4` | `19.2.17` |
| `@types/react-dom` | `^19.0.2` | `19.2.3` |
| `@vitejs/plugin-react` | `^4.3.4` | `4.7.0` |
| `eslint` | `^9.18.0` | `9.39.5` |
| `eslint-config-next` | `^16.0.0` | `16.2.11` |
| `jsdom` | `^25.0.1` | `25.0.1` |
| `tailwindcss` | `^4.0.0` | `4.3.3` |
| `typescript` | `^5.7.3` | `5.9.3` |
| `vitest` | `^3.0.0` | `3.2.7` |

## How this file is maintained

Keep the manifest range, lockfile resolution and documentation evidence distinct. After an approved dependency change, update this inventory from the files and record current API sources for the affected integration. Do not rewrite an old check date as today's date unless the documentation was actually queried. Keep unresolved API verification in the tracker's Open Questions. Preserve useful historical examples through the reference index rather than leaving stale snippets as copying guidance.
