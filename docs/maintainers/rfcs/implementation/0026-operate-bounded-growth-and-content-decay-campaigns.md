# IRFC-0026: Operate bounded growth and content-decay campaigns

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0023  
**Canonical technical specification:** [RFC-0020](../0020-growth-campaigns-and-decay-recovery.md)  
**Implementation order:** 0026 of 0032

## Implement this slice

Start RFC-0020 **phase 1** with approved existing-page snippet and link changes, conservative slow-decay detection, scoped campaigns, stop rules and measurable follow-up. Reuse existing opportunity signals and proposal safeguards; richer refreshes follow accepted facts.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A customer-approved page campaign ships a verified change or produces an honest no-action result, with cooldowns preventing repeated identical work.

## Explicit boundary

No high-volume autonomous content generation.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0027](0027-create-individually-reviewed-pages-from-verified-facts.md)
