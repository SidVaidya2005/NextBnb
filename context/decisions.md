# Decision records

> **Role:** Preserve one authoritative choice-and-reason record per decision ID. Read the relevant record when revisiting a choice; active rules and their short reasons remain in essential reading.

## How this file is maintained

Allocate the next unused `D-NNN` number across all declared homes, using at least three digits. Never reuse or renumber an ID. A record begins with the bold ID-and-choice bullet shown below; plain mentions elsewhere are references. Keep source feature labels such as F19 and M1 unchanged.

Record an approved choice and its reason when confirmed. Correcting its explanation keeps its ID. A materially changed choice gets a new record, with the former one marked superseded by the new ID and a reason. Retired choices retain their reason without needing a replacement. Move a record rather than copying it; update links and the current rule together.

Older entries are classified by purpose, not age. Key Decisions in the tracker contains at most ten recent references. Reasons below come from existing documentation or this session; they are not reconstructed motives. Original detailed reasoning remains in the [Build journal](build-journal.md#feature-log) and [indexed snapshots](../docs/reference/README.md). Facts and untested observations do not become decisions merely by receiving a label.

## Product and system decisions

- **D-069 — Check Supabase from cron-job.org every three calendar days.** Reason: The user chose fewer requests than the proposed six-hour or daily checks for this free portfolio demo. Reuse the existing scheduler and read at most one published listing with a publishable key, so the check reaches the database without waking Render or adding privileges, application routes or schema. Calendar scheduling can shorten the gap at month boundaries; activity does not guarantee exemption from Supabase's low-activity pausing policy. Source: User agreement and keep-alive setup, 2026-10-19. Classification: ongoing.

- **D-001 — Keep the marketplace scope focused.** Reason: Payments, maps, notifications, approvals, multiple currencies/languages and native apps were excluded so the build concentrates on discovery, reservations and hosting. Source: Product scope; original overview and F18. Classification: ongoing.

- **D-002 — Use Next.js 16 with a Node server.** Reason: Server-rendered reads and server actions share one application; Node ≥20.9 and async request APIs follow the chosen framework generation. Source: F01 and F04. Classification: ongoing.

- **D-003 — Keep runtime and responsibility boundaries explicit.** Reason: A single client-construction directory and separate page-query, action and presentation modules prevent session mixups and scattered data writes. Source: F01; Architecture → System Boundaries. Classification: ongoing.

- **D-004 — Validate and authorize server actions before writing.** Reason: Untrusted input and user identity must be checked before the database mutation; affected routes are revalidated and expected failures return safe results. Source: Architecture → Data Flow; Code Standards → Boundary Patterns. Classification: ongoing.

- **D-005 — Use integer cents for all monetary calculations.** Reason: Whole cents avoid stored floating-point currency; fees round half-up and shared constants own current rates. Source: F01, F03 and F12. Classification: ongoing.

- **D-006 — Use RLS together with column privileges.** Reason: Row policies cannot stop a permitted profile update from changing an admin flag; column grants restrict sensitive fields and outright revokes cover forbidden verbs. Source: F02; schema-verification.sql. Classification: ongoing.

- **D-007 — Use checkout-exclusive bookings and inclusive host blocks.** Reason: Guests may arrive on a previous checkout day; converting the block end by one day lets both range models compose without losing a blocked night. Source: F02, F06, F11 and F12. Classification: ongoing.

- **D-008 — Store reservation prices as immutable snapshots.** Reason: A later host price change must not alter the price a guest accepted; nights, rates, fees and total are written once. Source: F03 and F12. Classification: ongoing.

- **D-009 — Resolve public availability through narrow database helpers.** Reason: RLS hides other guests' bookings, so a normal guest/anonymous bookings read would silently treat occupied nights as free; helpers expose published availability without private rows. Source: F06 and F12. Classification: ongoing.

- **D-010 — Put guest cancellation eligibility in the database policy.** Reason: The policy enforces confirmed status and check-in day or later; the action checks whether the update actually changed a row. Admin cancellation remains wider. Source: F02 and F13. Classification: ongoing.

- **D-011 — Allow one review after a completed stay.** Reason: The guest and booking relationship determine eligibility, the unique booking key prevents duplicates and immutable review bodies require delete/re-post to change. Source: F02 and F15. Classification: ongoing.

- **D-012 — Refresh sessions in the proxy and verify server users.** Reason: The refreshed response carries cookies; silently skipping configuration or substituting an unverified session would undermine route protection. The admin page performs its separate role check. Source: F04. Classification: ongoing.

- **D-013 — Start OAuth on the server and sanitize return paths.** Reason: The server writes the PKCE verifier consumed by the callback; a safe local-path check rejects protocol-relative external destinations. Source: F04. Classification: ongoing.

- **D-014 — Keep three redirect settings aligned and rebuild public configuration.** Reason: Google returns to Supabase, Supabase returns to the app, and the app constructs its callback from its bare origin. Build-time public values require a redeploy; probing the produced redirect detects stale configuration. Source: F18 deploy follow-up. Classification: ongoing.

- **D-015 — Sign owned-listing uploads and centralize image rendering.** Reason: The server validates signable parameters and ownership; Cloudinary assets use the shared transform branch while external images and missing config use the stored URL branch. Source: F09 and F09 follow-up. Classification: ongoing.

- **D-016 — Keep the signing route's ownership read beside signing.** Reason: Authorization is that handler's single job, so its one inline listing read is the accepted exception to page reads in query modules. Source: Architecture → Key Patterns; Code Standards → Route handler. Classification: ongoing.

- **D-017 — Let navigation-only auth actions return no result.** Reason: Their outcome is a redirect, which interrupts control flow; wrapping it in an ActionResult or catching it would misrepresent the contract. Source: F04. Classification: ongoing.

- **D-018 — Keep applied migrations immutable.** Reason: Follow-up migrations preserve remote history; local filenames were corrected to the remote timestamp identities when branching exposed a mismatch. Source: F02 and its migration-version follow-up. Classification: ongoing.

- **D-019 — Generate database types from the schema.** Reason: Generated row and enum types keep query shapes aligned with migrations; every schema change regenerates them instead of maintaining duplicate column definitions. Source: F02 and F04. Classification: ongoing.

- **D-020 — Use the NextBnb visual system with Inter.** Reason: A white canvas, ink text, one Rausch accent and shared tokens provide consistency; Airbnb-only product structure and palettes are excluded. Source: F01 and Code Standards → Applying DESIGN.md. Classification: ongoing.

- **D-021 — Use custom device breakpoints and a narrower listing container.** Reason: 744/1128/1440 boundaries fit the chosen layouts; the specific 1080px listing requirement resolves the reference analysis's conflicting container descriptions. Source: F07 and its navigation follow-up. Classification: ongoing.

- **D-022 — Prove new tests fail for the behavior they guard.** Reason: A green assertion can pass against broken markup or be saved by another constraint; deliberate breakage and positive controls establish that it protects the intended rule. Source: F08, F11, F12 and F18–F21. Classification: ongoing.

- **D-023 — Refuse host deletion while protected reservations exist.** Reason: The foreign-key cascade erases stays and reviews rather than cancelling them. The host guard suggests unpublishing and widens its date cutoff to err toward refusal. Admin deletion is deliberately separate. Source: F10. Classification: ongoing.

- **D-024 — Treat zero changed rows according to the operation.** Reason: A filtered UPDATE or DELETE can report success while refusing the change; inspect its row result when refusal matters. An INSERT fails differently and an idempotent receipt may legitimately change nothing. Source: F13, F15 and F16. Classification: ongoing.

- **D-025 — Use two test identities and retain the existing auth fixture approach.** Reason: Ownership tests need a non-owner. Fixtures use email/password because Google consent cannot be automated; that forces the production provider gap until a separate test project is built. Source: F04, Phase 3 close-out and F18. Classification: ongoing.

- **D-026 — Give shared fixture privileges one owner and two cleanup paths.** Reason: Parallel files must not race the admin flag; revoke it in finally and global teardown because a timed-out fixture must not retain privilege. Source: Phase 3 close-out and F17. Classification: ongoing.

- **D-027 — Require shared schemas to accept their own output.** Reason: Client-parsed values are validated again by the action; nullable optional text previously passed the first parse and failed the second. Source: F09, F15 and F16. Classification: ongoing.

- **D-028 — Choose date cutoffs that fail in the harmless direction.** Reason: Host deletion/blocking tolerates the documented boundary mismatch; new booking rejects past check-in because it could otherwise create a stay the guest cannot cancel. A block/booking race remains accepted rather than constrained across tables. Source: F10–F12. Classification: ongoing.

- **D-029 — Send the desired favorite state and separate its control from navigation.** Reason: Idempotent set operations converge under concurrent clicks; a sibling heart button avoids nesting an interactive control inside the card link. Local state avoids reverting to a stale prop. Source: F08. Classification: ongoing.

- **D-030 — Limit live messaging to the open thread.** Reason: Thread-scoped subscriptions match the product scope and clean up on exit; the inbox updates on revisit. Authenticate the subscription before listening because an anonymous connection can succeed without events. Source: F16. Classification: ongoing.

- **D-031 — Make read receipts best-effort and idempotent.** Reason: An already-read thread normally changes zero rows; logging a real receipt error without blocking rendering keeps a secondary acknowledgement from breaking the conversation. Source: F16. Classification: ongoing.

- **D-032 — Create conversations on click and let guests initiate.** Reason: The unique participant/listing key makes repeat clicks converge; an unused click can leave an empty thread, and host initiation remains outside the current UI despite policies admitting it. Source: F16. Classification: ongoing.

- **D-033 — Give admins a narrow unpublish function.** Reason: Adding an admin branch to unrestricted listing UPDATE would permit changing every field, including host ownership. The function changes only publication state; hosts retain the one photo-guarded republish path. Source: F17. Classification: ongoing.

- **D-034 — Keep admin delete separate and role-checked.** Reason: Its broader deletion skips the host upcoming-booking guard intentionally, so it must re-check admin even though the policy also admits hosts. The confirmation names cascaded records and offers unpublish. Source: F17. Classification: ongoing.

- **D-035 — Cap admin display tables without capping scope counts.** Reason: Two hundred rows keeps the portfolio dashboard bounded; counts and host-scope ID reads remain uncapped so truncation cannot misstate ownership or totals. Pagination remains unimplemented. Source: F14 and F17. Classification: ongoing.

- **D-036 — Prefer a real missing-resource status over a route skeleton.** Reason: A loading boundary can stream a 200 before notFound runs; routes that need true 404 behavior omit loading.tsx. Source: F07. Classification: ongoing.

- **D-037 — Sanitize untrusted OAuth error text before logging.** Reason: The scanner's sensitive-value verdict was a false positive, but the parameter was attacker-controlled and could inject log text. Character filtering and a 64-character cap fix that separate defect; renaming removes the heuristic trigger. Source: M1, merged PR #6. Classification: ongoing.

- **D-038 — Test skip-link focus directly and preserve its reveal ordering.** Reason: Chromium can move the next-Tab origin without focusing the target. The target needs tabIndex=-1; the utility-order-dependent reveal remains a known upgrade sensitivity. Source: F21. Classification: ongoing.

- **D-039 — Assert computed accessible names rather than attributes.** Reason: A bare div or span cannot take the intended accessible name; role-based assertions found rating/gallery defects that attribute-based locators missed. Distinct navigation and link names avoid ambiguous controls. Source: F12, F20 and F23. Classification: ongoing.

- **D-040 — Mount polite announcement regions before their content changes.** Reason: A region created with its message can be silent; the existing error-alert exception remains. Real spoken output still needs a human listening pass. Source: F16, F18 and F20. Classification: ongoing.

- **D-041 — Keep calendar days as ordinary buttons for this build.** Reason: A roving-focus grid would replace a shared primitive beneath three features late in the build. The existing buttons work but cost roughly 60 tab stops; the alternative was deferred deliberately. Source: F18. Classification: ongoing.

- **D-042 — Run production checks and leave the host grid unstreamed.** Reason: Development mode missed a production refresh failure. Removing the host-listing Suspense boundary restored the last measured production baseline; restoring it requires equivalent evidence. Source: F18 and F19. Classification: ongoing.

- **D-043 — Keep host reservations read-only and chronologically useful.** Reason: The policy offers no host cancellation path. Two flat date-ordered sections answer who is arriving; guest total, service fee and earnings are distinguished, with no earnings for cancelled rows. Source: F14. Classification: ongoing.

- **D-044 — Expose Cloudinary's public identifier and guard missing config.** Reason: The browser widget needs the API key while the secret stays on the server. Throwing on missing configuration previously broke routes, so rendering guards and delivery fallbacks remain. Source: F09 follow-up. Classification: ongoing.

- **D-045 — Use sentinel seed identities and relative sample dates.** Reason: Sentinels allow repeatable demo-data replacement without deleting real users; relative dates age predictably, and sample snapshots preserve their historical fee even if today's rate changes. Manual rows attached to demo data can cascade away. Source: F03 and F19 seed follow-up. Classification: ongoing.

- **D-046 — Keep external providers out of automated product tests.** Reason: OAuth consent and real uploads are verified separately; fixture photo rows exercise UI without real asset delivery or destruction, which remains a limit on the resulting evidence. Source: F04, F09 and Code Standards → Testing. Classification: ongoing.

- **D-047 — Bootstrap no seeded admin.** Reason: A real developer account is promoted manually; fake demo identities must not create a standing privileged login. Source: F02–F04. Classification: ongoing.

- **D-048 — Require a photo before publishing a listing.** Reason: The database ensures at most one cover and the publishing flow owns at least one photo; a draft must exist first so the signing route can authorize its upload folder. Source: F09. Classification: ongoing.

- **D-049 — Use inline two-step destructive confirmations.** Reason: The existing surfaces need explicit confirmation without a new modal dependency; focus follows the confirm controls and the reason is visible. Source: F10, F17 and F18. Classification: ongoing.

- **D-050 — Keep details, photos and availability on sibling host routes.** Reason: Upload ownership requires an existing draft, and separate mutations avoid refreshing a large details form while unrelated controls change. Move buttons provide keyboard-accessible photo ordering. Source: F09–F11. Classification: ongoing.

- **D-051 — Keep bounded views separate from scope-defining reads.** Reason: A display ceiling may truncate history; a ceiling on owned IDs or counts can exclude whole legitimate groups. Empty scope sets short-circuit rather than build an empty SQL tuple. Source: F06, F14 and F17. Classification: ongoing.

- **D-052 — Verify library APIs from available current sources.** Reason: Context7 and service tools precede local usage notes; official docs cover gaps with a recorded fallback. Memory alone is not evidence of a valid API. Source: Original CLAUDE.md and library-docs.md. Classification: ongoing.

- **D-053 — Retain the full original build journal.** Reason: Failed diagnoses, corrections and historical verification numbers explain decisions and cannot be remeasured. The project explicitly declined phase-log compaction. Source: Journal maintenance agreement, 2026-07-29. Classification: ongoing.

- **D-054 — File every displaced recent decision as a standing constraint.** Reason: The former workflow moved the eleventh entry by age alone. Superseded by D-065 because the updated setup-context distinguishes historical choices from ongoing rules. Source: Pre-rewrite CLAUDE.md and progress-tracker.md. Classification: superseded.

- **D-055 — Scope queries to the screen's role as well as RLS.** Reason: A bookings policy admits guest, host and admin at once; each page must distinguish its own role. Favorites and inbox policies already answer their narrower page questions. Source: F13, F14 and F16. Classification: ongoing.

- **D-056 — Keep admin user management and conversations outside scope.** Reason: Role editing and profile deletion are revoked, and private messaging policies do not admit an admin participant merely by role. Adding those capabilities needs an explicit policy decision. Source: F02 and F17. Classification: ongoing.

- **D-057 — Remove and re-add availability blocks instead of editing them.** Reason: Merging overlaps or splitting a range would introduce extra mutations and ambiguous removal. The UI refuses known overlaps; the UPDATE policy remains unused. Source: F11. Classification: ongoing.

- **D-058 — Wait for the inbox timestamp rather than the earlier message row.** Reason: The action inserts then updates; polling the first statement let a test read the second before it committed. Changing the poll fixed the attributed test race without changing the product. Source: F19 follow-up 2. Classification: historical.

- **D-059 — Keep the README professional and portfolio-focused.** Reason: The original README agreement selected a neutral voice, omitted an AI-tooling discussion and linked to limitations instead of listing them in detail. Static test badges remain historical assertions rather than CI measurements. Source: F22; prose restated by this rewrite. Classification: ongoing.

## Documentation decisions

- **D-060 — Keep CLAUDE.md as the only agent entry point.** Reason: The user explicitly prefers one file even when Codex reads the repository, so no AGENTS.md or duplicate instruction set is introduced. Source: User answer 1, 2026-10-19. Classification: ongoing.

- **D-061 — Write plain explanations for every audience.** Reason: The user wants the README, agent guidance and context understandable to readers with different experience. Explain the behavior first, retain precise technical names where needed and apply humanizer. Source: User answers 1–2 and explicit humanizer request, 2026-10-19. Classification: ongoing.

- **D-062 — Leave the build journal unchanged in this rewrite.** Reason: The user excluded the journal. Active constraints get a readable home, while the original journal remains reachable evidence; this rewrite's completion is recorded in work notes. Source: User answer 4, 2026-10-19. Classification: ongoing.

- **D-063 — Set the essential-reading ceiling to 40,000 estimated tokens.** Reason: The user accepted the recommendation; it leaves room for the application's binding rules while detailed schemas, examples and history stay on demand. Count whole files at bytes divided by four. Source: User answer 4 to follow-up, 2026-10-19. Classification: ongoing.

- **D-064 — Automate documentation checks and prove they detect failures.** Reason: The user accepted automation. A dependency-free Node script checks structure, links, IDs and reading cost; temporary-copy experiments establish both detection and recovery. Semantic reasoning remains a manual check. Source: User answer 4 to follow-up, 2026-10-19. Classification: ongoing.

- **D-065 — Use stable decision IDs and classify older choices by purpose.** Reason: The user asked to fix updated setup-context gaps. One authoritative record retains each reason; ongoing, historical, superseded and retired choices no longer share an age-based destination. Source: User answer 2 to follow-up, 2026-10-19. Classification: ongoing.

- **D-066 — Preserve detailed pre-rewrite notes as references.** Reason: Full reorganization was authorized, but useful reasoning must survive. Six snapshots retain their original content with hashes; the readable guides link to them by task. Source: User structural freedom and setup-context preservation requirement, 2026-10-19. Classification: ongoing.

- **D-067 — Preserve the existing change and commit workflow.** Reason: The user accepted keeping workflow requirements while rewriting prose. Checks, completed-change records, journal retention and explicit commit approval remain; the journal exception applies to this rewrite only. Source: User answer 3 to follow-up, 2026-10-19. Classification: ongoing.

- **D-068 — Use local source pointers while current library evidence is unavailable.** Reason: The old examples have drifted from code and Context7 is not callable. Source pointers and manifest/lockfile facts can be verified locally; fresh copyable API guidance remains explicitly deferred. Source: Repository inspection and standing library-evidence rule, 2026-10-19. Classification: ongoing.
