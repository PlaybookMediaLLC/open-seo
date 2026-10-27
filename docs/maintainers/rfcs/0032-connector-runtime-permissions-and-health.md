# RFC-0032: Connector runtime, credential scope, source contracts, and operational health

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Foundation: minimal connector contract for authorized GitHub/manual sources
- **Dependencies:** RFC-0030 (shared domains) and RFC-0031 (permissions/security); existing authorized GitHub, GSC, GA4, Stripe, Google OAuth and RFC-0009 credential/billing systems. RFC-0033 consumes source observations; additional adapters remain demand-gated.
- **Purpose:** Let Relay observe and eventually act in external systems without producing an unrestricted credential hub.

## 1. Decision and scope

Build an internal connector **contract** around existing project-scoped integrations. Do not replace working OAuth clients, Better Auth encryption, existing publishing transport, billing holds or source-specific repositories. Introduce a consistent capability manifest, consent view, checkpoint/health model and bounded operation adapter for **new** integrations. Existing connections are wrapped gradually.

First adapter wave: GitHub read and approved PR write (already partly built); selected public websites; Search Console and GA4; GitHub Issues for support signals (behind its current privacy switch); provider-specific read-only billing/plan metadata only after customer demand. Next wave, gated: feature flags, docs/CMS, CRM and support help desks, release communication providers.

## 2. Capability manifest

```ts
type ConnectorCapability =
  | "changes.read"
  | "product_facts.read"
  | "assets.read"
  | "metrics.read"
  | "releases.read"
  | "issues.read"
  | "repo.pr.create"
  | "docs.write"
  | "crm.asset.write"
  | "messages.send";

type ConnectorManifest = {
  provider: string;
  adapterVersion: number;
  capability: ConnectorCapability[];
  permissionsByCapability: Record<string, string[]>;
  hasWebhook: boolean;
  hasCursor: boolean;
  minPollIntervalSeconds: number;
  maxRequestBytes: number;
  supportsIdempotentWrite: boolean;
  supportsDryRun: boolean;
};
```

The manifest describes capabilities verified against the provider API and actual granted scopes. It is not permission by itself. Surface capabilities at the project level as `connected`, `partial`, `disconnected`, `permission_revoked`, `degraded`, or `unsupported`.

## 3. Credential and tenancy model

- Reuse provider-specific credentials already stored under Better Auth/managed secret patterns where applicable. A new connection stores a **credential reference**, never a token in impact/work tables.
- Bind connection to organization, project, external account ID, approved scope, and actor who granted it. Verify external account identity after OAuth; don't accept caller-supplied account IDs as proof.
- Refresh/revoke under existing secret encryption with key rotation plan and audit. A disconnected connection cancels pending jobs and invalidates unexecuted approvals whose target depended on it.
- Scheduled jobs re-check that the owning member still has required current permission; the source's service token cannot bypass project authorization.
- A project may have multiple external accounts of the same provider, but one action must identify exactly one target account; refuse ambiguous resolution.
- OAuth redirects use issuer/state/PKCE and exact registered redirect URI checks. Limit scopes to the configured capability and re-consent for upgrades.

## 4. Normalized service interface

```ts
interface ReadConnector<TItem> {
  capabilities(context: ConnectorContext): Promise<CapabilityStatus>;
  enumerate(
    context: ConnectorContext,
    cursor?: string,
  ): Promise<{
    items: TItem[];
    nextCursor?: string;
    coverage: "complete" | "partial";
  }>;
  getRevision(
    context: ConnectorContext,
    externalId: string,
  ): Promise<string | null>;
}
interface WriteConnector<TProposal, TReceipt> {
  preflight(
    context: ConnectorContext,
    proposal: TProposal,
  ): Promise<PreflightResult>;
  execute(
    context: ApprovedActionContext,
    proposal: TProposal,
  ): Promise<TReceipt>;
  reconcile(
    context: ConnectorContext,
    executionId: string,
  ): Promise<TReceipt | "unknown">;
}
```

