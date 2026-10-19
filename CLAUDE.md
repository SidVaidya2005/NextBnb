# NextBnb

NextBnb is a short-term rental marketplace built with Next.js and Supabase. Guests book stays; the same account can host properties. Bookings are simulated and no payment is taken.

## Project documentation

Use this file as the only agent entry point, including in Codex. Do not create a second agent file. The application is shipped and in maintenance; the original six-phase build is complete.

The layout separates rules needed for every change from implementation details and build history. This keeps routine reading manageable while preserving the original explanations. The documentation decisions and their reasons are recorded in [Decision records](context/decisions.md#documentation-decisions).

## Information locations

| Information | File and section |
| --- | --- |
| Product, users, scope and success criteria | [Project overview](context/project-overview.md) |
| Architecture, boundaries and invariants | [Architecture](context/architecture.md), especially [Invariants](context/architecture.md#invariants) |
| Standing constraints and their reasons | [Standing constraints](context/standing-constraints.md) |
| Code standards and testing | [Code standards](context/code-standards.md) |
| Current status, progress and recorded baselines | [Progress tracker](context/progress-tracker.md#current-status) |
| Recent decisions | [Key Decisions](context/progress-tracker.md#key-decisions) |
| Authoritative decision records, including historical and superseded choices | [Decision records](context/decisions.md); future work may also own records beside governing rules or in [Work notes](context/work-notes.md) |
| Open questions and unverified claims | [Open Questions](context/progress-tracker.md#open-questions) |
| Original feature descriptions and completion checks | [Build record](context/build-plan.md) |
| Active maintenance work, fuller reasoning and completion history | [Work notes](context/work-notes.md) |
| Library ranges, local implementations and verification limits | [Library guide](context/library-docs.md) |
| Binding visual rules | [Design system](context/DESIGN.md) |
| Original build history and original constraint explanations | [Build journal](context/build-journal.md); the Feature Log is historical, not routine reading |
| Preserved pre-rewrite detail | [Reference index](docs/reference/README.md) |
| Deployment | [Render runbook](docs/deploy-render.md) |
| Documentation checks and manual review procedure | [Documentation checks](context/documentation-checks.md) |

## Always read, in this order

Read these complete files before changing code. Read each physical file once.

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/standing-constraints.md`
4. `context/code-standards.md`
5. `context/progress-tracker.md`
6. `context/DESIGN.md`

Then use Current Status to find the relevant work notes. The essential-reading ceiling is 40,000 estimated tokens, including this entry point, calculated as file bytes divided by four. It is a ceiling, not a target. Preserve growing detail in indexed references rather than deleting it. A higher ceiling requires a deliberate commit explaining the change.

## Read references when needed

| Task | Read |
| --- | --- |
| Change an original feature | Its numbered heading in `context/build-plan.md`; follow the detailed-record link when the explanation matters |
| Plan or continue maintenance | The relevant heading in `context/work-notes.md` and the matching Open work item |
| Use or change an integration | The matching section in `context/library-docs.md`, the linked source file, and current library documentation |
| Change schema, policies or grants | The migrations, generated types, and the schema/policy sections in `docs/reference/architecture-notes.md`; compare historical notes with the actual SQL |
| Investigate a regression or accepted limitation | The named feature in `context/build-journal.md`; its original Standing Constraints remain available as historical evidence |
| Investigate an old diagnosis or measurement | `docs/reference/maintenance-notes.md` and the journal entry it cites |
| Change the documentation layout or checker | `context/documentation-checks.md` and the records in `context/decisions.md` |
| Deploy or change environment configuration | `docs/deploy-render.md` and Code standards → Environment Variables |

## Standing rules

- Follow the scope, invariants, active constraints, standards and visual rules in essential reading. Do not expand a change to fix unrelated findings.
- Record environment variable names, never credential values. Treat an uncertain value as sensitive.
- Check tool availability each session. Context7 is required before writing new library API guidance; use official documentation only for gaps or ambiguity and record the fallback. If Context7 is unavailable, continue independent work and leave dependent guidance explicitly unverified. Do not invent an API from memory.
- Use `/architect` for meaningful features or unresolved implementation choices. Use its small-change path for simple edits. Use `/remember restore` at session start and `/remember save` at the end, following these information locations rather than creating another memory system.
- Keep commits focused. Ask for explicit approval before each commit; add no coauthors unless requested. Keep the existing commit conventions when continuing an existing work item.
- Run the checks relevant to the change and compare their results with the recorded baselines. Investigate a deviation; do not overwrite it merely to make the numbers match.
- Update Current Status after every completed change, replacing its contents. Update the existing checklist in place. Record completion, gotchas, decisions and verification in the work's notes.
- Append the usual dated completion entry to the journal for future work. For this documentation rewrite, the user explicitly requires the journal to remain unchanged; the completion record is in `context/work-notes.md` instead.
- Preserve the journal's full Feature Log. Correct a wrong past claim beneath its original text, mark resolved gaps with their closing feature, and retain failed hypotheses and verification measurements. Do not compact it.
- Record consequential choices when confirmed, using the next unused `D-NNN` number with at least three digits. Each ID has one authoritative bullet: `- **D-NNN — Choice.** Reason: ... Source: ...`. Other mentions are references. Preserve existing feature labels such as F19 and M1 as source identifiers.
- Keep ten recent decisions, newest first. Classify an older record before moving it: ongoing rules belong with standing constraints; historical, superseded and retired choices belong in reachable work notes or history. Preserve reasons and IDs, remove the old authoritative copy, and update links. Never turn a decision into a rule merely because it is old.
- A changed choice gets a new ID; mark the former record superseded with its replacement ID and reason. A retired choice needs its retirement reason. Keep unresolved choices in Open Questions without assigning decision IDs.
- Before marking work complete, check that discussion and work notes have not left an important choice or reason undocumented. Ask about a missing reason rather than inventing it.
- Run `npm run check:context` whenever documentation changes and before completion. When the checker changes, also run `npm run test:context`. Follow the manual checks in `context/documentation-checks.md`; automation cannot judge whether two differently worded decisions mean the same thing.

## Commands

Use the Node version pinned in `.nvmrc`; the manifest requires Node ≥20.9. These commands assume dependencies have already been installed.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local application |
| `npm run build` | Build for production |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Check TypeScript |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest |
| `npm run test:e2e` | Run Playwright against the configured database |
| `npm run check:context` | Check documentation structure, references, decisions and reading cost; no app dependencies required |
| `npm run test:context` | Prove the documentation checker detects failures in temporary copies |
