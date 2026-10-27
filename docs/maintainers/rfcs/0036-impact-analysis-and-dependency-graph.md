# RFC-0036: Deterministic impact analysis and the customer-facing dependency graph

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slice 3: deterministic one-fact-to-one-claim impact rule
- **Dependencies:** RFC-0033 (source changes), RFC-0034 (accepted scoped facts), RFC-0035 (assets/claims), with RFC-0031 authorization rules.
- **Consumers:** Protect, Sync, Launch and future Convert/Enable workflows

## 1. The failure to prevent

A feature is renamed, an integration is restricted to another plan, or a pricing rule changes. The same fact may be repeated on multiple pages, in docs and sales collateral, while some occurrences are intentionally valid for different cohorts. A naïve embedding search of “related text” creates many suggestions and false contradictions. A giant knowledge graph adds infrastructure but not a reliable reason to act.

**Decision:** introduce typed impact edges with explicit rules, provenance, ownership and scope. Graph traversal discovers **candidate consequences**; deterministic and owner-backed evidence determines which are confirmed. The initial graph is small and relational, not a generic graph database.

## 2. Node and edge contract

First-class nodes come from existing tables: `change`, `fact_version`, `asset`, `claim_occurrence`, `journey`, `release`, `work_item`. Edges represent auditable relations such as `changes_fact`, `fact_described_by_claim`, `claim_appears_in_asset`, `asset_part_of_journey`, `asset_required_for_launch`, and `work_addresses_impact`.

Store typed edges in `reality_relations(project_id, id, from_kind, from_id, relation_kind, to_kind, to_id, state, source_evidence_id, rule_id, generation, created_at, invalidated_at)`. Because polymorphic foreign keys are not enforceable by DB engines, maintain explicit join tables for core relationships (especially fact-to-claim, change-to-fact and impact-to-work), and reserve `reality_relations` for approved extension types. Every relation validates endpoints in the same project transaction.

`reality_impact_candidates`: `id`, `project_id`, `change_id`, `asset_id?`, `claim_occurrence_id?`, `journey_id?`, `rule_key`, `rule_version`, `reason`, `scope_id`, `severity`, `evidence_state`, `status`, `assigned_owner`, `dedupe_key`, `last_evaluated_at`, `resolved_at`. Unique `(project_id,dedupe_key)` where active; record every evaluation attempt separately in `reality_impact_evaluations`.

Status: `candidate` → `needs_review` | `confirmed` | `dismissed` | `unsupported` → `planned` | `resolved` | `superseded`. A later fact revision can reopen a previously dismissed item **only** if its dismissal reason/expiry no longer applies; no alert floods after every commit.

## 3. Impact rules and signal classes

| Rule | Input | Evaluation | Output |
|---|---|---|---|
| `PRICING_VALUE_DRIFT_V1` | accepted scoped plan price version + structured pricing claim | typed money/currency/period comparison, compatible scope, effective-date check | `confirmed` claim contradiction or `needs_review` scope ambiguity |
| `PLAN_ENTITLEMENT_DRIFT_V1` | accepted feature/plan fact + public feature matrix claim | normalized feature/plan IDs, cohort/region overlap | contradiction candidate with exact sources |
| `INTEGRATION_AVAILABILITY_V1` | accepted integration status + docs/landing occurrence | version and availability scope overlap; runtime rollout may override code intentions | targeted docs/landing change candidate |
| `RELEASE_DOCS_IMPACT_V1` | source change with touched API/docs path | AST/link/path relation and owner-configured release tags | probable affected docs, **not** proven stale |
| `PROTECT_REGRESSION_V1` | confirmed RFC-0019 monitored-page incident | link incident to protected asset/journey | high-priority actionable consequence |
| `LINK_TARGET_MOVED_V1` | verified route removal/redirect + mapped URL references | exact URL linkage and production status | affected links; no claim of product semantics |

Don't add generic “LLM says probably relevant” into the confirmed ruleset. LLM retrieval may propose candidate mappings with exact citations and explicit missing-proof reasons; reviewers can accept mappings and future deterministic runs will reuse them.

## 4. Scope calculus

