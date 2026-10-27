# RFC-0030: Product Reality Engine — architecture, boundaries, and delivery contracts

- **Status:** Proposed for design review; no implementation claimed
- **Date:** 2026-10-27
- **Implementation position:** Foundation: minimum shared identity and evidence types; evolve incrementally
- **Product:** Relay (Playbook Media LLC)
- **Owner:** Product and platform engineering
- **Dependencies:** Existing RFC-0005 (GitHub publishing), RFC-0008 (jobs), RFC-0009 (audit and spend), RFC-0017 (docs), and RFC-0019/0026–0028 (Protect). Commercial delivery is gated by RFC-0029.
- **Decision requested:** Accept one evidence-led change model shared by Protect, Sync, and Launch; build in bounded slices, without replacing existing SEO infrastructure.

## 1. Problem and decision

Today, Relay can research SEO issues, index Markdown documentation, prepare selected exact-change GitHub proposals, and record measurements. It cannot yet take an ordinary product change, establish which product facts are affected, identify every relevant customer-facing asset, organize approved work across systems, and prove that the consequences of the change have been addressed. Several older RFCs address local pieces; none specifies their shared contract.

**Decision:** introduce the **Product Reality Engine (PRE)** as a domain layer, not a new data warehouse or generalized autonomous-agent platform. Each project contains bounded, source-backed records of observed changes, assertions about the product, externally published claims, affected assets, proposed actions, and verification results. All downstream actions are linked to that evidence. Relay stays useful if no AI model is available.

### Core questions

1. What changed? Record a concrete source revision or observation, not an LLM summary alone.
2. What is true, for which audience, at which time? Treat feature flags, region, subscription tier and effective dates as first-class scope.
3. Where is a potentially inconsistent claim or broken journey? Preserve the original artifact and exact observation.
4. What should be done, by whom, with what authority? Explain why every proposed action is warranted.
5. Did the action reach production or the destination system? Record independent technical and business outcomes.

## 2. Product boundaries and explicit non-goals

**Initial commercial offer:** Protect, restricted to selected pages and safe checks on authorized GitHub-managed Next.js sites. Sync is the first adjacent experiment, initially read-only price/plan/integration accuracy. Launch is a later coordinating layer. Broad CRM writes, customer emailing, CMS publishing, feature-flag changes, subscription modifications, and autonomous merges are **out of scope** for v1.

Do not rebuild a generic CRM, analytics suite, help desk, billing system, vector database, CMS, or orchestration service. Existing providers remain authoritative for their own operational state. A detected code diff is not proof of deployed behavior. An approved press release is not proof customers received it. A tracking event is not proof of attributable revenue.

### Reusable code and factual status

- `src/db/app.schema.ts`: existing project and organization ownership; use these, not a parallel tenancy model.
- `src/server/features/publishing/MetadataExecutionService.ts` and `src/server/features/publishing/publishingAccess.ts`: exact-change approval, repository checking and GitHub PR creation; preserve their guarantees.
- `src/server/features/docs/docsIndex.ts`: GitHub-backed docs outlines, currently limited to 500 files / 10 MB and 200 changed-file reads per run; reuse carefully and add separate asset claims only as needed.
- `src/server/features/growth/GrowthJobService.ts`: scoped jobs and retry handling; no competing queue if current scheduler can meet the latency contract.
- `src/db/work.schema.ts`: weekly work entries; this is presentation/selection, not generalized approval authority.
- `src/server/mcp/tools/growth-tools.ts`: project-authorized, read/draft tools; keep approval and deployment outside MCP.
- `docs/maintainers/relay-release-assurance-audit.md`: implementation inventory and acceptance caveats.

Source links: `https://github.com/PlaybookMediaLLC/relay/tree/develop/`. Current default branch is `develop`; the older `open-seo` repository URL redirects to Relay. We have inspected repository source, not run its complete deployed workflows.

## 3. Bounded context and domain ownership

