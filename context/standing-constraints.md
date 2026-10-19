# Standing constraints

> **Role:** Explain accepted tradeoffs, known limitations and non-obvious rules that affect future work. Read every session, before code standards.

## How this file is maintained

This is the current home for active constraints. Record an approved rule with its reason and source, linking to its authoritative decision record. When the choice changes, update its governing rule and preserve the former choice as superseded or historical. Age alone does not make an old decision a constraint.

The original [Build journal](build-journal.md) remains unchanged for this rewrite. Its Standing Constraints section is the preserved source of these explanations, not a second current policy to maintain. The [Decision records](decisions.md) distinguish confirmed choices from untested observations. Put new unresolved choices in the tracker's Open Questions.

## Access and authorization

RLS may hide a row without returning an error. Before computing a result from a table, check what the least privileged reader can see. Guests cannot infer availability from their own bookings read. Use the availability helpers. A query must also ask the right question: bookings are visible to guests, hosts and admins, so Trips filters by guest, while host reservations filters by owned listings. See D-006, D-009 and D-055; original evidence: F06, F13 and F14.

An UPDATE or DELETE denied by RLS can affect zero rows and report no error. When that would mean refusal, return the changed row and check it. A denied INSERT instead raises an error. Read receipts are an exception: updating zero unread messages is normal, so a missing change is not a failure. Genuine receipt errors log but do not stop the thread. See D-024 and D-031; F13–F16.

The message-thread INSERT policy is broader than the app's intended behavior: it can accept a participant creating a thread with an arbitrary other guest. The action derives the participants and does not offer that behavior, but the policy itself has not been tightened. Do not describe RLS as independently enforcing this part of the contract. This is a recorded limitation, not a newly verified exploit; F16 contains the original reasoning.

Admins cannot read conversations, edit roles, delete user profiles or republish listings through the admin UI. Profile grants and deletion privileges deliberately restrict role editing and user deletion. Republishing remains the host's job so the photo guard has one owner. Admin tables show at most 200 rows each, ordered with newer records first, without a truncation notice. Pagination is not implemented. See D-033–D-035 and D-056; F17.

## Booking, availability and deletion

Booking ranges exclude checkout day; blocked ranges include their end date. Fees round half-up in cents. The database prevents two confirmed bookings from overlapping; cross-table checks such as host blocks and per-listing capacity also depend on the action. See D-005, D-007 and D-008.

The date picker's occupied-day buttons prevent selecting another guest's check-in day as your checkout day, even though the underlying half-open range permits it. Checking in on another guest's checkout day does work. The UI therefore leaves a boundary night unreachable in one direction; F12 records the limitation.

A booking and a host block can race after either action's read. There is no cross-table exclusion constraint. This race has been reasoned about, not deliberately reproduced; the accepted outcome leaves the stay intact and the union unavailable to others. A host cannot add a block over a booking already visible to the check. Blocks are removed and re-added rather than edited; their UPDATE policy is unused. See D-028 and D-057; F11–F12.

Hosts cannot cancel or decline guest bookings. The booking UPDATE policy admits the guest and admins, not the host. Adding host cancellation needs a schema-policy change as well as UI. See D-043; F14.

Deleting a listing cascades to bookings and reviews. The host action refuses while protected upcoming/in-progress reservations exist and suggests unpublishing. Its date guard is widened by one day so timezone disagreement errs toward refusing a delete. Admin deletion intentionally has a separate, broader path; its confirmation names the records that will disappear. Inspect foreign-key actions before adding any delete path. See D-023 and D-034; F10 and F17.

A separate schema issue affects conversations: deleting a listing sets its thread's listing ID to null, while the thread uniqueness constraint treats nulls as equal. Deleting two listings with threads between the same participants can make the second deletion fail. This inherited limitation also affects admin deletion; fixing it needs a migration. Test teardown avoids it by clearing threads first. F16–F17 preserve the analysis.

## Authentication and deployment

