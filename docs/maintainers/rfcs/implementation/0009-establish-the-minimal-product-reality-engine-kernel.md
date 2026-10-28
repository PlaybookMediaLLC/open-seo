# IRFC-0009: Establish the minimal Product Reality Engine kernel

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0008  
**Canonical technical specification:** [RFC-0030](../0030-product-reality-engine-architecture.md)  
**Implementation order:** 0009 of 0032

## Implement this slice

Implement only the narrow RFC-0030 model needed for one change → accepted fact → affected claim → approved action → verification chain. Use existing TanStack server function → service → repository conventions, project scoping, dual SQLite/Postgres schemas, and append-only evidence. Avoid implementing the entire speculative ontology.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Persist and retrieve one manually attested change with stable IDs and provenance; reconcile versioned evidence without inventing deployment proof.

## Explicit boundary

No new framework, cross-tenant graph database, or broad agent autonomy.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0010](0010-enforce-tenant-privacy-authorization-and-spend-invariants.md)