| Context | Canonical record | Authoritative for | Must not claim |
|---|---|---|---|
| Connectors (RFC-0032) | Connected source, cursor, delivery | Provider access and observations | Truth of an inferred claim |
| Change intake (RFC-0033) | Source event, normalized change | What source reported and when | That a release is deployed |
| Facts (RFC-0034) | Scoped fact/version/evidence | Accepted product assertion | That all audiences see it |
| Assets & claims (RFC-0035) | Asset, version, occurrence | What a captured surface said | That statement is correct |
| Impact (RFC-0036) | Candidate or confirmed impact | Why an item may require work | Permission to change it |
| Work (RFC-0037) | Work item, proposal, approval, execution | Who approved exactly what | That publication succeeded |
| Verification (RFC-0038) | Check, run, receipt, resolution | What passed in which environment | Causal growth or revenue lift |
| Commercial offers (0040, 0042–0046) | Product-specific configuration | Customer promise and scoped workflow | Platform-wide capability |

Do **not** use an unrestricted `entity_id -> entity_id` graph as the primary source of truth. Use explicit foreign keys for core relations; typed linkage tables may represent extensible relationships, with target-kind constraints verified in services and tests. Never use JSON strings to hide relational joins.

## 4. Proposed data shape and event flow

All persistent business tables are `project_id` scoped; organization identity is confirmed from the existing project membership rather than accepted from the caller. Use UUID/ULID IDs without embedding customer secrets. Add paired SQLite D1 and PostgreSQL Drizzle schema files, both migration sets, parity tests, and real-database query tests.

```text
ConnectedSource -> IngestEvent -> Observation -> ProductChange
                                           |             |
                                           v             v
                                       FactEvidence  ImpactCandidate
                                           |             |
                                      FactVersion      WorkItem
                                           |             |
Asset -> AssetSnapshot -> ClaimOccurrence -+       Proposal + Approval
                                           |             |
                                           +-------- Verification
```

For each source delivery: authenticate and bound it, persist a deduplicated envelope, parse to typed observations, associate a source version and change candidate, reconcile facts/assets, assess impacts, and schedule read-only or explicitly authorized downstream work. A delivery may generate zero changes; a change may generate zero work. All transitions must explain their evidence.

### Required identifiers

- `projectId`: immutable project tenancy scope.
- `sourceId + externalObjectKey + externalRevision`: versioned provider identity; do not key solely by human-readable title.
- `observationId`: immutable record of what was seen, with collection/observation times.
- `changeId + changeVersion`: deduplicated logical change and its revisions.
- `factId + factVersionId`: stable fact identity with immutable scoped assertions.
- `assetId + assetSnapshotId`: stable canonical asset and what one version actually contained.
- `impactId`: candidate or confirmed downstream consequence of a change.
- `workItemId + proposalFingerprint`: specific requested action and exact authorized payload.
- `verificationId + verificationRunId`: expected postcondition and immutable attempts.

## 5. Execution and correctness rules

**Evidence is immutable.** Correcting a source interpretation appends a newer version and supersedes conclusions; do not quietly edit old evidence or erase disagreement.

**No leap from detection to action.** Confidence thresholds only rank candidates. Publication requires an action-specific permission and approved exact payload. A "high confidence" model output never grants authority.

**Different clocks.** Keep `occurred_at`, `observed_at`, `effective_at`, `published_at`, `verified_at` and `measurement_window` separate. Search outcomes require longer windows than immediate technical verification.

**Stable while degraded.** Connector downtime, rate limiting, unknown revision, expired authority, unsupported content and stale baselines produce `unknown`, `degraded`, or `blocked` rather than `passed`. Quiet periods are valid only when checks ran successfully.

**No fabricated facts.** Agent generation produces candidate assertions with citations; humans or explicitly designated trustworthy source adapters promote them to accepted facts. A published claim can legitimately differ by region, audience or grandfathered account.

**No retroactive authority.** Each action carries the policy/approval version and target revision. Revocation, a newer source revision, or a changed proposal invalidates the authorization before side effects.

## 6. Top-level service contracts

Proposed interfaces, not code already shipped:

```ts
type RealityContext = {
  projectId: string;
  actor: { kind: 'user' | 'service'; id: string };
  expectedProjectVersion?: number;
};

type EvidenceRef = { kind: 'source_event' | 'observation' | 'asset_snapshot' |
  'fact_version' | 'verification_run'; id: string; sha256: string };

type Decision<T> =
  | { state: 'supported'; value: T; evidence: EvidenceRef[] }
  | { state: 'candidate'; value: T; evidence: EvidenceRef[]; questions: string[] }
  | { state: 'blocked'; reasonCode: string; evidence: EvidenceRef[] };

interface RealityEngine {
  assessChange(context: RealityContext, changeId: string): Promise<Decision<{impactIds: string[]}>>;
  getChangeTimeline(context: RealityContext, changeId: string): Promise<unknown>;
  prepareWork(context: RealityContext, impactId: string): Promise<Decision<{workItemId: string}>>;
}
```

