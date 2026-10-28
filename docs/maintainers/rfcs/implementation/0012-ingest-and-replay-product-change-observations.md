# IRFC-0012: Ingest and replay product-change observations

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0011  
**Canonical technical specification:** [RFC-0033](../0033-change-observation-and-provenance.md)  
**Implementation order:** 0012 of 0032

## Implement this slice

Implement RFC-0033's immutable observation envelope, webhook authenticity, GitHub commit/release and manual attestation sources, deduplication keys, replay cursor, schema versioning, bounded ingestion, and source/version provenance. Preserve observed_at and effective_at as different concepts.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Duplicate and out-of-order events converge to the same logical change, canceled/revoked sources stop ingestion, and a missed webhook can be reconciled by polling without duplicated work.

## Explicit boundary

An observed commit is not automatically proven deployed behavior.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0013](0013-model-typed-scoped-versioned-product-facts.md)