Separate reads and writes in runtime API and permissions. No direct arbitrary `fetch(url,method,body)` adapter exposed to model-generated plans or MCP. Provider-specific operations define typed targets and exact allowed methods. Use existing `connectedGithub` and publishing services for GitHub rather than a second PR client.

## 5. Ingestion, webhooks, and cursor rules

Webhook admission: verify provider signatures, timestamp tolerance and bound body **before** parsing JSON; map to a known project/connection; persist delivery ID and hash; enqueue normalized observation; never trust webhook body for new account/permission grants. For providers with no webhook, use incremental polling with overlap and idempotency as RFC-0033 specifies. Cursor advances only after durable successful data writes.

Enforce connector-level request budget, rate-limit retry, backoff/jitter, concurrency, maximum pages and content sizes. If a source partially returns data, expose `partial` and do not infer that missing items were deleted or that public facts are correct.

## 6. Security and data minimization

**Default deny:** connector reads only declared resource categories, selected projects, accounts, repositories and domains. Customer authorization is per integration and per action. For future CRM/support data, prefer aggregate/metadata extraction and early redaction; no need to persist raw contact messages in product-fact tables. Use a DPA/privacy review before expanding sensitive support processing beyond GitHub Issues's current controlled path.

Protect outbound HTTP from SSRF: fixed provider base URLs for APIs, validated user-owned origins for website checks, redirect validation, DNS/private-address protections and network egress controls. Disallow local metadata endpoints, arbitrary proxying and user-submitted webhook destinations unless explicitly verified.

Avoid leaking source, token, or recipient information into errors, logs, model prompts or telemetry. Store short bounded summaries and hashed evidence locators. Token scopes must be shown in onboarding plainly.

## 7. Provider-specific phase decisions

| Provider              | Initial required capability                                                    | Outbound action gate                                        |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| GitHub                | immutable file/release reads; selected repo                                    | reuse exact proposal human approval (RFC-0005/0027)         |
| GSC/GA4               | read-only analytics with consent and coverage                                  | no analytics writes                                         |
| Public website        | safe origin-bound read                                                         | no website write outside reviewed repo edit                 |
| Stripe                | only contracted plan metadata / read-only where provider access permits        | no plan/entitlement/price writes                            |
| Feature flag platform | read-only flag definitions, scope and rollout evidence                         | no flag changes                                             |
| Docs/KB               | read approved space/article versions                                           | later security-reviewed write adapter with exact review     |
| CRM                   | approved asset metadata and relevant release interest signals, where consented | never sync/send automatically in v1                         |
| Email/campaign        | draft destinations and delivery receipts                                       | send requires separate explicit approval and consent policy |

## 8. Health, capacity and erasure

An integration dashboard must distinguish OAuth connected from current access working; show last successful snapshot, last attempt, lag, permissions, scope coverage, retries, degraded reason and next action. Overall product protection cannot show healthy while a critical connector is stale. Count connector expenses and data processing time per customer project for gross-margin reporting; use existing billing/spend admission where paid APIs are involved.

Deletion removes stored provider data, references, transient R2 blobs, search indexes, pending jobs and credentials under documented retention/legal constraints. Revocation must not remove the audit that explains prior authorized actions, but the audit must remain minimal and non-sensitive.

## 9. Acceptance

- No new connector can grant write authority during a read-only authorization flow.
- A revoked/expired token stops ingestion and any queued actions; no stale approvals execute.
- Replayed/out-of-order webhooks converge to same effective observation state.
- A partial paged result is not treated as an empty source.
- Cross-project source IDs and account mismatch cannot be accessed from another tenant.
- Two accounts at one provider cannot be confused during action preparation or verification.
- Fake signature, OAuth state replay, redirect to private IP, oversized payload, provider 429 and failed refresh produce bounded failures.
- One genuinely consented end-to-end connector acceptance test and documented pricing/rate limit assumptions precede activation.

## 10. Alternatives

Reject replacing provider-specific stable clients with a generic connector framework, centralized unscoped API keys, allowing a model to issue arbitrary REST calls, and launching a universal integration marketplace before two paying customers need the same new adapter.
