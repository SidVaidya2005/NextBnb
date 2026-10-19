# Work notes

> **Role:** Describe maintenance work after the original build, with decisions, fuller reasoning and completion evidence. Read the relevant item when planning or continuing it.

## How this file is maintained

Give each real work item a descriptive heading, intended behavior, decisions and reasons, verification checks and outcome. Record consequential choices when confirmed, linking their IDs rather than creating duplicate authoritative records. Preserve useful alternatives and accepted tradeoffs. Add dated completion evidence after checks actually run, then update the tracker.

Future completed work still receives its usual dated journal entry. This rewrite alone uses these notes instead because the user explicitly excluded the journal. Historical, superseded and retired records can live with their work item; governing active rules remain in essential reading. Move growing detail to an indexed reference before this file becomes burdensome.

## Documentation rewrite (2026-10-19)

### Intended result

Make the README, agent instructions and active context readable to visitors, the developer, maintainers and coding assistants. Explain behavior in ordinary language before naming its technical mechanism. Keep `CLAUDE.md` as the only agent entry point, preserve existing workflow requirements and leave `build-journal.md` unchanged.

The user authorized full reorganization, requested humanizer, and asked to fix gaps against the updated setup-context skill. They accepted the 40,000-token ceiling and automated checks. See D-060–D-068 for authoritative records and reasons.

### Changes and reasoning

Essential reading now follows product → architecture → active constraints → code standards → status → visual rules. The schema/policy detail, old code examples and completed-build narrative are references. A dedicated current constraints guide avoids charging the full journal to each session. The journal's old constraints remain historical source explanations, with current authority declared in CLAUDE.md.

Six snapshots preserve the original detailed text and source hashes. This avoids deleting the qualifications that made the original notes useful. The original 18 feature numbers and all completed checkpoints are retained, with readable summaries and concrete checks. Stable decision IDs supplement the original feature identifiers instead of renaming them.

The rewrite corrects locally demonstrated documentation drift: M1 was merged as PR #6; a helper heading named three functions but listed four; old library examples used a different booking input shape and font variable from the source. No product code, SQL, dependency range or deployment is changed. Source inspection sampled booking validation/action, Supabase client/session paths, shared image rendering, theme/layout, grid and footer; it was not an exhaustive product audit.

No Context7 tool is callable. New copying guidance uses local source links and manifest/lockfile facts, while fresh API examples remain explicitly deferred. The project was not reprovisioned and remote providers were not contacted. A historical result keeps its original date and verification limits.

### Humanizer pass

A working draft said: "The boundaries have specific homes, ensuring consistent separation across the system." The editing audit flagged the trailing claim and abstract wording. The final explanation names the actual directories and their jobs. The same pass removed forensic slogans, repeated "Generalises" lessons, excessive bolding, long asides and unnecessary em dashes from active prose. Required decision-record separators and preserved historical text are retained.

The prose keeps uncertainty where evidence needs it: local merge history does not prove a GitHub alert is closed, and fixture image rows do not prove production Cloudinary transforms. Natural wording must not turn those limits into confident claims.

### Verify

- Run the context checker; references, IDs, Role/maintenance sections and the agreed reading allowance pass.
- Run the checker tests; deliberate failures are detected, legitimate references/moves pass, and clean copies recover.
- Compare all six preserved source suffixes with their original bytes and compare the journal hash with its starting value.
- Compare the 18 completed features and checkpoints with the original tracker.
- Inspect new prose for lost rules/reasons, secrets, scaffolding and library-evidence qualifications.
- Confirm the Git diff contains no application, schema, dependency-range or lockfile change.

### Outcome

The checker and all 17 checker tests passed locally; the six source snapshots match their originals, all 24 completed checklist boxes remain, and the journal is unchanged. Detailed results and review limits are recorded in [Rewrite verification](../docs/verification/context-rewrite.md). The application test baselines remain historical; documentation tests have a separate command and count. No dependencies are installed and no commit is created by this task.
