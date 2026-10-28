# IRFC-0007: Productize Protect work reports and recurring service

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0006  
**Canonical technical specifications:** [RFC-0018](../0018-weekly-execution-queue.md), [RFC-0026](../0026-protected-site-pilots-and-service.md)  
**Implementation order:** 0007 of 0032

## Implement this slice

Complete RFC-0018 **phase 1b reporting integration** and RFC-0026 **phase B**: integrate monitored coverage, incidents, approvals, verified repairs, and quiet weeks into This Week, monthly reports, entitlements, capacity, renewal records, and service health. Reuse existing scheduled digests.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Reconcile reports against live records across pilot websites, including a stale monitor and no-incident week; record payments, renewals when due, support and compute costs distinctly from self-reported interest. Commercial evidence stays in the private sales record; the public completion note and PR say only **met** or **not met**, with no names, prices, payment references or costs.

## Explicit boundary

Keep standing approvals and automatic merging deferred.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0008](0008-apply-commercial-stop-go-gates-to-sync-and-launch.md)
