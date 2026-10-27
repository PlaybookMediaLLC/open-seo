# RFC-0029: Commercial evidence, phased rollout, and stop/go decisions for Protect → Sync → Launch

- **Status:** Proposed commercial validation contract
- **Date:** 2026-10-27
- **Implementation position:** Gate 0: commercial discovery and go/no-go, before platform expansion
- **Dependencies:** Existing RFC-0026 (paid Protect pilot discovery); company.md and vision.md. This RFC defines commercial gates for every later RFC and is not blocked by their implementation.
- **Owner:** Founder / product
- **Decision:** New platform scope expands only after customers pay for repeatedly verified work; design depth is not product-market fit.

## 1. Purpose

The Product Reality Engine is a large potential technical program. Building the complete graph, connectors and product surfaces before finding a budgeted customer problem would repeat the failure mode the original market research warned about. The roadmap must stage reusable infrastructure behind a paid customer workflow and keep evidence of commercial demand distinct from feature implementation.

Protect remains the narrow first offer. Sync's versioned facts and content integrity is the next hypothesis; Launch coordination follows when real customers experience recurring release work. Each product must establish its economic buyer, access permissions, and renewal driver independently. A single enthusiastic company does not validate a broad market.

## 2. Target buyers and discovery frame

| Offer   | First buyer / daily users                                  | Trigger worth investigating                                          | Alternatives and switching constraints                                    |
| ------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Protect | technical founder, growth/engineering lead                 | broken high-value page, signup path or instrumentation after release | uptime/CI tools, developer ownership, website access permissions          |
| Sync    | product ops, product marketing, support content owner      | plan/feature/integration changes create public contradictions        | existing docs owner, manual reviews, CMS/KB workflow, legal approval      |
| Launch  | product-marketing lead or founder, product + GTM operators | release announced late or materials contradict rollout               | existing release checklist, Notion/Jira, PR process, marketing automation |

Ask customers to reconstruct their **last five meaningful product changes**, including what actually shipped, where messages/docs/pricing needed edits, who owned the work, what they missed, how discovered, what it cost, and which current tool or service got paid. Request artifacts when permitted (sanitized PRs, tickets, approval threads, broken pages); avoid hypothetical “would you use AI?” interviews.

## 3. Evidence hierarchy

1. **Observed:** customer pays and authorizes bounded access; repeats use; an approved change reaches and passes verification.
2. **Strong behavioral:** customer grants access, spends time importing real artifacts, assigns an owner, runs a second cycle without prompting.
3. **Stated intent:** requests a pilot or price quote and names budget, but no payment.
4. **Interest only:** positive interviews, demo compliments, waitlists or feature requests.

Track them separately. Do not count signed-up research users as Protect subscribers or a trial conversion as retained monthly revenue. Published competitor prices can inform tests, but are not proof of Relay willingness to pay.

## 4. Initial 90-day validation program

The clock starts when the program is deliberately launched. Targets are **proposed gates**, not accomplished outcomes or committed delivery dates.

| Window     | Work                                                                                                                             | Decision evidence                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Days 1–14  | 15–20 qualified Protect buyer/operator interviews; rebuild five real changes each; seek 3 restricted paid pilots                 | Actual agreement/payment, protected scope, reviewer, permitted source access; log refusals               |
| Days 15–30 | Protect 5–20 chosen pages per site, show healthy/stale coverage and reproducible incidents. Assisted work allowed when disclosed | At least 3 usable pilot scopes; no unsupported monitoring promises; reported alert precision             |
| Days 31–60 | Human-approved safe repair through exact PR → customer merge → production verification                                           | 2 independently verified repairs across distinct companies targeted; measure time, cost, reviewer effort |
| Days 61–90 | Repeat paid cycles; audit gross margin, access friction, false alerts, renewal                                                   | Approx. 8–10 paying sites targeted; actual renewals where due, expressed intent labeled separately       |

In parallel, run **read-only Sync discovery** with these same companies: collect pricing/feature/integration change evidence and map up to 20 public assets, but do not spend substantial infrastructure time before identifying buyers and paid willingness.

## 5. Sync gate

Enter Sync implementation when at least three qualified companies have shown real dated product-content discrepancies, the correct decision owner is reachable, and at least two are willing to sign a paid pilot at a disclosed price. These are deliberately low-volume, early-product gates. Do not claim market validity from them.

First Sync pilot deliverable: accepted scoped facts for price/feature/integration, 10–20 indexed public assets, a prioritized drift report distinguishing true conflict from legitimate audience difference, and one customer-approved correction that reaches production and passes a content check. Record false positives per verified candidate and customer reviewer time. Failure to obtain legal/permission clearance is a blocker, not a product success.

Expansion gate: repeated real drift or material risk across more than one release cycle, paying renewal/extension, and review effort/cost compatible with pricing. If customers do not repeatedly encounter the problem or won't permit Relay to act, stop at read-only findings or retain the capability as a low-cost feature rather than a separate commercial product.

## 6. Launch gate

