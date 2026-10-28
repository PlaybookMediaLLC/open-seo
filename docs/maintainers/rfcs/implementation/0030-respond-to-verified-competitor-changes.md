# IRFC-0030: Respond to verified competitor changes

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Optional engineering investment; skip unless the stated entry criteria are met  
**Prerequisites:** IRFC-0026, IRFC-0027  
**Canonical technical specification:** [RFC-0022](../0022-competitor-change-response.md)  
**Implementation order:** 0030 of 0032

## Implement this slice

Use RFC-0022 for bounded competitor-page observations, verified changes, evidence-backed opportunities and customer-reviewed response drafts. Do not infer competitor features from inaccessible pages or run wide expensive crawls without explicit budget.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A customer reviews one actual competitor change and a specific, fact-backed improvement or no-action decision, with source/cost recorded.

## Explicit boundary

No copycat publishing or unsupported competitor claims.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0031](0031-evaluate-isolated-relay-owned-preview-builds.md)
