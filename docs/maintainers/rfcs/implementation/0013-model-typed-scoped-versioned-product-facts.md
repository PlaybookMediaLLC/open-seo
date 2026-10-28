# IRFC-0013: Model typed, scoped, versioned product facts

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0012  
**Canonical technical specification:** [RFC-0034](../0034-versioned-product-facts-and-authority.md)  
**Implementation order:** 0013 of 0032

## Implement this slice

Implement an authoritative typed fact registry for plans, entitlements, integration availability, feature status, limits, API changes, rollout segments, geographies and effective dates. Store citations and source authority per fact version; represent contradictory evidence instead of overwriting it. Reuse existing project context where possible.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A pricing change for new US Business customers doesn't alter grandfathered customers or other regions; future-dated facts remain planned until effective; stale and conflicting sources are not marked verified.

## Explicit boundary

No bare LLM inference becomes a source of truth.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0014](0014-index-customer-facing-assets-and-attributable-claims.md)