Public handlers should use TanStack server functions → service → repository, Zod at untrusted boundaries, the existing organization gate, audit trail and spend-admission rules. This interface is conceptual; implementation types must use project schema conventions and explicit error unions.

## 7. Deployment topology

Keep source ingestion and read operations in the existing Cloudflare Worker where resource access and budgets permit. Long-running but bounded work uses the existing scheduled job/Workflow infrastructure; avoid creating a second job engine. Store only normalized records in D1/PG. If raw supporting blobs are needed, use expiring, private, authenticated R2 objects keyed by project, with a database reference, checksum and deletion schedule. No user-supplied executable code may run in the application Worker. Proposed isolated previews in RFC-0025 remain separately gated.

An integration capability must be explicitly enabled for each customer project. Self-hosted and hosted modes keep the same domain semantics, but disable unsupported providers with an actionable message.

## 8. Delivery sequence and measurable exits

| Slice | Shipment | Exit condition |
|---|---|---|
| 0 | Record one manually reviewed product change, facts, asset and impact via internal services | Links persist and read back with correct tenancy and provenance, no AI needed |
| 1 | GitHub change observations and documentation/marketing asset outlines | Deterministic replay produces same logical change, no duplicated impact work |
| 2 | Narrow price/plan/integration claim comparison for Sync | At least one seeded contradiction found, one valid audience-specific difference not falsely flagged |
| 3 | Human-review work item and existing GitHub proposal integration | No write until exact approval and current-source revalidation |
| 4 | Independent production/content verification and full timeline | An observed customer fix and a Relay-generated fix are attributed separately |

Do not gate the existing Protect pilot on completion of the whole PRE. Integrate Protect events incrementally after their original acceptance tests pass.

## 9. Security, cost, and operational limits

- Enforce project/organization authorization on every read, mutation, job and MCP tool. Foreign-key scoping alone is not enough for joins.
- Per-source request quota, bounded fan-out, content-size caps, replay window, concurrency and metered model budgets must be explicit per connector.
- Respect terms of service, consent, robots and provider permissions; do not turn asset discovery into arbitrary credentialed scraping.
- Every network fetch must reuse or exceed the repository's SSRF protections, with redirect checking and deployment-level egress isolation where available.
- Audit evidence promotion, overrides, proposal approval, credential changes and outbound actions.
- Retention and deletion: purge inaccessible raw provider content quickly; do not store support text or personal profiles in the core fact graph by default. Build project erase coverage before activating sensitive connectors.
- Product analytics must not count a `suggested` finding as `fixed`; measure confirmed action, verified resolution, payment and renewal separately.

## 10. Rejected approaches

1. **One all-knowing LLM agent:** no defensible authority, replay, permission or reliability contract.
2. **Vector DB as source of truth:** semantic search helps retrieval but cannot enforce typed constraints, temporal validity or exact approvals.
3. **Rewrite the SEO app first:** burns existing working integrations while delaying first payment.
4. **Ship all twelve business modules first:** creates superficial integrations with no repeatable outcome.
5. **Auto-publish based on high confidence:** confuses content plausibility with customer authorization.

## 11. Acceptance and independent review

- SQLite and Postgres migrations, schema parity, foreign-key cascade and unique-constraint tests pass.
- An unauthorized user in a different organization cannot read, correlate or execute any PRE record; all join paths are tested.
- Duplicate/out-of-order provider events do not generate duplicate logical work.
- Revoking a connector after detection but before action blocks the action.
- Contradictory, stale and missing evidence are represented distinctly; none silently becomes truth.
- Project deletion and authorized erasure remove sensitive stored material and queued actions.
- Network budget and model budget are visible, enforced and recover after failure.
- Instrument one complete staged change→asset→impact→review→verification path and retain a reviewable timeline.
- Independent technical/security review required before any new connector with outbound writes.

**Not a commercial success claim:** these are engineering exit conditions. Paid adoption and retention belong to RFC-0029 and RFC-0026.
