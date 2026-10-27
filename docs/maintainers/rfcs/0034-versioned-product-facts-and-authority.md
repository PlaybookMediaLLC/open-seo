# RFC-0034: Versioned product facts, scoped authority, and contradiction resolution

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slice 2: one accepted plan/feature fact with scoped effective dates
- **Dependencies:** RFC-0030, RFC-0031 and RFC-0033 (source observations); later integration with RFC-0021’s proposed `business_facts`. Do not require new-page generation.
- **Product:** PRE foundation for Relay Sync and Launch

## 1. Problem

A statement such as “SSO is available on the Pro plan” cannot be evaluated as true or false without a product/version, plan, region, customer cohort, effective date and trustworthy evidence. A code diff is not proof that a flag is enabled. A pricing page can be correct for new customers and incorrect for grandfathered ones.

The prior RFC-0021 proposes a simple verified business-facts registry to ground **new-page generation**. This RFC defines the broader product-wide authority contract. **Reuse RFC-0021 conceptually; do not ship two contradictory fact registries.** If RFC-0021 is implemented first, add a non-destructive mapping/migration and preserve original source/verification data. No new-page builder is required for this work.

## 2. What counts as a product fact?

A product fact is a typed assertion about a bounded subject, predicate, value, and applicability scope. Examples:

| Subject / predicate                     | Typed value        | Required scope and evidence                                                       |
| --------------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `plan:business / monthly_price`         | `money(4900, USD)` | billing account, market, contract term, effective window; approved pricing source |
| `feature:sso / available_on_plan`       | `plan:business`    | region, cohort, release phase, observed runtime flag and owner confirmation       |
| `integration:hubspot / status`          | `available`        | product edition, region, verified deployment or release record                    |
| `api:v2 / deprecated_after`             | timestamp          | versioned OpenAPI/changelog or owner policy                                       |
| `capability:data_export / maximum_rows` | integer            | edition and time; versioned approved spec                                         |

Do not represent inferred personal traits or a customer account's sensitive status as a global product fact. Product scope is configuration and product availability, not a backdoor customer-profile database.

## 3. Canonical authority and evidence

Each predicate family has a configurable source-authority policy. Examples: prices may be authoritative in billing configuration only after a pricing owner approves their **public applicability**; availability may require runtime rollout proof; docs describe behavior but are generally not authority for deployed code. A source is not globally trusted across unrelated predicates.

Evidence grades:

- **Observed:** direct signed/configured source result, with immutable revision/time and collector health. May establish a fact for the scope it actually covers.
- **Owner-attested:** named authorized human asserts a fact and supplies effective date, scope and reason.
- **Corroborated:** compatible independent observations support the same assertion; does not erase scope mismatches.
- **Inferred:** model or heuristic extraction; always requires validation before use in an outward-facing correction.
- **Contradicted:** two overlapping valid assertions disagree. Retain both; open a resolution task. Do not automatically choose the latest timestamp.
- **Expired / unavailable:** no current supporting observation or beyond effective date; not automatically false.

**Decision:** a fact becomes `accepted` only when configured authoritative evidence meets the predicate policy, or an authorized owner explicitly attests it. A high LLM confidence score cannot substitute.

## 4. Persistence and immutability

Proposed tables (all `project_id` scoped, with paired SQLite/PG migrations):

- `reality_fact_subjects`: canonical typed subject IDs (e.g. plan, feature, integration, API) and stable aliases. Unique `(project_id,subject_type,canonical_key)`.
- `reality_fact_predicates`: versioned allowlist with kind (`string`, `boolean`, `integer`, `money`, `timestamp`, `reference`, `set`), required dimensions, comparison strategy, sensitivity.
- `reality_fact_scopes`: immutable normalized combinations of `region`, `locale`, `plan_ref`, `cohort_ref`, `release_channel`, `effective_from`, `effective_until`, plus explicit wildcard flags; use separate `reality_scope_terms` when multiple values exist.
- `reality_facts`: stable identity `(project_id,subject_id,predicate_id)`, current generation and display title.
- `reality_fact_versions`: immutable assertion, typed value columns (`value_text`, `value_boolean`, `value_integer`, `value_decimal_minor`, `currency`, `value_ref`, `value_time`), `scope_id`, `status`, `authority_policy_version`, effective window, author/reviewer, created time. Enforce exactly one typed value for scalar predicates; multi-valued sets use a child table with uniqueness.
- `reality_fact_evidence`: join `(project_id,fact_version_id,observation_id|asset_snapshot_id|owner_attestation_id)`, evidence role, exact locator/quote hash; constraints prevent orphaned proof.
- `reality_fact_conflicts`: overlapping scope + incompatible accepted assertions; status, decision owner, resolution reason and next review date.
- `reality_source_authority_policies`: per predicate family, source kind, minimum observed freshness, owner role, allowed promotion path and version.

