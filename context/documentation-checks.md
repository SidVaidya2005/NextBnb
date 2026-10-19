# Documentation checks

> **Role:** Explain how to check this documentation and what the automated guard cannot prove. Read before changing the layout, decision protocol or checker.

## What runs

Run `npm run check:context` after documentation edits and before claiming the work is complete. Run `npm run test:context` when changing the checker or its inventory. Both use Node's built-in modules and need no package installation.

The implementation is [check-context.mjs](../scripts/check-context.mjs), with behavior tests in [check-context.test.mjs](../scripts/check-context.test.mjs). The file lists near the top of the checker are the automated inventory. Keep them aligned with the reading instructions in `CLAUDE.md`. All current context files, the journal, the reference index/snapshots, the deployment runbook, README and verification record are included.

## Automated coverage

The guard counts each essential file once, using UTF-8 bytes divided by four as an estimate of tokens. It prints every file's cost, the essential total against 40,000, and the on-demand inventory separately. The latter includes the full journal and is not a typical session cost. It charges the full physical file, so a small required section cannot hide a large attached archive.

The essential set is `CLAUDE.md`, overview, architecture, standing constraints, code standards, progress and design. The split keeps all binding rules in routine reading. Detailed schemas, library usage, feature records and history have explicit reading conditions. When growth exceeds the ceiling, preserve the detail in a reference and update its reading condition. Never delete useful content merely to pass the check.

The guard scans every section of every context file for decision records, retaining the file and section for diagnostics. This includes governing documents, the registry, current/recent decisions, standing constraints, work notes and the original historical journal. Dated pre-rewrite snapshots are preserved evidence rather than new decision homes. A bold `D-NNN` record has one owner and includes a reason and source. Plain ID references and fuller reasoning elsewhere are allowed. The guard rejects duplicate/dangling IDs, missing replacements, self-replacements and replacement cycles. It also limits the recent list to ten entries.

Local Markdown links, named heading targets and HTML image sources are checked. The guard additionally scans the whole agent file for inline context paths, rejects unlisted documentation, checks Role/maintenance sections and unfinished template markers, and keeps the agent file under 250 lines. It does not follow external links or parse arbitrary natural-language directions; use explicit file/section links for reading instructions.

Six original documents are retained inside dated reference snapshots. The [Preservation manifest](../docs/reference/preservation.json) records their source hashes and the wrapper's byte length. The guard hashes the preserved suffix rather than merely comparing file sizes. Snapshot paths retain their original base for link resolution. The journal is not permanently hash-locked by the checker: the no-change instruction applies to this rewrite, while its established correction/append workflow remains available for future authorized work.

## Failure detection and recovery

The checker tests run against temporary copies of the actual documentation. They never introduce damage into the working files or the journal. Each experiment starts from a passing tree and must return the expected exit status; the next copy starts clean.

| Experiment | Expected result |
| --- | --- |
| Exceed the essential allowance using an actual essential file | Fail with the excess, contributing file costs and preservation remedy |
| Duplicate an ID in different homes or two sections of one home | Fail with both locations |
| Reference an unrecorded ID | Fail with its reference location |
| Replace a record with an absent ID, itself or a cycle | Fail with the invalid relationship |
| Add fuller reasoning as a plain reference | Pass without treating it as another record |
| Move a recent record into work notes | Pass with one authoritative record and resolved references |
| Put a record beside a governing rule | Pass when a recent entry only references it |
| Remove an essential or on-demand document | Fail with the missing path |
| Rename a referenced section | Fail even though the file remains |
| Add a context document outside the inventory | Fail instead of silently omitting it |
| Change preserved historical content | Fail its source-content hash |
| Change the essential list without updating the cost inventory | Fail with the reading-list mismatch |

The suite contains an applicable combined-file case because the decision registry has multiple sections. There is a separate on-demand history home, so history movement is also exercised. The original journal need not be edited to prove that the inventory scans history; work notes provide the writable historical destination in the temporary experiment.

## Manual review

After the automated checks, read the changed guides and compare them with the accepted choices and relevant source. Record results in the work's completion notes.

1. Confirm that every active rule is in essential reading, with its reason or a short explanation. Check the declared reading order and the actual list in the script.
2. Compare original and rewritten sections. Follow archived explanations to ensure choices, caveats, rejected alternatives and completion evidence remain reachable. Check feature numbers and tracker order together.
3. Review decision meaning, classification and sources. The script cannot tell whether two different IDs describe the same choice, whether an old decision still governs, or whether a reason was invented. Keep unresolved choices in Open Questions.
4. Inspect manifest and lockfile facts against library records. Current API evidence needs Context7; a local source pointer is not proof of current vendor guidance. Keep missing evidence and its work impact explicit.
5. Inspect references written in ordinary prose and non-Markdown code examples. The guard validates explicit paths and links, not every sentence's intended meaning.
6. Scan selected documents for literal credentials and unfinished scaffolding. Use a case-insensitive search for assignments involving KEY, SECRET, TOKEN, PASSWORD or CREDENTIAL; inspect each candidate without printing its value. Environment reads, variable names, placeholders and non-secret identifiers are not exposed credentials. Follow with a manual reading pass because a pattern cannot recognize every secret.
7. Apply humanizer to new prose: remove inflated claims, unnecessary contrast, repeated rhetorical structures, heavy bolding and long asides. Read the result aloud while preserving exact paths, names and required decision syntax.
8. Distinguish checks run now from dated product baselines, unchecked remote state and reasoned-but-unexecuted branches. Do not reset a baseline or close a work item merely because its explanation was rewritten.

Semantic review, secret identification, external-link availability, vendor API freshness and actual application behavior are manual or separately verified. The checker does not certify them. Its own test suite is not included in the historical 288-unit/420-E2E product totals.

## How this file is maintained

When a layout changes, update this procedure, `CLAUDE.md`, script inventories, decision-home descriptions and reference links together. Add an appropriate failure experiment for new enforcement. Run the checker and its tests after restoration, and record the actual results. Reassess the layout when routine reading approaches its ceiling, a new integration/domain appears, or a subject becomes difficult to maintain; do not raise the ceiling or add documents without a concrete reason.
