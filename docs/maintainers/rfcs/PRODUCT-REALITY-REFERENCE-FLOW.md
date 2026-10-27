# Reference acceptance scenario: plan change → fact → claim → impact → PR → verification

**Status:** Design fixture only, not a claim of an existing customer deployment.  
**Purpose:** Exercise the minimum RFC-0030–0040 change → fact → claim → impact → approved correction → verified outcome slice without requiring the entire connector catalog, Launch, or a new dashboard.

## 1. Scenario and approved target scope

A fictitious, customer-owned SaaS company sells Starter and Business subscriptions. Business is advertised at **$49 USD per month** in the United States. A planned change makes Business **$59 USD/month** for **new US customers beginning November 1, 2026**. Existing customers keep legacy pricing; customers in Canada continue seeing the Canadian pricing page with a different amount and currency. A Next.js marketing website and Markdown documentation are GitHub-managed. The product deploys a pricing config change and updates the main pricing page, but one US FAQ still says $49.

This fixture exists only to exercise timing, scope, money units, immutable source hashes and destination verification. It is deliberately not a real customer anecdote, proof of an industry problem, or a commercial result.

Owner grants GitHub read access to a selected repository and separately authorizes one exact PR. No Stripe price mutation, live transaction, customer email or CRM write is permitted.

## 2. Input source observations

At `2026-10-30T10:00:00Z`, GitHub reports a pricing config change in commit `C_NEW`. Record the immutable source diff and the provider delivery key. The observation should **not** establish that new prices are live. Later a deployment source records that the target production environment is running `C_NEW` (if its SHA/ancestry can be proven), and the pricing owner attests a new-customer effective date of November 1.

Proposed normalized intake payload (illustrative):

```json
{
  "projectId": "project_demo",
  "sourceId": "github_selected_repo",
  "provider": "github",
  "externalDeliveryId": "delivery_001",
  "externalObjectKey": "commit:C_NEW",
  "externalRevision": "C_NEW",
  "occurredAt": "2026-10-30T10:00:00Z",
  "receivedAt": "2026-10-30T10:00:03Z",
  "contentSha256": "illustrative-hash-of-sanitized-source-envelope",
  "parserVersion": 1,
  "evidenceLocation": null
}
```

All hashes and identifiers here are example labels; integration tests must compute real hashes. A repeated delivery with the same ID/payload resolves to the same event. An identical delivery ID carrying different content is rejected as an integrity conflict.

## 3. Accepted fact and effective scope

Fact identity: `plan:business.monthly_price`.

Fact version V1: 4,900 cents USD/month for new US customers, effective until `2026-11-01T00:00:00-04:00` (the New York offset on that date must be checked; tests should use an explicit IANA timezone and normalize to UTC).

Fact version V2: 5,900 cents USD/month for new US customers, effective from that date; supporting evidence is (a) approved pricing configuration or owner attestation, and (b) production-effective rollout evidence when required by authority policy. **C_NEW by itself is not sufficient**.

Separate fact version LEGACY: 4,900 cents USD/month for grandfathered US accounts, effective after November 1 as well. Neither V2 nor LEGACY automatically applies to existing customers in all situations; scope and effective date decide applicability. Canadian facts use a different scope and must never be numerically compared to USD without explicit conversion/business rules.

Proposed shape:

```ts
{
  subjectKey: 'plan:business',
  predicateKey: 'monthly_price',
  scope: { region: 'US', currency: 'USD', planKey: 'business',
           cohortKey: 'new_customers', effectiveFrom: '2026-11-01T04:00:00Z' },
  typedValue: { kind: 'money', minorUnits: 5900, currency: 'USD', interval: 'month' },
  authority: { state: 'accepted', evidenceIds: ['pricing_owner_attestation', 'deploy_observation'] },
}
```

Do not accept owner attestation after an expired role or model-generated release prose as promotion authority. If the source and owner disagree, create a fact conflict; no downstream corrections can execute while required fact authority is unresolved.

## 4. Asset and claim capture

Asset A: `/pricing` in selected production origin and matching source file. Its current public claim is `$59 / month`, scoped to new US Business customers. It agrees with V2.

Asset B: `/docs/billing/faq` in approved `.mdx` file, with public US new-customer FAQ excerpt “Business costs $49/month.” The claim occurrence references exact source blob SHA, AST paragraph/byte span and observed publication time. It contradicts V2 after Nov 1 if the page's scope is confirmed.