`scopeIntersect(factScope, claimScope, requestedAudience)` must return `overlap`, `disjoint`, or `unknown`, never an implicit boolean. If scope is `disjoint`, skip; if `unknown`, require review and do not publish; only `overlap` can trigger a confirmed contradictory comparison. Apply half-open temporal intervals and avoid assuming that omitted region/plan is global. A mobile-only onboarding instruction cannot be judged by desktop UI behavior.

`severity` is a bounded, explainable score used to sort within the customer project, not an asserted dollar loss. Factors may include protected-page status, verified customer journey criticality, current reach from consented GSC/GA4 data, age of contradiction, release urgency, and owner override. Record unavailable metrics rather than imputing zero; a critical broken signup is important even without traffic history.

## 5. Fan-out control and evaluation

- Ingestion triggers assessment only when a change has a new meaningful version or an accepted fact changes. Polling should not reevaluate unchanged assets.
- First select explicit links, then exact claim identities, then optional capped semantic candidates. Limit per-change assets/evidence fetches; mark overflow as `truncated` and continue in idempotent batches if admitted.
- Limit graph depth to two relevant relationship hops in v1. A deep traversal must have an owner-approved use case and quantified precision.
- Deduplicate by change generation, target asset, normalized rule, and audience scope; don't create one task per duplicate quote.
- Use persisted `last_evaluated_version`/rule version so a retry is stable. Rule upgrades may create new evaluation runs without rewriting history.
- No expanding cross-project traversal even if two organizations share a public URL or domain.

## 6. Proposed service API

```ts
type ImpactAssessment = {
  changeId: string;
  changeGeneration: number;
  ruleSetVersion: string;
  confirmed: string[];
  reviewRequired: string[];
  ignored: number;
  unsupported: number;
  truncated: boolean;
};

assessImpacts(context, { changeId, expectedGeneration, maxCandidates }): Promise<ImpactAssessment>
reviewImpact(context, {impactId, generation, decision, reason, expiryAt?}): Promise<Impact>
listImpacts(context, {changeId?, state?, owner?, cursor?}): Promise<CursorPage<Impact>>
```

All mutations enforce current project scope and CAS generation. A human confirming relevance still does not authorize changes to external systems; that belongs to RFC-0037.

## 7. Failure and adversarial cases

- Two legitimate prices for different currencies or legacy subscriptions must not be reported as a proven inconsistency.
- SEO ranking changes caused by a concurrent event are not attributed to a release based on timing alone.
- If link extraction truncates, don't say "no affected assets"; say "coverage incomplete".
- An asset referenced by a deleted integration is not automatically deleted; it may be a historical guide.
- A malicious release note containing “ignore approval” remains untrusted quoted data and does not affect rule execution.
- An unknown owner does not grant relay authority; route to unassigned review.
- Suppression decisions are versioned, and reopening after material evidence is visibly explained.

## 8. Stages and acceptance

**A — Exact-link impact:** detect priced-feature and integration claims across linked Markdown/static pages using typed facts. Must be deterministic across replays.

**B — Review and prioritization:** item detail contains two verifiable citations, audience overlap reasoning, exact location, stale/unknown flags and owner. Owner can dismiss with reason/expiry.

**C — Launch and journey edges:** correlate route changes, monitored journeys and release tasks; do not dispatch any outbound action.

**D — Optional semantic candidate expansion:** only when measured recall misses important assets; capture precision/false-positive rates separately for candidate and confirmed classes.

Test on a seeded corpus with at least: 10 true contradictions, 10 valid scoped differences, 10 unknown-scope claims, 10 irrelevant changes, late event, duplicate claims in same file, changed extractor version, 500+ assets and revocation. Define acceptance as 0 false **confirmed** contradictions among the valid-difference fixture, no missing evidence on confirmed findings, stable dedupe under repeated scans, and a bounded memory/request budget. Field precision is measured independently before claims of reliability.

## 9. Alternatives

Reject broad topic clustering as authoritative impact, an unrestricted LLM that creates tickets across every connected system, and one monolithic ranking score hiding whether evidence is real. Keep relational joins for critical edges rather than assuming a graph database will solve identity or authority.
