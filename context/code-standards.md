# Code standards

> **Role:** Define the conventions used for every change. Read after Standing constraints in every session.

## Working approach

Understand the behavior and its boundaries before editing. Keep a change within the requested scope, finish one work item before starting another, and choose code a future maintainer can follow. Handle foreseeable failure deliberately. Use `/architect` for meaningful features and unresolved choices, and `/remember` with the information locations in `CLAUDE.md`.

The existing workflow remains in place: every feature needs relevant automated tests; every completed change updates status and records its decisions, gotchas and checks. The journal is not compacted. This rewrite alone leaves it untouched at the user's request and records completion in [Work notes](work-notes.md). See D-053 and D-067.

## TypeScript

Keep strict mode enabled. Use `unknown` until input is validated and narrowed; do not introduce implicit `any`. Prefer type aliases for data shapes and interfaces when an extensible contract needs one. Derive database row and enum types from the generated file. See D-019.

Await promises or explicitly discard them with `void`. Prefer `const`, avoid mutating shared data or parameters, and handle union branches exhaustively where practical. Non-null assertions are restricted to environment values at the existing Supabase/SDK construction and signing boundaries; handle missing values explicitly elsewhere.

## Next.js conventions

Use Server Components by default. Add a client boundary only for interaction, browser APIs, state, effects or subscriptions, and keep it near the leaves. Page reads use query modules rather than effects. Writes use server actions; revalidate every route whose rendered data changed.

Await framework request values such as params, search params, cookies and headers in this project. Request interception is `src/proxy.ts`; the library helper remains `src/lib/supabase/middleware.ts`. Keep search filters in the URL. Do not add Cache Components or `use cache` to the authenticated, cookie-dependent pages. See D-002 and D-018.

Provide appropriate error and loading states, but do not add `loading.tsx` to a route that can return a true 404. Preserve the host-grid production refresh exception in Standing constraints. Server-only imports and secrets never cross into client components. See D-036 and D-042.

## Files, exports and imports

Use kebab-case folders, PascalCase component files and camelCase non-component modules. Name domain modules for their domain, such as `bookings.ts`, and schema exports with a `Schema` suffix. Framework route filenames follow framework conventions.

Use one primary named export per file; framework-required defaults are the exception. `proxy` is a named export. Avoid barrel re-export files. Arrange a component as imports, types, the component, then small local helpers. A named `Props` type and destructured props keep the public shape easy to find.

Import packages first, then internal modules through `@/`, with type-only imports using `import type`. Import the Supabase factory that matches the runtime. Never construct another client elsewhere. See D-003.

## Boundary patterns

A server action validates unknown input, verifies the user, checks the business rules, performs its write and revalidates affected routes, in that order. Expected failures return `ActionResult` with a user-safe message. Navigation-only auth actions redirect and return no value; do not catch a framework redirect accidentally. See D-004 and D-017.

A read query is server-only, performs no writes, logs internal failures with its source prefix and returns its documented safe value. A failed availability lookup must not look like verified free dates. Keep route handlers thin. The upload-signing route's inline ownership read is a deliberate exception, not permission to scatter page reads. Actual examples live in source; start with the [Library guide](library-docs.md).

## Errors and logs

Show safe, useful messages for validation, lack of access or unavailable dates. Never expose raw database errors, stack traces or another user's identifiers. Use bracketed log prefixes such as `[actions/bookings]`, `[queries/listings]` and `[auth/callback]`, including the operation and internal error.

Return expected failures as results. Throw only for programmer errors or unexpected conditions that the boundary is designed to handle. Check the row result for RLS-scoped UPDATE/DELETE operations when zero rows means refusal; do not apply that rule blindly to an idempotent read receipt. Sanitize untrusted provider error text before logging. See D-024, D-031 and D-037.

## Shared values and comments

Import property types, amenities, fees, guest limits and photo limits from `src/lib/constants.ts`. Do not duplicate them in components or validations. Keep the database property-type enum in sync with those constants. The seed's historical fee snapshot is an intentional exception; changing today's fee must not rewrite old prices. See D-005 and D-045.

Comments should explain a reason a reader cannot infer from the code. Remove commented-out code and redundant narration. A code TODO names the specific pending work and what would unblock it. Documentation TODOs also need a pointer from essential Open Questions.

