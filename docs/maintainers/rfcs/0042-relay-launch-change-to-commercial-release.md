# RFC-0042: Relay Launch — from product change to coordinated commercial release

- **Status:** Proposed; commercial validation required
- **Date:** 2026-10-27
- **Implementation position:** Second new paid product: manually initiated, fact-backed Relay Launch
- **Dependencies:** RFC-0033–0040 (source changes, facts, impact, authorized work and Sync), existing RFC-0023 existing-page launch checks and approved GitHub/Markdown publishing. RFC-0041 API integration is optional, not a prerequisite for the first manual launch packet.
- **Commercial entry:** Founder-led and product marketing at release-intensive B2B SaaS companies

## 1. Why a new launch product?

A merged release can introduce new capabilities, pricing, integrations or changed onboarding while the go-to-market team updates websites, docs, sales decks and announcements by hand. A changelog alone doesn't establish eligibility, availability or whether customers were actually informed. Relay should treat a launch as an **auditable cross-system change program** tied to a real product change, with accountable owners and verification.

**First supported release:** existing public integration or feature that has a customer-created landing page and GitHub-backed docs. Start with a human-created launch record and source-backed content package. Automatic release inference, omnichannel sends and CRM segmentation are later.

## 2. Launch object and lifecycle

`reality_launches`: `id`, `project_id`, `change_id?`, `name`, `kind` (`feature`, `integration`, `product`, `plan`, `api`, `release`), `audience_scope_id`, `release_version`, `target_window`, `owner_id`, `status`, `generation`, `created_at`. Link to existing RFC-0023 `launches` records where that feature is implemented; avoid duplicate competing launch sources of truth. Prefer extending the existing table with typed links after assessing its current migration state.

`reality_launch_requirements`: item types (`fact_verified`, `page_live`, `docs_updated`, `review_approved`, `announcement_drafted`, `journey_tested`, `instrumentation_verified`, `sales_ready`), required/optional flag, owner, current work item, verification kind.

`reality_launch_artifacts`: reference to actual source asset, content draft, approved PR, screenshots, outgoing communication draft and destination. Do not persist full customer-facing copy in random JSON blobs.

`reality_launch_audiences`: normalized approved audience scopes and **source** of membership rule; no speculative list of email recipients. `reality_launch_evidence`: link to fact versions, deployments, reviews and verification receipts.

```text
proposed -> fact_review -> preparing -> ready_for_review
-> approved_for_release -> awaiting_deployment -> live_verified
-> measuring -> completed | blocked | cancelled | superseded
```

Every launch requirement has independent status and timestamp. Marketing readiness is not deployment readiness. An announcement cannot claim availability for a region/cohort whose release evidence is missing.

## 3. Change-triggered launch construction

**Manual phase:** owner identifies a product change and chooses kind and target audience. Relay shows a launch checklist: website, docs, feature availability, SEO/indexability, conversion path, tracking, sales/customer success material and communication drafts. Only applicable check types are required.

**Read-only detection phase:** GitHub release/changelog or verified deployment suggests a launch; if facts are unresolved, show “possible launch” rather than automatically producing ready-to-send claims. Link to one or more accepted fact versions and an actual rollout scope.

**Template phase:** organization can configure required categories per launch type (e.g. integration launch needs setup guide and credential handling; pricing launch needs grandfathering policy and checkout link check). Template version is captured at launch creation; editing template doesn't erase prior checklist history.

## 4. Artifacts and channels

| Output                             | Initial mechanism                                       | Release constraint                                      |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Release page / launch landing page | existing page check and reviewed GitHub PR              | new-page generation remains gated by RFC-0021           |
| Changelog / docs update            | reuse RFC-0017 safe MDX edits                           | source-backed factual claims only                       |
| SEO metadata / internal link       | existing bounded publisher and audit checks             | customer preview and original rule verification         |
| Screenshots / graphics             | proposed connector to Shots or approved uploaded assets | user selects source capture; no invented UI             |
| Sales brief / customer success FAQ | reviewable document draft using accepted facts          | requires owner acceptance; delivery integration later   |
| Email/social announcement          | draft only in v1                                        | separate legal/consent and explicit send approval later |
| CRM customer interest routing      | read-only consented signals, later                      | do not expose customer lists to the content model       |
| Adoption/activation measurement    | configured GA4/product-analytics events                 | absence of events is unknown, not failed launch         |

Relay Launch is the coordinator, not a clone of Shots, HubSpot, scheduling apps or a support platform. Each channel adapter defines its own permission and verification contract.

## 5. Release packet

Produce one immutable reviewed packet per launch version:

- Source change and deployment evidence; exact release status.
- Accepted features, eligible audiences, effective dates and unresolved assertions.
- Required/optional assets with owners, source revisions and approval state.
- Draft copy with source citations and outstanding owner questions.
- Preview/build/SEO/journey check results where supported.
- Announcements approved to publish **after** availability is independently verified.
- Per-channel delivery receipts and customer-outcome observations, kept separate.

If a new rollout flag delays launch for EU accounts, packet must branch by scope rather than announce global availability. Revoking a fact version or changing the rollout scope after signoff invalidates affected packet approvals.

## 6. Orchestration and race conditions

Reuse RFC-0037 plan items and approvals. A release may have dependency gates: deployment verified → documentation live → onboarding test green → announcement approval. Each edge is explicit. If one channel fails, show partial release state, retry eligible idempotent work, and block dependent tasks. Do not roll back a public announcement or send a duplicate because a receipt times out; reconcile provider status first.

Keep human final approval for external posts/messages. No one-click “publish everything” without channel-specific recipient/data and content inspection. Respect environment: preview correctness does not establish production availability. If a release reverts, identify already-published inaccurate collateral through Sync and open corrective work rather than auto-delete.

## 7. Metrics and pricing hypotheses

Launch success: accepted release packets, time between verified product availability and approved public materials, share of required assets verified at launch, failures caught before announcement, sales/docs assets actually consumed where consented, and post-launch adoption observations. Do not count drafted material as shipped.

A proposed $399–$1,499 monthly package for frequent launch operators requires sales validation, source integration and real workflow ownership. Meter generated assets, connected destinations, model spend, source scans and managed assistance. Consider per-launch paid pilots first to test value without promising an ongoing launch cadence.

## 8. Implementation phases and acceptance

**A — Manual release packet:** create launch, typed checklist, manually accepted facts and GitHub-backed docs/page links. All non-owned destinations are tickets.

**B — Dependency-aware execution:** prepare reviewer-approved PRs, link actual previews and verified deployment, record readiness; no outbound sends. Acceptance: release readiness stays blocked when production feature isn't available.

**C — GitHub change suggestions and Shots handoff:** suggest candidate release and draft a visual brief for a separately authorized Shots workflow; no automatic media claims.

**D — Commercial channels:** one real customer-requested provider at a time, with scoped OAuth and explicit review/send semantics. Record recipient consent and idempotent receipts.

Test release rollback, delayed rollout, plan segmentation, multi-locale launch, approved draft invalidated by changed fact, delayed GitHub deployments, second release superseding first, partial publish and provider duplicate delivery. Customer acceptance requires a real launch packet used by real product/marketing owners, not a synthetic bulk generator.

## 9. Non-goals

No autonomous messaging, contact harvesting, mass SEO page publishing, full CRM, automatic price modifications or unsupported launch-impact revenue attribution. Existing RFC-0023's technical page launch checklist remains a building block; this RFC expands into cross-system commercial release coordination only after customer validation.
