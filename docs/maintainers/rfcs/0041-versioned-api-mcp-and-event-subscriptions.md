# RFC-0041: Versioned developer API, read-only MCP, and signed change events

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Optional after stable data models: read-only REST/MCP; subscriptions later
- **Dependencies:** RFC-0030–0040 domain, authorization and Sync records as available; existing MCP project-auth patterns and RFC-0009 audit/rate controls. Read-only tools can ship as soon as their respective data exists; outbound subscriptions are optional.
- **Purpose:** Make PRE useful in CI, approved assistants and customer tools without granting implicit execution rights.

## 1. Product and security decision

Relay should be API-first, but a generic agent with all connector credentials would undermine exact approval and evidence controls. Expose bounded read and draft operations for scoped projects with stable IDs, pagination, documented error/status distinctions and strict authorization. External writes remain behind the Relay app's explicit approval flow and connector-specific execution services.

## 2. REST API version 1 (proposed)

| Method/path | Capability | Required permission |
|---|---|---|
| `GET /api/v1/projects/:id/reality/changes` | list typed changes, filter by state and cursor | project read |
| `GET /api/v1/projects/:id/reality/changes/:changeId` | source/evidence and timeline | project read |
| `GET /api/v1/projects/:id/reality/facts` | list accepted/disputed facts with scope | authorized fact read |
| `GET /api/v1/projects/:id/reality/assets` | asset metadata and covered claims | authorized asset read |
| `GET /api/v1/projects/:id/reality/impacts` | confirmed/candidate issues | project read |
| `GET /api/v1/projects/:id/reality/work` | work status, approval links, verification receipts | project read |
| `POST /api/v1/projects/:id/reality/change-assessments` | trigger bounded read-only evaluation | authorized operator + spend admission |
| `POST /api/v1/projects/:id/reality/drafts` | prepare internal, non-publishing draft | authorized editor + spend admission |

No general API endpoint to approve arbitrary actions, send customer messages, merge PRs or mutate billing/feature flags in v1. In particular, `POST /drafts` returns a reviewable candidate and never executes external side effects.

Consistent envelope: `{ data, meta: {requestId, schemaVersion, generation, coverage, nextCursor?} }`. Errors use enumerated codes `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `STALE_EVIDENCE`, `CONNECTOR_DEGRADED`, `UNSUPPORTED_SCOPE`, `BUDGET_EXHAUSTED`, `RATE_LIMITED`, `UNKNOWN_OUTCOME` and include no source secrets. Use idempotency keys for costly evaluation/draft requests; validate headers and expire keys.

## 3. MCP tools

Build on `src/server/mcp/project-auth.ts` and `src/server/mcp/tools/growth-tools.ts`. Proposed read/draft tools:

- `list_relay_changes`
- `get_relay_change_evidence`
- `list_relay_product_facts`
- `find_relay_impacts`
- `get_relay_work_status`
- `draft_relay_content_correction`
- `get_relay_verification_result`

Tool outputs must carry project ownership, source timestamps, evidence state, truncation and budget metadata. Explicitly mark website, changelog, source code and support text as **untrusted data** in agent-facing context. Every tool uses existing `withMcpProjectAuth` scoping and current permission revalidation; no tools can approve, open approved PRs, deploy or send messages. The existing plugin instructions/version policy in `AGENTS.md` applies to new shipped MCP tools.

## 4. Event subscriptions/webhooks

Optional outbound webhook event types:

- `relay.change.observed.v1`
- `relay.fact.conflict_detected.v1`
- `relay.impact.confirmed.v1`
- `relay.work.approval_required.v1`
- `relay.verification.completed.v1`
- `relay.coverage.degraded.v1`

Use source-generated event ID, project ID, occurred/observed timestamps, object key, state, version and a short signed evidence link. Do not include raw customer credentials, full source blobs, private issues or arbitrary PII. Customer creates and verifies an HTTPS destination; prohibit private-IP redirects and SSRF. Sign with per-subscription secret using HMAC with timestamp and replay window; rotate secrets. Delivery retries with backoff, dead-letter/failed state and audit trail. Events are at-least-once; consumers dedupe `event_id`. Order is not guaranteed; include object generation so consumers can reconcile.

`reality_webhook_subscriptions`: project, destination identity, event filters, verification status, signing-key ref, active and created timestamps. `reality_webhook_deliveries`: event id, subscription id, attempt count, status code, latency, failure category, next retry and expiry. No raw response bodies or bearer headers stored.

## 5. Pagination, filtering and privacy

Use stable cursor `(observed_at,id)` or source-specific generation; sort deterministically. A page is capped by project allowance (pilot target max 100), with `hasMore` and coverage/truncation flags. Role filters are applied before retrieving evidence, not by hiding sensitive fields after reading. API output must honor redaction rules and retention. Organization-wide cross-project aggregation is a later explicit feature requiring authorization and deliberate indexing.

Rate limits: per-token, project and organization, with separate paid evaluation/draft ceilings. MCP should not bypass spend admission. Include `Retry-After` and clear error reason on quota failure. Don't bill for unsuccessful requests that incurred no provider expense; use existing metering/settlement invariants for paid external work.

## 6. Compatibility and versioning

Version external contracts `/v1`, stable enum meanings and explicit deprecation windows. New fields are additive; changing `accepted` to mean “model thinks so” is a breaking semantic change. Include JSON Schema/OpenAPI docs generated from validated Zod contracts where feasible, but code and tests are canonical. Schema migration and API version changes follow separate compatibility review.

## 7. Delivery and acceptance

**A:** read-only REST endpoints for changes, facts, assets, impacts; auth/cursor/scope tests.

**B:** read-only MCP tools with small response caps, untrusted-text warnings and safe links to Relay app review.

**C:** draft endpoint with explicit `prepare_only`, stable idempotency and budget admission.

**D:** signed webhook subscriptions once customers need integrations. Test exact delivery semantics before public release.

Test token revocation mid-request, cross-tenant guessable IDs, missing project, API key scope downgrade, oversized query, prompt injection in returned docs, duplicate/out-of-order outbound events, failed webhook signature validation, timing-window replay, private address, partial source evidence and version compatibility. No generic remote execution tool.

## 8. Alternatives

Reject a single GraphQL/LLM query that executes work implicitly, unscoped workspace agent tokens, webhook payloads containing full source documents, and changing existing MCP authorization to meet a new product deadline.
