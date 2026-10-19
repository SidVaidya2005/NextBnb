# Detailed reference index

> **Role:** Locate the detailed pre-rewrite explanations preserved on 2026-10-19. Read only the reference relevant to the current task.

The active guides in `context/` explain current behavior and rules. These snapshots retain the original text after a short wrapper. Their old reading instructions and dated claims belong to the former layout; they do not override `CLAUDE.md` or the current guides.

| Reference | When to read it |
| --- | --- |
| [Architecture notes](architecture-notes.md) | Inspect original schema column tables, access matrix, grants or implementation reasoning; compare with current migrations and types |
| [Engineering notes](engineering-notes.md) | Investigate a historical coding, accessibility or testing rule and its original example |
| [Library examples](library-examples.md) | Recover the original integration rationale; examples require current API/version verification before copying |
| [Design reference](design-reference.md) | Understand the original Airbnb analysis or compare a specific visual reference; unused Airbnb features remain outside NextBnb scope |
| [Build record](build-record.md) | Read a feature's full original plan, approved shape and deviations |
| [Maintenance notes](maintenance-notes.md) | Inspect the former status narrative, full baseline qualifications, recent-decision explanations or homepage race analysis |
| [Build journal](../../context/build-journal.md) | Read original dated measurements, failed diagnoses, corrections and feature history; this file was not rewritten |

## How this file is maintained

Keep these six snapshots immutable. Their source content is checked against hashes in [preservation.json](preservation.json); the check compares actual bytes after each wrapper. Record a correction in current work notes and link to the original instead of silently changing a historical snapshot. Add a reference only when useful detail needs a reachable home, with a specific reading condition and an updated checker inventory.
