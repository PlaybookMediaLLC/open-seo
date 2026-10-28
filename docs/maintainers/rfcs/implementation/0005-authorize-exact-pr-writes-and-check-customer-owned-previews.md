# IRFC-0005: Authorize exact PR writes and check customer-owned previews

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0004  
**Canonical technical specifications:** [RFC-0027](../0027-source-mapped-regression-repairs.md), [RFC-0025](../0025-preview-sandboxes-on-cloudflare.md)  
**Implementation order:** 0005 of 0032

## Implement this slice

Complete RFC-0027 **phase B** and RFC-0025 **phase 1a only**. Bind explicit user approval to the exact source/evidence fingerprint and PR head SHA; reuse customer-provided Vercel, Netlify, Cloudflare, or other authorized preview URLs, CI results and current release-quality rules.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

An approved PR is opened once and tested on the exact commit. Missing, stale, redirected, or mismatched preview evidence is visible and cannot be treated as passed. Customer owns merge and deployment.

## Explicit boundary

Do not build Relay-owned Cloudflare sandboxes, standing approval policies, or auto-merge.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0006](0006-verify-repaired-behavior-in-production.md)
