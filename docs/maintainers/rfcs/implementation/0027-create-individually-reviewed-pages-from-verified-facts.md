# IRFC-0027: Create individually reviewed pages from verified facts

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0013, IRFC-0020, IRFC-0026  
**Canonical technical specification:** [RFC-0021](../0021-new-pages-from-verified-facts.md)  
**Implementation order:** 0027 of 0033

## Implement this slice

Reuse RFC-0034's typed fact versions as the canonical source and adapt RFC-0021's **new-page phases 1–2** to existing approved template and MDX publishing. One proposed page at a time; apply source citations, human review, preview checks and launch-page validation.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A new page's material claims trace to accepted facts, its exact source and preview are reviewed, and the published page is checked on production.

## Explicit boundary

Do not introduce a second, inconsistent business-facts table or bulk SEO-page factory.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0028](0028-turn-activation-and-support-signals-into-approved-fixes.md)