Start Launch interviews when Sync has at least one proven recurring paid workflow or when independent paid launch-only demand is directly observed. Interview product marketing/release owners about the last five launches: coverage checklist, data sources, approval chain, actual delayed material, affected accounts, channels and existing spend.

Pilot with a **manually initiated release** and a verified public product fact, not an LLM-generated event. Success requires a launch packet actually reviewed and used by the owner, docs/website tasks completed, artifact publication independently verified, and consented delivery status for any eventual outbound channel. Repeat it for a second release. Track whether customer assigns operational responsibility to Relay and pays to renew, not pages generated.

## 7. Product/engineering priority ledger

| Priority              | Build/test                                                                                                   | Why now / when                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **P0**                | Finish existing RFC-0019/0025/0026/0027/0028 Protect path                                                    | first safe completed outcome and initial commercial proof                        |
| **P0**                | New RFC-0030 common evidence contract, minimal RFC-0033 manual/GitHub event and RFC-0037/0038 bridges        | avoid inventing duplicate evidence/authority semantics                           |
| **P1**                | RFC-0034 manually reviewed scoped facts + RFC-0035 restricted claim extraction + RFC-0036 exact impact rules | first measurable Sync pilot without broad integrations                           |
| **P1**                | RFC-0040 first reviewed correction and Verify-on-production                                                  | usable Sync outcome that can be paid for                                         |
| **P2**                | RFC-0042 manual launch packet and required artifact checklist                                                | default next paid product after Sync; repeat release work, not content volume    |
| **P2 (demand-gated)** | RFC-0043 safe conversion journeys; RFC-0044 reporting consistency, customer requested                        | expands paid Protect with measurable failures only when buyer demand warrants it |
| **P3**                | Support/activation/enablement, third-party writes, semantic candidate expansion                              | only after customer demand and access policies                                   |
| **Deferred**          | automated merges, sends, billing writes, unbounded website builds, full CMS, portfolio management            | too much operational/security and switching cost before validated need           |

RFC-0031/0032 security, scope and usage rules apply **before** each new integration; these are not separate months of speculative infrastructure construction. RFC-0039 workbench and RFC-0041 API may ship in narrow increments aligned to active pilot needs.

## 8. Decision scorecard

For each offer, preserve a concise evidence log:

- `customer_id` (internal pseudonymous), company-size band, product type, buyer role and purchasing authority.
- Actual last product-change example with source and date, failure/scope and prior mitigation.
- Existing spend and manual staff time, separating measured time from customer estimate.
- Permission status and blockers for GitHub, data sources, production origin and outbound actions.
- Offered price, plan scope, actual payment date and amount (or reason not paid).
- Alert/finding precision: confirmed, valid exception, false positive, unknown; reviewer time.
- Action lifecycle: proposed, approved, executed, production verified, externally resolved or unresolved.
- Actual renewal/cancellation, reason and customer-reported business value.
- Provider/model/browser cost and operator support time per paid site/project.

Only aggregate into KPIs from reproducible event definitions. No invented market-wide prevalence, switching likelihood or causal revenue lift.

## 9. Stop conditions and counterarguments

**Protect stop/redirect:** too many false incidents, customer refuses repo read/review, browser checks are prohibitively expensive, or paid buyers consider existing monitoring enough and will not pay for approved repair completion.

**Sync stop/redirect:** product scope prevents reliable truth inference, customers prefer documentation owner to update pages manually, drift frequency too low to renew, or model extraction costs exceed willingness to pay. Keep confirmed drift review as a useful feature without a standalone sales motion.

**Launch stop/redirect:** release teams won't authorize cross-system access, already use effective release checklists, or the output is mostly content draft material they can create elsewhere. Do not assume breadth implies demand.

**Platform stop:** repeated engineering work on generalized adapters with no active paid consumer; growing support burden and negative gross margin; inability to obtain appropriate consent. Reprioritize to a simpler execution product. Sunk costs do not justify continuing.

## 10. Independent challenge and commercialization review

Before each major investment ask a reviewer not responsible for the implementation to argue for buying/integrating existing tools instead. Require a concrete answer for: who pays, what triggers the purchase, which verified outcome replaces current work, how long onboarding takes, what switching cost remains, and which technical feature Relay must operate better than incumbents.

Review customer retention by product. A unified account may be valuable operationally, but a broad suite does not create automatic cross-sell or economic defensibility. Protect, Sync and Launch each need responsible product metrics and service contracts before bundling.

## 11. Readiness and definition of done

A stage is `implemented` when tests and code are complete, `live_accepted` only after a stated customer/authorized environment confirms it, and `commercially_validated` only with actual purchasing and repeat behavior. Keep these three labels distinct in RFCs, PRs, marketing and weekly reports.

No new paid plan is “launched” merely because an Autumn config exists; entitlement enforcement, cancellation, limits, operational coverage, lawful source access, help documentation, recovery and customer support expectations must work. No launch/Synch success claim without verified destination state.

At the end of 90 days, founder records **continue, narrow, reposition, pause or stop** with metrics, evidence gaps, limitations and next smallest paid test. The correct output can be to abandon an unproven module while preserving reusable code.
