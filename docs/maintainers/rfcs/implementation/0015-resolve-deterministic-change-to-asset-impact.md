# IRFC-0015: Resolve deterministic change-to-asset impact

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0014  
**Canonical technical specification:** [RFC-0036](../0036-impact-analysis-and-dependency-graph.md)  
**Implementation order:** 0015 of 0032

## Implement this slice

Use RFC-0036 to join accepted fact changes to affected claims/assets via typed dependency edges, scope/time conditions and explicit matching rules. Emit explainable findings with evidence version and idempotent fingerprints. Provide unknown and possible-impact states without auto-escalation.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A scoped integration/plan change identifies the matching outdated claim, ignores unrelated cohorts, deduplicates repeated observations, and keeps an inspectable explanation.

## Explicit boundary

No unbounded LLM-generated task graph.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0016](0016-create-reviewed-cross-system-work-plans.md)
