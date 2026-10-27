# RFC-0031: Platform governance, privacy, metering, data lifecycle, and service quality

- **Status:** Proposed cross-cutting architecture contract
- **Date:** 2026-10-27
- **Implementation position:** Foundation: security, scope and cost invariants; implement with every slice
- **Dependencies:** RFC-0030 (domain boundaries); existing RFC-0001 (access), RFC-0007 (tenancy), RFC-0009 (spend and audit), RFC-0025 (preview safety) and RFC-0026 (pilots). This is a cross-cutting invariant from the first slice; later RFCs are consumers, not prerequisites.
- **Owner:** Platform/security + product owners

## 1. Why this RFC exists

Relay's new direction increases the consequences of a mistake: facts about pricing or product availability can affect buyer decisions; account and CRM connectors can reveal sensitive information; approved changes may affect customer-facing production material. A generic agent layer or additional dashboards won't solve data isolation, explicit delegation, rate/cost limits, verification, or recovery. This RFC provides cross-product operating limits, not a claim of a compliance certification.

**Decision:** use the current Relay tenant model, credential patterns, auditable approvals and billing admission systems as the foundation. Introduce new authority only in separately reviewed action classes. Never infer an authorization from “admin created a connector” or “model confidence is high.”

## 2. Tenancy and data access invariants

- Every customer-owned row belongs to `project_id` and is reachable only through a project authorized to the active organization. Relationship edges additionally validate their target's project.
- `organizationId` and project membership come from existing authenticated server context, not client parameters or tool output.
- Each source credential is bound to an external account/installation and a project-approved source scope. A shared organization connection may be reused only through an explicit project grant; it must not leak data between projects.
- Support one project with multiple repositories/sources without relying on “active GitHub repo” as a universal global variable. Source conflicts and ambiguous account mapping block actions.
- Browser, MCP, internal-job and API entry points must call the same service-level authorization. `withMcpProjectAuth` is a starting pattern, not a blanket authorization for new writes.
- Data indexes/search/embeddings must apply hard tenant isolation; verify deletion of per-project search entries and temporary blobs.

## 3. Sensitivity and minimum data policy

| Data class | Examples | Default policy |
|---|---|---|
| Operational metadata | asset key, repository SHA, check status, timestamps | retain by project plan and erasure policy |
| Product facts | public pricing, integration status, approved feature availability | typed versions + source references, no unrelated personal data |
| Internal source evidence | private repo snippets, config diffs, owned docs | minimum exact bounded excerpts; short-lived protected backing object only if necessary |
| Customer/user content | support ticket excerpts, CRM account metadata | off by default; purpose-specific consent, redaction and restricted access |
| Secrets/identity | API keys, OAuth refresh, passwords, customer emails | existing encrypted secret storage; never copy into PRE graph/model/logs |
| Payment/analytics | aggregates, plan metadata, Stripe references | read-only where appropriate; avoid reconstructing personal financial profiles |
| Generated media/snapshots | browser screenshots, traces, PDFs, Shots handoffs | scoped access, redaction, short retention, explicit delete |

Build a privacy inventory per connector and classify if any proposed new processing changes published terms/DPA requirements. Existing RFC-0017's GitHub Issues support flow is controlled behind a server switch and remains subject to its privacy follow-ups. Do not import full support tickets into PRE without a separate review.

## 4. Approval and action authorization

Authorization layers:

1. **Project access**: user may see project data.
2. **Source scope**: connector may read declared external objects.
3. **Action-class permission**: actor may prepare/read/write a specific kind.
4. **Exact action consent**: reviewer approves immutable diff/target/fingerprint and expected source version.
5. **Fresh preflight**: destination account, token scope, current source revision, evidence generation and policy version still match.
6. **Destination protections**: CI, branch protection, preview, customer merge/deployment remain in force.

Only the existing GitHub-approved PR flow is initially available for mutations. Standing approval, automatic merge, outbound customer communication and financial configuration changes remain excluded until separate policy/risk reviews and verified paid demand. The `WORK_APPROVALS` enum in `src/db/work.schema.ts` represents **required action**, not delegation.

Add append-only audit events for source grants/revocation, fact attestation, impact overrides, approvals, execution, verification and erase operations. Reuse `audit_events` for broad timeline and keep detailed domain histories in their tables. Avoid sensitive source text in summaries; changes to the shared `AUDIT_ACTIONS` enum require aligned schema, presentation and tests.

## 5. Cost and metering model

Separate purchased research credits from the operational allowance of Protect/Sync/Launch. Existing `autumn.config.ts` offers a free research tier, $10 research plan and top-ups; **it does not establish paid PRE entitlements**. RFC-0026 establishes pilot evidence before new SKUs are committed.

Proposed metering dimensions:

| Dimension | Meter and failure control |
|---|---|
| Protected pages and journeys | counted enrolled scope, successful checks, browser minutes |
| Website fetch/render | request count, bytes, CPU/browser seconds, concurrency |
| Source connectors | API calls, paged objects, refresh frequency and provider billable usage |
| Fact/asset extraction | processed changed files, tokens, candidate claims, deduplicated versions |
| Impact runs | exact comparison count, semantic candidates/embeddings where used |
| AI drafting | input/output tokens, chosen model, per-project hold/settlement |
| Reviewed external actions | PRs, CMS writes, destination sends, receipt lookups |
| Support/operations | staff interventions, false alerts, retry volume and customer support minutes |

