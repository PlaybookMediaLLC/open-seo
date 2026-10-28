# IRFC-0003: Confirm, deduplicate, and explain production regressions

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0002  
**Canonical technical specification:** [RFC-0019](../0019-release-monitoring-and-regression-repair.md)  
**Implementation order:** 0003 of 0032

## Implement this slice

Complete RFC-0019 **phase 1b**: post-deployment and scheduled comparisons against guarded baselines, second-observation confirmation, deduplication, drift/coverage notifications, and evidence-backed incident tickets. Reuse the existing site checks; distinguish deployment events from production observations.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Seed reproducible regressions and quiet/unknown conditions; verify one confirmed incident per failing fingerprint, no alert for transient failures, and a visible action when monitors cannot run.

## Explicit boundary

Do not call a proposed cause proven; no source edits yet.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0004](0004-prepare-source-mapped-repair-proposals-from-confirmed-incidents.md)