Asset C: `/legacy/plans` is explicitly for grandfathered customers and still says $49. It agrees with LEGACY and must **not** generate a confirmed contradiction.

Asset D: a French-language pricing page whose region is not specified. Its price claim is `needs_review` until the owner assigns the correct audience/locale; it is not safe to patch automatically.

## 5. Impact assessment and findings

`PRICING_VALUE_DRIFT_V1` compares compatible scope and typed money values. After effective date:

| Asset               | Expected result | Reason                                                      |
| ------------------- | --------------- | ----------------------------------------------------------- |
| `/pricing`          | `no_issue`      | agrees with accepted scoped fact                            |
| `/docs/billing/faq` | `confirmed`     | overlapping audience/period and mismatched minor-unit value |
| `/legacy/plans`     | `no_issue`      | explicit grandfathered cohort; V2 not applicable            |
| French pricing page | `needs_review`  | scope unknown and currency/audience may differ              |

Before effective date, `/docs/billing/faq` can be a `scheduled_change_candidate` but not a confirmed already-live contradiction. If a deployment runs ahead of the approved effective date, record `deployed_not_effective` separately.

Deduplicate confirmed impact by `{project,change_generation,claim_occurrence,scope,rule_version}`. A second ingest event should not open a duplicate work item or alert. If the FAQ is intentionally archived and tagged historical, owner can dismiss with reason and expiry; accepted product facts stay unchanged.

## 6. Proposed correction and approval

Only when Fact V2 is accepted and the FAQ span is mapped to an exact supported source blob can Relay prepare a narrow MDX paragraph edit. Show the reviewer:

- Before: “Business costs $49/month.”
- After: “For new US customers, Business costs $59/month from November 1, 2026. Existing customers may retain their previous rate under their agreement.”
- Fact citations: V2, LEGACY or an explicit owner-approved policy about legacy pricing. **Do not draft the second sentence without supporting policy evidence**. If policy isn't accepted, use the first sentence only and flag the missing grandfathering guidance as a reviewer question.
- Exact file path, commit/blob SHA, quote span, source verification, target URL, applicable audience, CI/preview requirements and rollback limits.

Approval stores `proposalFingerprint`, accepted fact-version IDs, reviewer identity, role and expected source SHA. Any new fact version or source blob change invalidates prior approval. Existing exact-change publishing creates a branch/PR. The reviewer merges through their GitHub policy. No proposed work alters Stripe price/entitlement configuration.

## 7. Production verification and independent outcomes

Successful PR creation → **not published**.

Successful merge → **not necessarily deployed**.

Deploy with verified commit provenance → **not necessarily correct**.

Two fresh production observations confirming the exact desired FAQ content and matching fact scope → **content verified** (subject to approved verification spec and cadence).

Search impressions, checkout conversion rate, customer questions and renewal outcomes are later **observations** and are not automatically attributed to this correction. If the customer manually fixes the FAQ before Relay's PR is merged, state `resolved_externally` rather than `restored_by_relay`.

## 8. End-to-end acceptance cases

1. Replaying the GitHub webhook produces one observed change; a changed payload under the same delivery ID is rejected.
2. GitHub commit without production evidence cannot auto-promote a deployment-dependent fact.
3. Before Nov 1 (customer-local relevant time), $49 in the existing FAQ is not flagged as already false under a future price.
4. After effective time, US new-customer FAQ creates one confirmed impact, not one per duplicated same sentence.
5. Grandfathered pricing page remains valid; different currency/unknown scope remains review-needed.
6. Source parser extracts exact paragraph citation and source blob SHA; invalid MDX is not patchable.
7. Reviewer approves only the supported exact change. Fact/source update between approval and write blocks publication.
8. GitHub branch/PR creation reconciles idempotently when the provider times out after write.
9. A merged PR with failed deployment stays unverified; a cached old public page fails the expected postcondition.
10. A customer-origin repair can resolve the finding without claiming Relay performed it.
11. Organization B cannot read any asset, fact, source event, reviewer identity or verification record belonging to A.
12. Revocation, cost cap, provider outage and scheduled job failure show explicit degraded coverage with recoverable next actions.

## 9. Instrumentation for the pilot

Record source/asset scan durations, bytes/API calls, LLM token usage where used, extraction precision, number of confirmed vs dismissed findings, reviewer time, PR acceptance, verification lag, false alert rate, and actual customer payment/renewal. This fixture is **technical acceptance only**; it cannot be counted as a real paid customer outcome.