Use the existing spend-admission/settlement discipline before paid calls; meter actual incurred provider cost even when decoding provider payload fails. Scheduled background jobs must never silently burn research credits without customer-visible policy. Quotas are explicit per plan, by project and organization; when exhausted, mark only the affected feature degraded while preserving contracted basic protection as long as it is still operationally available.

Provide a cost ledger distinct from customer invoices: `reality_usage_events(project_id, kind, run_id, units, unit_cost_estimate, provider_actual_cost, billed_credits, settled_at, error_code)` and `reality_usage_reservations` only if existing billing tables cannot model the event. Do not create a shadow billing engine or double-charge existing DataForSEO requests. Add reconciliation and expiration semantics for uncertain third-party charges.

## 6. Operational service states and coverage

`service_state` is independent of `billing_state`, `integration_state`, `coverage_state` and `verification_state`. A paid but disconnected project is not “protected.” Operational states: `setting_up`, `active`, `degraded`, `paused`, `ended`; reason codes include stale source, revoked permission, billing issue, operational cap, unsupported route and provider outage. `active` requires checks within contracted cadence and a contact/response owner.

For each offer define what is covered, what is excluded, how often checks run, whether retries occur, expected manual work and what does **not** constitute a guarantee. Never promise instantaneous alerting from the current quarter-hour Worker job scheduler. Measured latencies and reliability precede an SLA statement.

High-priority alerting must include dedup, incident confirmation, cooldown, channel routing and user-configured quiet hours. Repeated failures should escalate to clear degraded protection, not silently drop jobs. A “no issues” report needs a recent successful scan and scope denominator.

## 7. Storage, migrations and isolation architecture

Use existing `src/db/schema.ts` switching, Drizzle paired `src/db/*.schema.ts` and `src/db/pg/*.schema.ts`, `drizzle/sqlite` and `drizzle/pg` migrations, `runBatch` for transaction semantics and `src/db/schema-parity.test.ts`. Keep D1 request/parameter limits explicit; commit in bounded batches, not huge all-in-memory arrays.

Versioned facts and snapshots are immutable; deleting the project cascades core rows and queues deletion of private R2 blobs, derived embeddings and provider tokens. Record tombstones for delete workflows in a separate minimal audit context as needed. Do not retain source payloads forever under the guise of “learning.” Every resource has retention TTL, last-read tracking where appropriate, and an erasure procedure.

Cross-tenant isolated preview builds, if attempted under RFC-0025, require separate Worker/container privileges, outbound egress policy, dependency-network restrictions, capped artifact lifetime and destruction verification. Never run an untrusted customer repository build in the main application Worker.

## 8. Threat model and critical failures

| Threat/failure | Required defense |
|---|---|
| Cross-tenant guessable record ID | membership-gated access and tenant-filtered joins; integration tests |
| Malicious source/document prompt injection | treat all retrieved text as data; typed allowlisted tool operations; exact human approval |
| SSRF through public URLs or webhook destination | URL policy + redirect checks + private-IP/DNS protection + network egress policy |
| Replay/forged provider webhook | signed verification, timestamp window, event ID/hash idempotency |
| Unknown provider write outcome | reconcile before retry; preserve external receipt and blocked state |
| Key leak/log spill | encrypted tokens, scoped secrets, no raw headers/bodies in logs, rotation and detection |
| Unauthorized customer messaging | no generic send tools; consent list/recipient review and separate future action class |
| False pricing or compliance claim | authoritative typed facts, scope, strict review for financial/legal claims |
| Model/provider outage | deterministic checks continue; AI-dependent drafting degrades visibly |
| Broken spend settlement | durable hold and reconciliation; no unbounded retries or model work |
| Stale deployment attribution | explicit unknown/attested state, no false verified label |
| Excessive crawling/billing | hard per-source/time/request/byte/model budgets, backpressure and customer report |

## 9. Quality gates and test coverage

- **Data:** SQLite/PG migration parity, unique constraints, scope overlap, retention and erasure.
- **Security:** project/organization isolation matrix covering each service, server function, MCP tool, background job, webhook and asset retrieval; source-scope regression tests.
- **Reliability:** provider 401/403/429/500, retries, replay, time skew, multi-worker concurrency, revocation mid-action, circuit breaker, partial pagination and unknown writes.
- **Safety:** prohibited form submission, private URL, unsupported build, unreviewed outbound message, financial write, malformed MDX and unauthorized PR.
- **Cost:** load scenarios with tens of sources, thousands of asset references and bounded facts; prove at least one protection limit stops uncontrolled fan-out with visible degradation.
- **Operability:** connector dashboard, run history, per-project usage costs, alert test, cancel/pause/disconnect, audit visibility and support runbook.

## 10. Delivery phases and blocked claims

**A:** global authorization/evidence invariants in CI and existing schema patterns, plus platform threat-model review before broad PRE rollout.

**B:** metering/retention controls for source ingestion, facts, claims and impact; support manual kill switch per connector/project.

**C:** Protect/Sync/Launch entitlement boundary after customer payments and actual cost profile justify plans.

**D:** enterprise policies, customer-managed keys, SSO and formal compliance features only if qualified customers pay and the team can operate them reliably.

Do not claim SOC 2, GDPR compliance certification, enterprise availability SLA, or PCI scope reduction simply because the RFC specifies good controls. Compliance involves separate processes, legal review and independent evidence.

## 11. Alternatives

Reject implementing a second identity/billing platform, unmetered scheduled AI calls, storing all content forever, treating subscription payment as proof of monitoring coverage, and using temporary credentials as permanent delegation.
