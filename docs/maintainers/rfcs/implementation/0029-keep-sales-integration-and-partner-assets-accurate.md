# IRFC-0029: Keep sales, integration and partner assets accurate

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Extension; build after the core milestones  
**Prerequisites:** IRFC-0019, IRFC-0021  
**Canonical technical specification:** [RFC-0046](../0046-enablement-integrations-and-partner-assets.md)  
**Implementation order:** 0029 of 0032

## Implement this slice

Implement selected RFC-0046 assets such as feature matrices, approved sales briefs, API integration instructions and partner directory entries. Tie every customer-facing statement to versioned facts, scope and reviewable destination updates.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A feature or availability change finds and corrects an outdated authorized sales/partner asset without leaking CRM data or sending outreach.

## Explicit boundary

No full CRM replacement or mass sales automation.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0030](0030-respond-to-verified-competitor-changes.md)