## Design and accessibility

Use the tokens and component rules in [Design system](DESIGN.md). Build mobile-first and verify phone, tablet, laptop and wide layouts at the specified lower boundaries. Do not add off-palette colors or shrink touch targets below 44px. Use the shared image component and responsive `sizes`.

Use native elements with appropriate roles and names. A bare div or span cannot gain a useful accessible name merely by adding `aria-label`. Test computed roles and names with role-based queries rather than just checking an attribute. Decorative icons are hidden from assistive technology; icon-only buttons have a label on the button. See D-039.

Mount a polite live region before changing its content. An error alert mounted with its message is the existing exception. Test actual focus movement, restore focus on dismissal, and trap it only for modal surfaces. Keep the skip-link focus assertion; the following Tab location alone cannot prove focus landed. See D-038 and D-040.

Before adding navigation or repeated controls, check their accessible names across the whole page. Distinct navigation landmarks need distinct labels. Avoid accidental duplicate link names, including substring matches used by test locators. Geometry assertions must compare positions from the same frame and retry until settled; being in the viewport does not prove an element is unobscured by fixed chrome. Original examples are retained in [Engineering notes](../docs/reference/engineering-notes.md).

## Testing

Use Vitest for pure pricing, fee rounding, date/range helpers and validation schemas. Use Playwright for sign-in gates, discovery, reservations/cancellation, hosting, availability, reviews, messages, admin controls, keyboard behavior and responsive layouts. A feature is complete only when its relevant tests pass. See D-022.

Run each new assertion against deliberately broken behavior and confirm it fails for the intended reason. A denial test needs a valid positive control. Keep schema round-trip tests where parsed form values are validated again on the server. Choose fee values that distinguish rounding from truncation. See D-022 and D-027.

Use the seeded test setup and verify its expected data before E2E. Use both fixture users for ownership-dependent behavior. Only one spec file owns a shared admin flag, with cleanup in `finally` and teardown. Never leave a fixture account privileged. Mock external upload/OAuth behavior in automated tests rather than contacting real providers. Run against a production build periodically; development mode alone missed a shipped refresh defect. See D-025, D-026, D-042 and D-046.

Run checks touched by the change and compare with the tracker. Do not update recorded baselines without investigating differences. Full-suite runs matter for shared layout changes because they affect other pages and locators. The documentation checker has its own failure-detection tests; it does not replace product tests.

## Environment Variables

Use `.env.local` locally and the Render dashboard in production. Document a new variable here and in `.env.example` before using it. Never hardcode credentials or put secret values in documentation.

| Variable | Visibility and purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key; database policies still apply |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret; standalone seed/migration scripts only, never a request path |
| `NEXT_PUBLIC_SITE_URL` | Public app origin used to build the OAuth callback |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public account name for delivery/uploads |
| `CLOUDINARY_API_KEY` | Public account identifier, read by server SDK configuration |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | The same public identifier, needed by the browser upload widget |
| `CLOUDINARY_API_SECRET` | Secret used only on the server to sign uploads |

The Cloudinary key is public by design; the secret authorizes signing. The signature route authenticates the caller and checks ownership before returning a signature. Public environment values are inlined at build time. See D-014, D-015 and D-044.

## Dependencies and library guidance

Use the existing stack before adding a package. A new dependency needs a reason, a maintained typed package, a runtime/bundle assessment, and an update to the approved dependency inventory in [Library guide](library-docs.md#dependency-versions) before installation. No dependencies are installed during context setup. Existing manifest ranges are retained in this rewrite.

Check Context7 and relevant available service tools for current APIs, then the project-specific library guidance. Official docs may resolve missing or ambiguous coverage when that fallback is recorded. Check tool availability rather than assuming a configured server is callable. If current evidence is unavailable, mark the dependent API guidance unverified and continue independent work. See D-052 and D-068.

## How this file is maintained

Update a rule when approved behavior or a recurring implementation pattern changes. Put a general lesson here when it applies beyond the original component, and retain the original explanation through a decision/history link. Record consequential changes with an ID and reason; keep completion details in work notes. Run the documentation checker after editing this file.