The free Supabase project's keep-alive runs outside Render in cron-job.org every three calendar days at 09:00 Asia/Kolkata, with shorter gaps possible at month boundaries. It queries one published listing using a publishable key and existing RLS. Keep the scheduler's key current after key rotation, and inspect its failure emails. This reduces inactivity risk but does not guarantee exemption from pausing; paid Supabase plans remove inactivity pausing. See D-069 and the [Setup record](work-notes.md#supabase-keep-alive-2026-10-19).

Google is the only sign-in method offered by the app. The last recorded Supabase configuration also enabled email/password sign-in for test fixtures and permitted email registration through its Auth API. Email confirmation is required, and no admin grant follows from registering. Disabling signup globally would also block new Google users. A separate test project is the recorded intended remedy, still open. See D-025; Phase 1 close-out and F18.

Changing a public environment value requires a new build. Probe the redirect the built application actually produces; a healthy homepage does not prove sign-in works. Three separate redirect settings must agree. See D-014; F18.

## Images and forms

Images uploaded by users live in Cloudinary. Seed photos are external Unsplash URLs with no `public_id`; they use `next/image`. All 24 published seed listings took this external branch during the last deployment checks. Cloudinary transform delivery on the deployed site has therefore not been established by those checks. See D-015, D-044 and D-045; F09 and F18.

Cloudinary's API key identifies the account and is public; its API secret authorizes signing and remains server-only. Missing widget/image configuration can throw during rendering, so the shared components guard it and fall back where possible. A fallback delivery URL does not prove transforms work. See D-044; F09 follow-up.

A form schema used by both client and server must accept its own parsed output. Nullable optional text caused an earlier double-validation failure. Keep the round-trip schema tests. Editing a server-rendered react-hook-form before hydration can also lose the edit; F10 records that behavior. See D-027.

## Messaging

Only the open conversation receives live messages. The inbox neither reorders nor gains a new unread indicator until revisited. A guest initiates from a listing; a host can only reply through the current UI. Adding a host entry point would not itself require a policy migration. Creating a thread happens on click, so a guest who never sends leaves an empty thread. See D-030 and D-032; F16.

The browser subscription must carry the session before subscribing. An anonymous socket can connect successfully yet receive nothing under RLS. Inbox-ordering tests must wait for the timestamp update they assert, not merely the earlier message INSERT. That test race was fixed in F19; it is distinct from the open homepage image race. See D-030 and D-058.

## Rendering, design and accessibility

Routes that can return a true 404 have no `loading.tsx` wrapper. Streaming can commit a 200 before the missing-resource result is known. Preserve the measured behavior rather than adding a skeleton by convention. See D-036; F07.

The host listing grid deliberately has no Suspense boundary. Its production refresh previously left rows stale and controls disabled after successful writes, while development tests passed. Do not restore that boundary without reproducing and testing the production behavior. See D-042; F19.

Use the NextBnb design system and its custom breakpoints. Do not import Airbnb's extra products, branding, sub-brand palettes or map features from the original reference analysis. See D-020 and D-021.

The calendar uses ordinary buttons, with about 60 tab stops across two months. A roving-focus grid was deliberately deferred because replacing the primitive affects three features and several test files. It was never implemented; older notes suggesting otherwise are corrected in the journal. See D-041; F18.

The skip link must move actual DOM focus to `main`, which needs `tabIndex={-1}`. The next Tab moving into content does not prove this in Chromium. Its reveal currently depends on Tailwind utility emission order; if that changes, use an off-screen position that does not switch positioning modes. Existing focus evidence is Chromium-only; Safari/WebKit behavior and spoken announcements remain unverified. See D-038–D-040; F20–F21.

## Testing limits and environment notes

Two users are needed to test ownership boundaries; the owner alone cannot prove another user is excluded. Only one spec file may own the shared admin flag, and it must revoke the flag in both `finally` and global teardown. See D-025 and D-026.

A test passing is insufficient evidence that it protects a rule. Remove the relevant guard or behavior and establish that the assertion fails for that reason. Use a positive control for a denial test. A different database constraint can mask the application guard you intended to test. See D-022; F08, F11 and F12.

Playwright normally runs against development mode. Periodic production runs remain necessary; the last recorded production run predates the latest added tests. The current suite uses Chromium only. Test fixtures use fabricated Cloudinary IDs and never perform real uploads, so image-not-found noise and attempted destroys do not prove successful asset delivery or deletion. See D-042 and D-046.

The original journal's Untested branches section lists additional cases not induced by the suite: action/query error paths, forged requests, true overlaps arriving between checks, subscription failure, orphaned thread display, successful real-asset destruction, consent cancellation, and some admin focus paths. Read it before changing those behaviors. Untested is a description of evidence, not a diagnosis of a defect.

An extra lockfile outside this repository once produced Next.js's multiple-lockfile warning. It was judged cosmetic and left outside scope. Do not modify files outside the project to clear that historical warning without a separate reason. Original source: Runtime & environment in the journal.