Use half-open validity intervals `[from, until)` to prevent off-by-one effective-date overlap; preserve source timezone when relevant and normalize instants to UTC. Missing scope is **unknown**, not a universal wildcard. A globally valid fact requires an explicit global scope.

## 5. Fact evaluation contract

```ts
type FactQuery = {
  subjectKey: string;
  predicateKey: string;
  at: string;
  audience: {
    region?: string;
    locale?: string;
    planKey?: string;
    cohortKey?: string;
    releaseChannel?: string;
  };
};
type FactResult =
  | {
      state: "accepted";
      versionId: string;
      typedValue: unknown;
      proofIds: string[];
      scopeId: string;
    }
  | { state: "ambiguous"; candidateVersionIds: string[]; conflictIds: string[] }
  | {
      state: "unverified";
      candidateVersionIds: string[];
      missingEvidence: string[];
    }
  | { state: "unknown"; reason: string };
```

Evaluation first filters time and scope, then excludes expired/revoked evidence, then applies policy precedence. Multiple non-overlapping plans can carry different values without conflict. Two overlapping equally authoritative versions create `ambiguous` rather than arbitrary choice. Never reduce this to an embedding similarity threshold.

**Example:** `integration:hubspot.available` asserted true for Business US cohorts and false for Free global customers. A generic docs sentence saying “HubSpot is available to all plans” is a drift candidate only after the intended article audience is determined; without it, ask the owner to specify scope.

## 6. Publishing and change interactions

A newly accepted or superseded fact emits a `fact_version_accepted` event referencing the fact, version, evidence and change. Impact analysis (RFC-0036) searches mapped claims and assets. An approved edit stores **exact fact version IDs and scope** as its justification. If the fact is superseded or its authority revoked before execution, the proposal becomes stale and requires regeneration and new approval.

Approval of an article edit does not promote its text into a new authoritative fact. Avoid circular evidence: article A cannot prove fact F merely because article B repeated A. Maintain evidence lineage and reject cycles that create self-corroboration.

## 7. UX and owner review

Provide an **Facts** panel showing subject, predicate, value, scope, evidence sources, collection freshness, owner, and effective date. Reviewers can approve, dispute, narrow scope, mark intentional exception, or request source proof. Any action appends a versioned decision and reason; do not overwrite history.

If sources conflict, surface the contradiction and show why each source claims authority. Do not send content fixes, customer emails, or pricing updates until resolved.

## 8. Delivery and acceptance

**A — Manual facts and authority:** support typed plan/price, feature availability, integration status. Test owner-attestation and effective windows. Reject typed mismatches.

**B — GitHub/OpenAPI/changelog evidence:** import read-only observations from RFC-0033; mark candidates or accept only policy-supported facts.

**C — Read-only billing-plan and feature-flag sources:** require customer authorization, scoped API and actual provider capability review; treat runtime targeting as separate from planned configuration.

**D — Conflict/expiry workflows:** notification and reconciliation; only accepted facts can justify publishable proposals.

Tests: plan and region overlap, DST/UTC boundaries, grandfathered cohorts, price in minor units/currency, late source revision, revoked evidence, simultaneous owner edits via CAS, duplicate evidence, self-corroboration cycle, cross-tenant query leakage, migration parity. Seed one scenario in which two apparently contradictory statements are **both correct** for their scopes; detector must not flag it.

## 9. Security, privacy, and alternatives

Avoid storing full customer-specific billing records or entitlement rosters. Use aggregate plan metadata and scope selectors; if customer-specific verification is later necessary, use narrowly authorized transient checks outside the general facts database. No inferred medical, financial-personal or sensitive profile data in facts. Audit every manual override and export. Retain conflicts for review while limiting raw source copies.

Reject a single wiki page as truth (untyped and unversioned), always trusting the newest source (wrong across rollout stages), owner-entered facts without scope, and treating extracted claims as authoritative merely because they appeared on a live page.
