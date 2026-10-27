# RFC-0045: Activation, support intelligence, and customer-experience repair signals

- **Status:** Proposed later expansion; no customer-specific activation automation implied
- **Date:** 2026-10-27
- **Implementation position:** Later demand-gated: onboarding and support intelligence
- **Dependencies:** RFC-0034–0040 (product facts, claims, work/verification and Sync); existing GA4 reports, conversion detection and RFC-0017 support topics. Relay Launch (RFC-0042) is an optional consumer, not a prerequisite.
- **Initial scope:** read-only, cohort-aggregated diagnosis of onboarding instructions and support/documentation gaps

## 1. Product problem

New features and onboarding changes can make tutorials, setup steps and support answers inaccurate. Teams also receive recurring tickets about confusing or broken activation steps while analytics suggests where users abandon a journey. Neither signal on its own proves what failed. Relay should link approved product facts and verified customer-facing instructions to observed, consented behavior and recurring support themes, then create evidence-backed corrective work.

**Decision:** start with truth/coverage of onboarding content and bounded read-only signals. Do not build a full product analytics warehouse, inject in-app messages or automate support responses before customer demand and reliability are demonstrated.

## 2. Capability boundaries

| Capability | First slice | Later, separately gated |
|---|---|---|
| Setup guide integrity | Compare docs instructions to accepted product routes and capabilities | in-product step-level overlays |
| Onboarding funnel health | Read GA4/product event aggregates with defined consent and event semantics | deeper funnel analytics integration |
| Support question clustering | Reuse existing RFC-0017 GitHub Issues topic counts/excerpts | Intercom, Zendesk, Help Scout connectors |
| Change impact | Identify cohorts or journeys possibly affected by released feature | account-specific workflows with consent |
| Suggested corrections | Create reviewed docs or page PR with exact source evidence | product tours, in-app guide changes |
| Effect measurement | Recheck docs links, supported flow, trends in ticket topics | randomized activation experiments |

A support topic with 15 tickets may warrant investigation but cannot alone prove the product is defective. Missing activation events may mean instrumentation failure. Explicitly label these alternatives.

## 3. Data contract and privacy

`reality_journey_definitions`: project, journey/version, product scope, expected steps/events, authoritative spec reference. `reality_journey_observations`: bounded aggregate counts per authorized window/cohort, completion coverage, sampling and data sufficiency. `reality_support_signal_links`: reference an existing support topic, doc asset and product-fact version; store no additional raw support messages. `reality_experience_impacts`: linked change and suspected/confirmed issue with evidence state and owning team.

Never infer personally sensitive attributes to segment customers. Do not upload raw user conversations to an LLM by default; reuse RFC-0017's redaction rules for GitHub Issues and perform privacy review for every expanded source. Avoid identifiable account-level joins unless explicit customer consent, lawful basis, retention and access policies exist. Aggregates below configured privacy thresholds should be suppressed, not fabricated.

## 4. Diagnosis algorithm

1. Identify product fact or route change relevant to a configured onboarding journey.
2. Trace linked docs/tutorial assets through RFC-0035 and verify exact instructions or URLs. Create confirmed drift only with proof.
3. If consented aggregate events exist, compare mature windows using consistent definitions, sampling/coverage metadata and an appropriate baseline. Label movement as observed, not caused by release.
4. Link support-topic recurrence by exact or reviewed subject mapping; avoid inventing root causes from similarity alone.
5. Present a diagnosis with supported facts, contradictions, unanswered questions and safe next actions.
6. Prepare docs or landing edits with RFC-0037 approvals, then use RFC-0038 independent verification. Do not silently modify customer onboarding state or send messages.

## 5. Example acceptance fixture

A feature moves the API key management screen. Docs say the old route, which now 404s. A support topic reports “can't find API key”; onboarding event completion declines. The product change + observed old link confirm an outdated guide; the event trend and support topic corroborate urgency but do not prove all drop-off was caused by the route move. After a corrected docs PR deploys, verify the new link resolves and instructions match the expected UI. Record later ticket counts as descriptive, including when traffic is too low.

## 6. Customer UX

Inside a change detail, show **Affected onboarding paths**, **Documentation claims**, **Behavior signals**, **Support themes**, **Required customer decision**. Keep links to actual support source/topic and evidence status. Respect the daily user's ownership: engineers own source fixes, docs owner approves prose, growth owner reviews measurement. Don't show “automatically fixed onboarding” if only a FAQ was updated.

## 7. Staged execution and technical acceptance

**A:** route/docs link integrity + current support-topic mapping, read-only; three seeded fixture types: confirmed old route, valid redirect, unsupported dynamic behavior.

**B:** optional GA4 mature-window aggregate and tracking-health metadata; no personal joins. Ensure lag/incomplete windows are unknown.

**C:** one approved docs correction with production URL verification and a separately observed support signal.

**D:** an actual product onboarding integration only after two paying customers cite this exact workflow as a budgeted problem.

Test privacy thresholds, event schema drift, cross-tenant topic reads, time-window discontinuity, stale product versions, low-sample ambiguity, topic renaming, misclassified support complaints and provider permission revocation. No support reply or in-app pop-up is auto-sent in the first version.

## 8. Rejected alternatives

Reject a generic chatbot that hides docs errors, building a user-level behavioral surveillance database, assuming lower activation equals an incident, and writing product-tour scripts to customer apps without source-map/approval controls.
