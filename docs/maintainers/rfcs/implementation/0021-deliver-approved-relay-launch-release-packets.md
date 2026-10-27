# IRFC-0021: Deliver approved Relay Launch release packets

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Commercial decision gate; proceed only with buyer evidence  
**Prerequisites:** IRFC-0019  
**Canonical technical specification:** [RFC-0042](../0042-relay-launch-change-to-commercial-release.md)  
**Implementation order:** 0021 of 0033

## Implement this slice

Start with RFC-0042's manual, fact-backed release packets: affected site pages, docs, launch copy, visual asset requests, sales tasks, ownership and per-artifact verification. Use a stable launch lifecycle with factual eligibility and cohort scope; reuse RFC-0023 checks if available.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

A customer completes one coordinated launch with all required artifacts linked to evidence, explicit approval state, and publication receipts, without invented availability claims.

## Explicit boundary

No automatic mass emailing, CRM segmentation or unsupervised publishing.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0022](0022-expose-read-only-api-and-mcp-workflows-when-needed.md)
