# IRFC-0010: Enforce tenant, privacy, authorization, and spend invariants

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0009  
**Canonical technical specification:** [RFC-0031](../0031-platform-governance-privacy-metering-and-service-quality.md)  
**Implementation order:** 0010 of 0032

## Implement this slice

Apply RFC-0031's first-slice security rules at every boundary: organization and project identity, least-privilege credential access, approval segregation, redaction, source retention/erasure, rate and budget controls, and activity logs. Reuse RFC-0009 and existing auth; introduce only missing rules.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Cross-tenant read/write denial, revoked connection, expired approval, sensitive-source redaction, and uncertain billing tests pass against both persistence dialects.

## Explicit boundary

Don't wait to build an enterprise compliance dashboard before shipping a read-only slice.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0011](0011-introduce-bounded-connector-contracts-and-health.md)
