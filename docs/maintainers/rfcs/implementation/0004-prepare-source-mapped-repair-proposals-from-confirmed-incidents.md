# IRFC-0004: Prepare source-mapped repair proposals from confirmed incidents

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0003  
**Canonical technical specification:** [RFC-0027](../0027-source-mapped-regression-repairs.md)  
**Implementation order:** 0004 of 0032

## Implement this slice

Complete RFC-0027 **phase A**: independent regression evidence instead of a fake GSC opportunity, immutable incident-linked proposals, exact Next.js literal/route mappings, validated title-template transformations, and clear unsupported mapping tickets. Reuse MetadataProposalService, current-source checks, and dual-dialect publishing records.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Produce a read-only source-proven title/description correction for a seeded incident; refuse dynamic routes and ambiguous mappings; verify stale evidence invalidates old proposals.

## Explicit boundary

No write, PR, merge, or automatic source regeneration.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0005](0005-authorize-exact-pr-writes-and-check-customer-owned-previews.md)
