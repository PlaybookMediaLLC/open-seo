# RFC-0033: Change observation, ingestion, identity, and provenance

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slice 1: durable manual/GitHub observation with deduplication
- **Area:** Product Reality Engine intake
- **Dependencies:** RFC-0030 (architecture), RFC-0031 (source and tenant controls), RFC-0032 (minimal connector contract); existing RFC-0005 GitHub read/OAuth, RFC-0008 jobs and RFC-0009 audit.
- **Primary consumer:** RFC-0034 facts and RFC-0036 impact analysis

## 1. Problem and scope

A push, deployment, GitHub release, changelog edit, API spec revision, billing-plan edit and website observation are different facts. Today the repository has GitHub proposal/deployment reads and specialized scheduled jobs, but no durable cross-provider source-change ledger. Without one, Relay cannot explain whether a pricing update was merely committed, deployed, or activated for a target audience.

Build a replayable, privacy-minimized change-intake service. First source adapter: authorized GitHub repository commits/releases for selected branches and changed files, correlated with separately observed deployment signals when available. Manual changes come next; authenticated feature flag/billing observations only when a concrete customer use case exists.

## 2. Event envelope and states

```ts
type IngestEnvelope = {
  projectId: string;
  sourceId: string;
  provider: 'github' | 'deployment' | 'manual' | 'stripe_config' | 'feature_flags';
  externalDeliveryId: string | null;
  externalObjectKey: string;
  externalRevision: string;
  occurredAt: string | null;      // source's timestamp, not guaranteed trustworthy
  receivedAt: string;
  contentSha256: string;
  parserVersion: number;
  evidenceLocation: string | null; // private short-lived blob reference
};

type IntakeDisposition =
  | 'accepted' | 'duplicate' | 'superseded' | 'unsupported'
  | 'awaiting_source' | 'failed_retryable' | 'failed_permanent';
```

The transport always acknowledges a valid authenticated delivery after a durable ingest record is committed, even when downstream interpretation is pending. Transient storage failure must produce a retryable response. Duplicate provider delivery IDs are no-ops only if their checksums match; conflicting reuse of an ID is a security/consistency finding, not accepted silently.

## 3. Persistence proposal

| Table | Essential fields / indexes |
|---|---|
| `reality_sources` | `id`, `project_id`, `kind`, `external_account_key`, `enabled`, `connection_ref`, `scope_ref`, `last_success_at`, `last_error_code`; unique `(project_id,kind,external_account_key)` |
| `reality_ingest_events` | `id`, `project_id`, `source_id`, `external_delivery_id`, `external_object_key`, `revision`, `payload_hash`, `received_at`, `occurred_at`, `status`, `parser_version`; unique per `(source_id,external_delivery_id)` where present; separate stable version uniqueness |
| `reality_observations` | `id`, `project_id`, `event_id`, `object_kind`, `object_key`, `revision`, `observed_at`, `effective_at`, `summary`, `evidence_hash`; unique `(event_id,object_kind,object_key,revision)` |
| `reality_changes` | `id`, `project_id`, `change_key`, `kind`, `state`, `effective_at`, `first_seen_at`, `last_seen_at`, `generation`; unique `(project_id,change_key)` |
| `reality_change_observations` | `project_id`, `change_id`, `observation_id`, `role` (`introduced`, `corroborates`, `contradicts`, `supersedes`) with unique pair |
| `reality_source_cursors` | `project_id`, `source_id`, `cursor`, `cursor_etag`, `scan_window_start`, `updated_at`, `lease_version` |

Create both SQLite and PG schema versions. Use database constraints to enforce stable identity, null-handling and project FKs. For provider revisions, derive stable object keys from provider immutable IDs, not titles or filenames alone. Include a `scope_version` for account/repo/branch permission changes.

## 4. GitHub intake path

