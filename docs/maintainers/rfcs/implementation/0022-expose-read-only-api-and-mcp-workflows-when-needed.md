# IRFC-0022: Expose read-only API and MCP workflows when needed

**Status:** To be reconciled against current `develop` before writing code  
**Priority:** Demand-gated expansion; if no validated buyer demand, record a skip and continue  
**Prerequisites:** IRFC-0019  
**Canonical technical specification:** [RFC-0041](../0041-versioned-api-mcp-and-event-subscriptions.md)  
**Implementation order:** 0022 of 0033

## Implement this slice

Introduce RFC-0041's versioned read APIs and MCP tools for changes, facts, claims, impacts, approvals pending and verification states. Reuse withMcpProjectAuth and current output schemas. Event subscriptions need signed delivery, idempotency, backoff, tenant scoping and consent.

Read the linked source RFC in full, including its safety decisions, persistence requirements, migration contracts and verification sections. Inspect the latest branch before implementing: completed functionality is **reused**, not reimplemented. The source RFC number is a stable historical identifier, not an additional implementation step.

## Acceptance gate

Authorized clients receive filtered, paginated facts and evidence; unauthorized clients cannot escalate via MCP or replay old signed events.

## Explicit boundary

No general agent permission to approve, merge, deploy or send communications.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- Where actual customer/provider acceptance is necessary, state what was tested with fixtures versus a live authorized site. Never treat a test fixture or an unmerged PR as a paid customer outcome.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**; if its commercial gate fails, mark **skipped/deferred** with the evidence. Do not block later unrelated work.

**Next:** [IRFC-0023](0023-persist-page-history-and-prevent-repeated-ineffective-work.md)
