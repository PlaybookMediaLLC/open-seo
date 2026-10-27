# IRFC-0031: Evaluate isolated Relay-owned preview builds

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Optional engineering investment; skip unless the stated entry criteria are met  
**Prerequisites:** IRFC-0005, IRFC-0019  
**Canonical technical specification:** [RFC-0025](../0025-preview-sandboxes-on-cloudflare.md)  
**Implementation order:** 0031 of 0033

## Implement this slice

Only after customers cannot use their own previews and demonstrate willingness to pay, run RFC-0025 **phase 0** feasibility and, if approved, phases 1b–2 for isolated Cloudflare builds. Enforce untrusted-code isolation, egress controls, secret separation, resource budgets and teardown.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A reviewed spike proves isolation and bounded costs before a production feature; safe preview result tied to exact source SHA, with cleanup evidence.

## Explicit boundary

Not a prerequisite for customer-owned previews or initial Sync.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0032](0032-evaluate-narrowly-delegated-execution-policies.md)
