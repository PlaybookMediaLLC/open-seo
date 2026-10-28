# IRFC-0014: Index customer-facing assets and attributable claims

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0013  
**Canonical technical specification:** [RFC-0035](../0035-customer-facing-assets-and-claims.md)  
**Implementation order:** 0014 of 0032

## Implement this slice

Build RFC-0035's normalized asset identities, source revisions, claim citations and extraction status. Start with repo-backed pricing, integration and documentation pages and reuse RFC-0017 docs index/Markdown parser. Preserve source spans and content hash; distinguish exact, ambiguous and unverifiable matches.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A claim is reproducibly bound to a specific file/blob/URL and fact version, with changes and deletions detected; unsupported JSX/dynamic content stays manual review.

## Explicit boundary

Do not store a whole mirrored knowledge base or declare vector similarity proof.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0015](0015-resolve-deterministic-change-to-asset-impact.md)