1. Owner selects repository, branch and optional monitored path filters; verify installation access in the existing connection service.
2. Webhook handler authenticates the signed request against the correct installation; ignore deliveries for unauthorized repositories and unknown projects.
3. Store bounded envelope and quickly respond; schedule interpretation through existing Worker jobs/Workflows, not a long webhook handler.
4. Query changed paths and immutable Git tree/blobs with rate and size caps. Cache `(repo_id,commit_sha,path,blob_sha)` for reuse. Do not send whole source trees to an LLM.
5. Classify changed content as `potential_fact_change`, `asset_change`, `software_change`, `infrastructure_change`, or `no_relevant_change`, with deterministic path/AST rules first.
6. Correlate release/deployment evidence by immutable commit ancestry/environment; do not assume a default-branch merge is production.
7. Persist normalized observations and event graph edges; defer value interpretation to RFC-0034.

If a repository is rewritten or force-pushed, preserve immutable commit-based historical observations, mark the old head as superseded, and require a new source check before a code mutation.

## 5. Temporal and reconciliation rules

- `occurredAt` is what a provider reported; `receivedAt` is our intake time; `observedAt` is the collection time; `effectiveAt` is the business applicability time. They must not be interchangeable.
- Delayed webhooks are ordered by immutable revision/ancestry within source, not timestamp alone. Unrelated histories may remain incomparable.
- For periodic polling, advance cursor **only after** all pages of the scanned window and their records commit. Overlap the next window to tolerate late arrivals; deduplication handles repeats.
- A full resync is bounded and shows coverage status. A missing provider item in a truncated or failed poll is not a deletion.
- A change initially inferred from source code stays `candidate` until compatible deployment, authoritative configuration, or owner confirmation supplies the relevant evidence.
- When facts about plan availability differ across regions or cohorts, create multiple scoped observations, not a global contradiction by default.

## 6. Scheduler and APIs

Proposed internal services:

```ts
observeSource(context, { sourceId, sinceCursor?, maxObjects? }): Promise<ScanSummary>
receiveDelivery(authenticatedSource, envelope): Promise<{disposition, eventId}>
reconcileChange(context, changeId, expectedGeneration): Promise<ChangeAssessment>
listChanges(context, {cursor?, sourceId?, state?}): Promise<CursorPage<ChangeSummary>>
```

All scans have hard time, bytes, requests and spending limits. `ScanSummary` includes scanned, accepted, duplicates, unsupported, last success, and skipped reasons. Use existing `GrowthJobService` admission and current membership rules; a disabled source cannot be revived by a queued job.

## 7. Failure handling and safety

| Failure | Required handling |
|---|---|
| Duplicate webhook | Return same event identity without new work |
| Forged signature | Reject before parsing or persisting untrusted payload |
| Delivery out of order | Preserve both; reconcile source revision/ancestry |
| Rate limit/provider outage | Retry with jitter; mark coverage stale and expose next check |
| Permission revoked | Disable collection and all dependent future actions; leave audit trail |
| Unexpected huge diff | Store capped metadata; mark unsupported, do not exhaust Worker memory |
| Prompt injection in changelog | Treat as untrusted content; strip instructions from agent context, never give it tool authority |
| Conflicting change attribution | Show multiple possible sources; do not invent causal provenance |

Avoid raw customer identities unless required; hash or omit incidental authors and issue commenters. Never log bearer tokens, provider payloads or repository source in request/error logs.

## 8. Delivery slices and acceptance

**A — Manual + GitHub read-only:** normalizer and dedup tables, manual source evidence, GitHub changed-file ingestion for a selected repository. Acceptance: replaying a fixture 10 times results in one logical change; out-of-order events result in the same current view.

**B — Release/deployment correlation:** join immutable revision to environment evidence when provable. Acceptance: undeployed commit is labeled `not_proven_live`, even if merged; a separate deployment with unknown SHA stays unknown.

**C — Operational hardening:** scoped cursors, lag and health metrics, bounded replay. Acceptance: simulated 429/revocation/force-push creates no false new fact and no stale approval action.

Tests must exercise real SQL on SQLite and PostgreSQL, cross-tenant reads, partial-commit recovery, duplicate delivery collision, corrupt payload, cursor restart, time skew, cancellation, and project erasure. A customer-origin live webhook test requires explicit authorization and an owned test repository. No production provider access is asserted here.

## 9. Alternatives

Reject ephemeral-only webhooks (no replay or audit), ingesting whole codebases into vector storage (cost/privacy), generating a change for every commit (noise), and assuming GitHub is the sole product authority (runtime flags, plans, and targeted rollouts can differ from source).
