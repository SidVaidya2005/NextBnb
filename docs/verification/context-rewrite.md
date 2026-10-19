# Documentation rewrite verification

> **Role:** Record the checks and limits of the 2026-10-19 documentation rewrite. Read when reviewing that change or the checker's initial validation.

## Scope and outcome

README, CLAUDE.md and the seven other active original context guides were rewritten with humanizer. The journal was excluded from edits. Active constraints, a decision registry, work notes and a check procedure were added because their responsibilities were missing or buried in the old layout. Product code, SQL, deployment and dependency ranges are unchanged.

CLAUDE.md remains the sole agent entry point. Its information table and ordered reading list identify every subject. Overview → architecture → standing constraints → standards → status → design are essential; schemas, completed plans, library details and history are on demand. A separate AGENTS.md, extra phases, placeholder pattern files and another memory file were deliberately omitted.

## Reading cost

Estimates use UTF-8 bytes divided by four, counting whole files once.

| Essential file | Estimated tokens |
| --- | ---: |
| `CLAUDE.md` | 2,086.8 |
| `context/project-overview.md` | 1,400.5 |
| `context/architecture.md` | 3,366.8 |
| `context/standing-constraints.md` | 2,637.2 |
| `context/code-standards.md` | 2,688.8 |
| `context/progress-tracker.md` | 2,249.5 |
| `context/DESIGN.md` | 1,930.8 |

Essential total: **16,360.2 / 40,000 estimated tokens**. Before the rewrite, the old routine set was about 39,416 tokens when charging only the required journal section. Whole-file accounting under the updated skill would charge about 116,524, because constraints shared the journal with its long history. Those are different accounting methods; no ceiling had been agreed before this interview.

The checker prints the on-demand inventory separately, including the full journal and preserved source snapshots. That aggregate is retained knowledge, not the cost of an ordinary session. Integration work adds the relevant library guide/section and implementation; an original feature change adds its matching build notes. No content was added merely to use the remaining allowance.

## Checks run

All commands below were run with the available bundled **Node v24.19.0**. The script uses built-in modules and avoids the newer import.meta.dirname shorthand so it does not depend on that API at the project's Node minimum. The runtime minimum itself was not re-tested in a second Node installation.

- `node scripts/check-context.mjs`: passed. Local files and named sections resolved; 68 authoritative decision records had no duplicate/dangling references or invalid replacements; essential reading was below its ceiling; Role, maintenance, scaffolding, agent-size and inventory checks passed.
- `node --test scripts/check-context.test.mjs`: **17 tests passed, zero failed**. The original absent-checker run failed before implementation; the completed checker then passed its real-tree and temporary-copy failure/acceptance experiments.
- `node --check` on both new scripts: passed.
- `git diff --check`: passed.
- Compared all six snapshot suffixes directly with the starting source bytes: **all identical**, in addition to their SHA-256 checks.
- Compared the journal with the starting bytes: **identical**. Its SHA-256 is `f6d7d7b338e7e25377c2ee0a4b22e7a318709c177d2d5fb775791cee2092e607`.
- Compared the original tracker checklist: **all 24 completed boxes preserved**, comprising 18 features and six checkpoints. Build-feature numbers remain 01 through 18 in the same order.
- Compared manifest non-script fields and Git paths: only the two documentation commands were added to package.json; dependency ranges and lockfile are unchanged; no src, supabase or e2e file changed.

## Failure detection demonstrated

The 17 tests cover a clean tree; exceeding the real essential budget; duplicate IDs in two files and two sections of one file; dangling IDs; missing, self and cyclic replacements; legal fuller references; moving a record into work-note history; records beside governing rules; missing essential and on-demand files; missing named sections; unlisted documentation; changed preserved content; and reading-list/cost-inventory disagreement.

All experiments use temporary copies. Each starts from the actual clean tree, and the working documentation/journal is never damaged. Legitimate references, record moves and governing records pass. The combined-file and on-demand/history cases apply to this layout, so neither was skipped. The final checker run after all edits passes again.

## Manual review and coverage

Reviewed the rewritten active guides, their information locations, workflow, original invariants and engineering rules, decision classifications, feature order, completion checks and source links. Generalized rules remain in essential reading; detailed examples and qualifications remain reachable. The old automatic decision-to-constraint rule is explicitly superseded by purpose-based classification. Humanizer's final pass removed slogans, inflated claims, heavy emphasis and repeated asides while retaining technical names and evidence limits.

The six original source files were preserved in full, with explicit wrapper notices and an index. The journal review used Standing Constraints and relevant feature/maintenance entries; this task did **not** re-audit every historical entry or every product source file. Source checks sampled booking action/schema, Supabase client/session handling, image rendering, theme/layout, listing grid, footer and local merge history. M1's merged PR #6 is locally established; remote alert closure is not.

A candidate scan across selected Markdown found six non-secret matches: React key expressions, prose mentioning the anonymous/service key and a design token label. Each was inspected. No credential value was found. Pattern scanning and manual review cannot establish every possible future secret shape, so this remains a manual completion check.

No new dependency range was selected and **no dependencies were installed**. Existing ranges and exact lockfile resolutions are listed in the library guide. No commit was created.

## Remaining verification limits

Context7 is not callable, so fresh vendor API guidance remains deferred. The library guide supplies repository source pointers and local version evidence; the historical snippets are explicitly not copying guidance. Full current-library verification is therefore an outstanding setup-context check, not a passing claim.

The app's node_modules directory is absent. The agent shell has no working npm command: its /usr/local/bin/npm symlink points to a missing npm-cli.js. Attempts to invoke the npm scripts could not launch npm. The equivalent new documentation scripts were run directly with Node; the product unit/E2E/build baselines were **not rerun** and remain dated. Application behavior, hosted availability, remote configuration, billing and external link reachability were not reverified.

Semantic equivalence of differently worded decisions, whether a choice should still govern, preservation of meaningful reasons, credential identification and fresh library evidence require the manual procedure. No automation is claimed for them.

## Outstanding TODOs

- In `context/library-docs.md`: "TODO: verify the documented integration APIs through Context7 before adding or refreshing copyable library examples."
- In `context/progress-tracker.md`: "TODO: recheck GitHub alert #1 after the merged M1 change; local code and merge history do not prove the remote alert is closed."

The four previously recorded maintenance tasks and accepted verification limits remain open. This rewrite did not expand into product fixes.

## How this file is maintained

This is a dated completion record. Add a dated correction if a claim is later disproved; do not relabel old product baselines as fresh measurements. Reassess the layout if essential reading nears its ceiling, a new integration/domain appears, or a subject becomes hard to find or maintain. The next useful documentation work is to restore Context7 access and complete the explicit API-evidence check.
