# RFC-0037: Cross-system work plans, explicit authorization, and bounded execution

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slice 4: reviewed correction using the existing GitHub publisher
- **Dependencies:** RFC-0030–0036 (source/evidence/impact foundation), existing RFC-0005 exact-change publishing, RFC-0009 approvals/audit, RFC-0025 phase 1a previews and RFC-0028 production verification. Ship read-only work plans before enabling writes.
- **Decision:** One auditable work lifecycle for all offers; no automatic merges, external messages, billing changes, or CRM mutations in the first release.

## 1. Problem

A verified discrepancy may require a docs PR, a landing-page PR, a sales-brief update, or a support-article task. Each destination has different authority, side effects and verification. A single `execute()` command or “agent with all tools” would make approvals ambiguous and recovery unsafe. Relay already has exact-change PR authorization tied to SEO opportunities. Reuse that protection instead of creating a weaker alternate path.

## 2. Work plan and item model

`reality_work_plans`: `id`, `project_id`, `change_id?`, `title`, `generation`, `state`, `created_by`, `created_at`, `cancelled_at`, `priority`, `scope_version`. One logical change can have multiple plans over time; only one current plan generation may be presented as actionable.

`reality_work_items`: `id`, `project_id`, `plan_id`, `impact_id?`, `destination_kind`, `action_kind`, `owner_id`, `state`, `due_at?`, `blocking_reason?`, `evidence_version`, `created_at`, `updated_at`. Include a unique `(project_id,plan_id,stable_action_key)`; do not duplicate tasks after job retries.

`reality_work_dependencies`: `(project_id,predecessor_item_id,successor_item_id)` with cycle prevention in service. Use dependency edges for “pricing owner approves facts” before “website PR” and “deploy verified” before “announce live.”

`reality_action_proposals`: immutable proposal payload/hash, target account/repository/asset, expected source revision, evidence refs, risk class, preconditions, postconditions, expiry and proposer. If GitHub-backed, link to an existing `opportunity_proposals` or new typed publishing evidence variant; don't copy all GitHub data and weaken checks.

`reality_action_approvals`: actor, role/permission snapshot, proposal ID, exact fingerprint, granted/denied decision, time, expiration, revocation, recorded constraints. Approval is for one immutable artifact on one target and one expected source version, not for the plan title.

`reality_action_executions`: attempt ID, idempotency key, actor, connector, target revision, state, external receipt ref, checkpoints, retries and final error category. External receipt is neither verified publication nor business success.

## 3. State machine and policies

```text
candidate -> awaiting_fact_resolution | review_required | ready_to_prepare
ready_to_prepare -> prepared -> awaiting_approval
awaiting_approval -> approved | rejected | expired
approved -> preflight -> executing -> executed | retryable_failure | blocked
executed -> awaiting_destination_verification -> verified | failed | unknown
any nonterminal -> cancelled | superseded
```

Never skip an authorization transition because a plan was accepted. Publishing preparation is read-only; writing a branch/PR is a side effect requiring exact approval. Merging belongs to the customer's GitHub process. “Prepared” and “done” are never synonyms. A previously approved proposal whose referenced fact, document SHA, permissions or destination changes must become `superseded` and require a fresh review.

**Action risk classes:**

| Class              | Examples                                     | Initial control                                                                            |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `read`             | compare page, fetch metadata, list docs      | project membership and connector permission                                                |
| `internal_draft`   | save draft and proposed text                 | authenticated editor; no external side effect                                              |
| `repo_proposal`    | create branch and PR                         | exact-payload human approval, source CAS, existing repository protections                  |
| `external_write`   | update help center, CRM asset or status      | feature-gated, explicit per-connector scope, new security review; **off by default**       |
| `customer_message` | release email / support reply                | direct human final approval and provider-compliant recipients; **not in v1**               |
| `financial_change` | plan, invoice, price or entitlement mutation | **never supported by generic Relay automation**; separate future product/security contract |

