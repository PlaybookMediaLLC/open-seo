# IRFC-0008: Apply commercial stop/go gates to Sync and Launch

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Commercial decision gate; proceed only with buyer evidence  
**Prerequisites:** IRFC-0007  
**Canonical technical specification:** [RFC-0029](../0029-commercial-pilots-rollout-and-go-no-go.md)  
**Implementation order:** 0008 of 0032

## Implement this slice

Use RFC-0029 to record the real decision after the Protect pilot. Define paid validation experiments, unit-economics constraints, customer-access boundaries, procurement objections, and evidence required to move into Sync and Launch. Begin interviews early, but do not mark this gate passed from an impressive prototype.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

One evidence-backed go/no-go record for Protect expansion and a bounded, priced Sync experiment with named buyer and purchasing owner. Commercial evidence stays in the private sales record; the public completion note and PR say only **met** or **not met**, with no names, prices, payment references or costs.

## Explicit boundary

No assumption that research signups equal paid operations demand.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0009](0009-establish-the-minimal-product-reality-engine-kernel.md)
