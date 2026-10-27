# RFC-0046: Sales enablement, integration truth, and partner-asset integrity

- **Status:** Proposed later track; no CRM or partner-marketplace automation shipped by this RFC
- **Date:** 2026-10-27
- **Implementation position:** Later demand-gated: sales enablement and partner content accuracy
- **Dependencies:** RFC-0034–0042 (accepted product facts, assets, verified work, Sync and Launch); existing documentation/search services. Broader CRM or marketplace writes are separately consented and demand-gated.

## 1. Problem and scope

Sales teams, customer-success teams and partners may reuse product claims that were accurate before a release. Integration landing pages and tutorials may lag API changes; partner listings can promise an unsupported capability. The resulting damage differs from SEO: inaccurate demos, procurement friction, support escalation and failed implementations.

**Decision:** build **asset integrity and reviewed enablement packets** on top of the same fact/change graph. Don't attempt to replace HubSpot, Salesforce, a support platform, product catalog, document editor or partner marketplace. External connector writes require explicit customer demand and security review.

## 2. First supported entities

- Integration catalog entry: provider, version, verified API/SDK capability, status, supported plan/cohort/region, docs link, owner, source evidence.
- Sales asset: approved comparison table, one-pager, feature matrix, FAQ, or demo script stored in repository or user-approved files.
- Partner listing: public external URL and owner, with observation-only status until a provider-approved update mechanism exists.
- Release enablement packet: set of accepted facts, caveats, eligible audience, exact source version, asset references, reviewer and effective date.

`reality_enablement_assets` references RFC-0035 assets where possible; `reality_partner_listings` records owned partner surface and external ID; `reality_integration_capabilities` maps existing accepted fact versions, not independently mutable shadow facts. `reality_enablement_packets` reference one or more approved releases and packet versions.

## 3. Integrity rules

- A sales deck that says “SOC 2 certified” needs an explicit approved attestation/document scope and valid date, not model invention. Sensitive/legal claims require owner review regardless of confidence.
- A comparison matrix must label competitor claims and source freshness; avoid generating unsupported competitive claims.
- A partner directory entry may be accurate for a previously supported API version; verify version before treating it as obsolete.
- An integration API deprecation triggers candidate updates to docs, support articles, troubleshooting steps, product pages and approved external listings, not blind removal.
- A demo script tied to the old UI can be stale even if its feature description is still correct; require route/screenshot freshness metadata for such findings.

For partner claims, store observation time and source, and mark externally owned listings as `requires_partner_action` until the customer supplies appropriate access and authorization.

## 4. Sales material workflow

1. Owner marks an asset authoritative/approved and selects product/audience scope.
2. Product change is accepted in PRE; impact engine retrieves claims and renders a discrepancy report by owner and destination.
3. Relay prepares an updated review packet: before/after claims, citation list, target customer segment, unresolved exceptions and source version.
4. The sales/marketing owner approves content; Relay may open a repo PR for supported file types. For binary decks/PDFs, generate a **suggested replacement asset** through an authorized output pipeline; don't claim fine-grained edits to source formats Relay can't verify.
5. Verify that the approved asset revision is present at the connected destination, or mark `delivery_unverified`. Usage/enablement metrics are optional and require source-specific consent.

A connected CRM may tell Relay which accounts requested an integration only after explicit read scope and privacy safeguards. Such data does not become generally available to agents. Sending sales emails is outside this RFC's first scope.

## 5. Ecosystem health and developer documentation

Reuse GitHub change observation and RFC-0017 docs indexing to detect known integration route breaks, versioned SDK examples, outdated auth scopes, callback URLs and deprecated API paths. Treat schema-compatible changes distinctly from breaking changes. Where a runnable sample can be tested safely, generate a staged CI check under the customer's account; not every code example can be executed, and unsupported examples should receive a ticket.

`integration_check` result: `pass`, `fail`, `unknown`, `unsupported`, with exact SDK/API version, relevant plan/region, environment and reproducible evidence. Do not publish “partner integration broken” when a rate limit or unavailable sandbox prevented the test.

## 6. Phases and acceptance

**A — Repository-stored enablement:** ingest `.md`, `.mdx`, structured feature-matrix files in an allowlisted directory, identify factual claims and link to accepted product facts. Human review only.

**B — Release packet:** when fact changes, list affected enablement assets and create source-backed suggested patches/drafts; exact PR approval and publication check.

**C — Read-only partner and CRM integration:** only with customer request and narrowly scoped OAuth; show external stale listing without write authority.

**D — Partner update and SDK checks:** each connector/action class receives its own consent, preview and outcome verification.

Test a partner listing in a different region, grandfathered deal terms, deprecated SDK API with a valid archived guide, binary asset with no mapping, revoked CRM access, possible legal claim without source and stale document snapshot. No account-specific pricing or contacts should be copied into public sales collateral.

## 7. Security and commercial gate

Commercialize only if product marketing/revenue operations leaders repeatedly pay to keep approved materials accurate. Track stale-claim precision, time from release to revised sales packet, approval latency, distribution confirmation, and hours avoided **only when customer-reported**. Keep external message publishing/manual sales outreach separate. Do not hide a broad CRM implementation behind this RFC.
