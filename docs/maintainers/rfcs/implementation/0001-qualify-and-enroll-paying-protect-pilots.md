# IRFC-0001: Qualify and enroll paying Protect pilots

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** None; may start immediately  
**Canonical technical specification:** [RFC-0026](../0026-protected-site-pilots-and-service.md)  
**Implementation order:** 0001 of 0033

## Implement this slice

Complete RFC-0026 **phase A** only: qualified customer discovery, a bounded protected-site agreement, verified ownership and production origin, a named reviewer, explicit permissions, support expectations, and billing evidence. Use the existing private sales process for interviews; store only enrollment fields necessary for running protection.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Record actual paid or declined pilot commitments, permission scope, agreed pages and cadence, reviewer identity, and a reproducible activation checklist. A connection without healthy checks is not an active protected site.

## Explicit boundary

Do not promise automatic PRs, unattended monitoring before checks are scheduled, or validated price/renewal.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0002](0002-establish-protected-pages-and-known-good-production-baselines.md)
