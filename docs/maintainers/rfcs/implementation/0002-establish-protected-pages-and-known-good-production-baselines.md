# IRFC-0002: Establish protected pages and known-good production baselines

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0001  
**Canonical technical specification:** [RFC-0019](../0019-release-monitoring-and-regression-repair.md)  
**Implementation order:** 0002 of 0032

## Implement this slice

Complete RFC-0019 **phase 1a**: owner-selected protected pages, versioned known-good snapshots, observed production state, provenance, monitoring cadence, and visible stale/failed coverage. Reuse current SEO check rules, URL policy, deployment reads, schedulers, and project-scoped persistence.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

On an authorized site, show every protected URL, baseline origin and version, successful last check, next scheduled check, and explicit degraded or unknown state; pass D1/Postgres parity and tenant-boundary tests.

## Explicit boundary

No automatic repair or guessed commit-to-page provenance.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0003](0003-confirm-deduplicate-and-explain-production-regressions.md)
