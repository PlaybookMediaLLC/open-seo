# IRFC-0001: Record protected-site scope and activation

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** None; may start immediately  
**Canonical technical specification:** [RFC-0026](../0026-protected-site-pilots-and-service.md)  
**Implementation order:** 0001 of 0032

## Implement this slice

Build the product side of RFC-0026 **phase A**: a project-scoped record of the protected site with its verified production origin and owner authorization, the agreed page set and exclusions, check cadence, named reviewer, permitted operations and support contact. Show the site as active only when every item of the RFC-0026 [activation checklist](../0026-protected-site-pilots-and-service.md#activation-checklist) passes. Reuse `projects`, `project_key_pages`, the GSC, GA4 and publishing connections, and the GitHub App installation.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

On an authorized site, record the protected scope, agreed pages and cadence, reviewer and permitted operations, and show each activation-checklist item as passed, failed or not yet available. A connection without healthy checks is not an active protected site. Items that later IRFCs provide, such as the known-good baseline and scheduled checks, stay unmet until those ship.

## Explicit boundary

Do not promise automatic PRs or unattended monitoring before checks are scheduled. Do not build a CRM or store sales notes; store only the fields needed to run protection.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0002](0002-establish-protected-pages-and-known-good-production-baselines.md)
