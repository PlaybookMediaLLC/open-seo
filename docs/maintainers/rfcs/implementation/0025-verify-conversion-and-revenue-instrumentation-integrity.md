# IRFC-0025: Verify conversion and revenue instrumentation integrity

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0024  
**Canonical technical specification:** [RFC-0044](../0044-conversion-revenue-and-attribution-integrity.md)  
**Implementation order:** 0025 of 0033

## Implement this slice

Add RFC-0044's consent-aware checks linking advertised plan/price, checkout configuration, conversion events and downstream analytics evidence. Reuse existing GA4, Stripe read-only attribution and conversion services; distinguish delivery failure from missing consent or sparse traffic.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A sandbox-only scenario catches a mismatched plan or broken debug event; no live payment is created and uncertainty is labeled.

## Explicit boundary

Do not claim complete attribution or perform unauthorized live billing writes.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0026](0026-operate-bounded-growth-and-content-decay-campaigns.md)
