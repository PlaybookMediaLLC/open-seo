# IRFC-0033: Consider multi-website and portfolio operations

**Status:** Completed in code on 2026-10-27 at the owner's request; the acceptance gate below is not yet met  
**Priority:** Optional engineering investment; skip unless the stated entry criteria are met  
**Prerequisites:** IRFC-0007, IRFC-0019  
**Canonical technical specification:** [RFC-0007](../0007-portfolio-operations.md)  
**Implementation order:** 0033 of 0033

## Implement this slice

Reopen RFC-0007's deferred portfolio functionality only with repeat customer demand. Provide cross-site oversight without weakening the existing per-project organization and entitlement boundaries; reuse site-level health, cost and reporting records.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A pilot customer with multiple authorized websites reviews independent coverage/cost/approval state and tests cross-tenant denial.

## Explicit boundary

Do not implement portfolio features for a single-site customer or imply existing closed RFC-0007 meant portfolio shipped.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

## Completion note — 2026-10-27

**Completed** in code, ahead of the demand gate, because the owner asked for RFC-0007 section 6 to be built. No pilot customer with multiple authorized websites has reviewed it yet, so the acceptance gate above is **not met** and this does not count as commercial evidence.

- What was built, item by item: [RFC-0007 section 6](../0007-portfolio-operations.md#6-design-sketch-and-what-was-built). Design record: [Portfolio operations](../../specs/portfolio-operations.md).
- Tests, on SQLite and Postgres: `src/server/features/publishing/PublishingApproverService.test.ts`, `src/server/features/portfolio/services/PortfolioService.test.ts`, the RFC-0007 tenancy suite (`src/server/features/growth/tenancy.test.ts`), plus the share page, link preview and dashboard cache tests in `src/server/features/reports/` and `src/server/features/dashboard/`.
- Fixtures versus live: every test above uses fixtures. RFC-0007 section 9 then ran against this code on a local hosted-mode server with two accounts in two organizations, and all 24 checks passed, along with the two-account MCP isolation suite (85 checks). Production acceptance waits for the deploy. Neither run is a customer or a payment.

**Next:** End of current implementation series.