Model role and action permission using the existing organization permission service; do not invent a new full RBAC product. Check both actor's current membership and destination connection scopes immediately before execution.

## 4. Idempotency and concurrency

`stableActionKey = hash(project, plan_generation, target_identity, action_kind, normalized_diff_hash)`. Each external mutation also carries an immutable attempt key if provider supports it. Acquire a durable fenced claim per target to avoid competing PRs. Re-read the current source and expected state before issuing a write. If outcome is uncertain due to timeout, **reconcile external state first** before retrying; never blindly resend an email or create a second PR.

For GitHub: reuse `publishingAccess`, the source blob SHA, `proposalFingerprint`, current permission checks, deterministic branch naming and existing PR reconciliation. Plan/impact IDs may be stored as optional typed supporting relations but must not replace the current publishing authorization chain. Where `opportunity_proposals` currently requires a GSC opportunity, add a typed evidence variant through the already proposed RFC-0027 route instead of creating fake opportunities.

## 5. API design

```ts
prepareWorkItem({ projectId, workItemId, expectedGeneration }): Promise<PrepareResult>
approveAction({ projectId, proposalId, proposalFingerprint, expectedSourceSha,
  decision: 'approve'|'reject', reason? }): Promise<ApprovalResult>
executeApprovedAction({ projectId, proposalId, approvalId }): Promise<ExecutionResult>
listWorkForChange({ projectId, changeId, cursor? }): Promise<CursorPage<WorkItem>>
```

No general-purpose `executeAction(actionText)` API. Input Zod schemas must cap body sizes, accept enumerated action kinds, verify project ownership and refuse user-supplied arbitrary shell commands or fetch URLs. Public MCP tools may list and draft, but cannot grant the approval or execute external writes (see RFC-0041).

## 6. Dependency/rollback semantics

A work plan is a DAG, not a transaction across GitHub, CMS and email. Failure of one action does not roll back unrelated already published assets. Mark downstream items `blocked_by_dependency` with links to the failed item and an explicit recovery action. For reversible edits, prepare a **new approved inverse proposal** from current source, using existing revert service where applicable; do not claim universal undo. Messages already sent cannot be unsent.

Track `waiting_on_you` accurately in the existing weekly work view, and show each action's external receipt and verification separately. When no change is warranted, record `no_action_required` with evidence; do not invent maintenance work to drive retention.

## 7. Security, auditing and costs

- Scope all tables and repository queries to project/organization. Test relation expansion and indirect access.
- Only allowlisted destination adapters can receive writes; no arbitrary agent tool URLs.
- Every approval, denial, cancellation, reconfirmation, permission failure, external receipt and compensation is audit logged. Version audit action enums consistently.
- Require per-plan caps: max edits, pending reviews, provider requests, render checks, model tokens, bytes fetched and active jobs.
- Encrypt tokens with existing secret configuration and don't copy connector credentials into action payloads or event logs.
- Render untrusted proposed content as escaped text; suppress model prompt-injection instructions.

## 8. Implementation slices and acceptance

**A:** Plan/read-only tasks, explicit work owners, dependency graph and report integration. Acceptance: a seeded change creates exactly three deduped tasks, one blocked on fact approval, with no external write permission.

**B:** GitHub exact-change proposals linked to an accepted impact and current fact. Acceptance: reusing existing publisher creates one PR after human approval; stale fact version or blob SHA blocks execution.

**C:** Verification handoff and recovery. Acceptance: PR merged is distinct from deployed+verified, and failed downstream tasks show reason/next action; inverse change has fresh approval.

**D (later):** New external-write adapter after separately reviewed permission/verification policy. No broad delegated standing approval until RFC-0026 validates repeat paid demand and RFC-0025 preview guarantees are proven.

Test timeouts after provider write, repeated click, revoked membership, connector scope downgrade, stale source, evidence supersession, parallel workers, mixed-success plan, cross-tenant relation access, and disabled feature. Staging smoke tests must use only owned repos and mock/consented notification recipients.
