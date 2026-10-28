# IRFC-0017: Record delivery receipts and independent outcome verification

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0016  
**Canonical technical specification:** [RFC-0038](../0038-verification-outcomes-and-learning.md)  
**Implementation order:** 0017 of 0032

## Implement this slice

Implement independent state dimensions for prepared, approved, dispatched, published, technically verified and commercially measured. Reuse RFC-0028's original-postcondition logic for supported website edits. Link receipts to exact content/blob, deployed commit and observation; preserve failed and inconclusive results.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Merged PR without production change remains pending; externally fixed content is not credited to Relay; unknown source provenance never becomes a pass.

## Explicit boundary

No causal revenue-lift claim from a simple before/after.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0018](0018-deliver-the-reviewer-workbench-incrementally.md)
