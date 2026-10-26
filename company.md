# Relay — company and commercial thesis

**Company:** Playbook Media LLC

**Product:** [relay.playbookmedia.io](https://relay.playbookmedia.io)

**Repository:** [PlaybookMediaLLC/open-seo](https://github.com/PlaybookMediaLLC/open-seo)

**Category:** SaaS customer-facing operations

**Strategy updated:** October 25, 2026

## Company north star

**Relay keeps everything a SaaS business promises, publishes, and delivers aligned as its product changes.**

Build the operating system for a software company's customer-facing operations. Relay should understand what the company sells, what the deployed product does, what customers experience, and what the company says publicly. When those facts change, it should identify the affected systems, prepare the necessary work, obtain the required approvals, and verify completion.

Website release assurance is our first commercial entry point. SEO remains an important acquisition capability. The company can expand into product-information integrity, launch coordination, conversion, activation, education, and customer feedback as customers pay for recurring work.

This is a strategic direction and a set of commercial hypotheses. It does not establish demand for the broader platform or imply that those capabilities are already available.

## The recurring customer problem

A pricing change or new integration creates work across billing entitlements, pricing pages, documentation, onboarding, sales materials, support answers, announcements, and acquisition channels. Those systems often have separate owners and update schedules. The product can ship while the information and journeys customers rely on remain outdated.

Relay's proposed responsibility is the complete change: establish the facts, identify consequences, coordinate approved corrections, and verify the result. The unit of work is a linked business change with evidence and accountable owners.

The opportunity must be validated through actual customer changes. Practitioner anecdotes and competitor descriptions are discovery leads, not evidence of Relay's willingness to pay, retention, or market size.

## Customer and first commercial scope

Start with developer-led B2B SaaS companies that release frequently, use GitHub-managed marketing websites, and have limited capacity to coordinate engineering, growth, product marketing, and support.

- **Initial buyer:** Founder, technical growth lead, or engineering leader.
- **Initial users:** Software engineers, growth marketers, and website operators.
- **Initial stack:** Next.js websites on GitHub, with Search Console and GA4 where available. Supported static routes and literal metadata are the first repair targets.
- **Expansion buyers:** Product operations, product marketing, support leadership, and customer success, once the corresponding workflow has proved valuable.

A Protect pilot starts with a small, agreed set of commercially important pages, an owner, a check cadence, and explicit permissions. Add signup, demo-booking, checkout, and conversion-tracking checks only where a bounded journey can be tested safely and verified. Unsupported code or changes outside an approved integration receive a finding or ticket.

Agencies and portfolios follow repeatable single-company delivery. The broader ambition must not turn a first pilot into a demand for access to every customer system.

## Three flagship offers

| Offer             | Work and customer value                                                                                                                                                           | Buyer                                                          | Initial price test                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Relay Protect** | Detect consequential website and journey regressions, prepare supported repairs, and verify production resolutions. Protect acquisition and conversion.                           | Founder, technical growth lead, engineering leader             | $79–$149 per protected site/month; more extensive journey coverage tested separately |
| **Relay Sync**    | Reconcile pricing, plans, capabilities, integrations, and documentation with verified product facts. Prepare corrections to stale customer-facing claims.                         | Product operations, product marketing, support leader, founder | $299–$999/month, depending on content volume and integrations                        |
| **Relay Launch**  | Turn releases into coordinated website changes, docs, launch packets, customer announcements, and sales materials. Track readiness, approval, publication, and adoption evidence. | Product marketing lead, Head of Growth, founder                | $399–$1,499/month, depending on release frequency and execution scope                |

All three prices are hypotheses. No demand or willingness to pay has been established for the broader offers. They are not changes to the current billing configuration, which defines a free research tier with $1 in monthly credits and a $10/month Base Plan with $10 in credits, plus top-ups.

Each pilot must state coverage, cadence, supported actions, included usage, and support expectations. Measure third-party API calls, browser checks, storage, compute, and support costs. Do not sell unlimited operations.

Land through Protect, expand into Sync when the buyer repeatedly encounters inconsistent information, then coordinate launches across the customer-facing organization. Do not assume a large enterprise contract before proving the first recurring workflow.

## One shared product foundation

The planned **Product Reality Engine** gives Protect, Sync, and Launch a common understanding of changes, product facts, published claims, affected assets, approved actions, and verification.

A change record should answer five questions:

1. What actually changed in the product or business?
2. Which customers, pages, journeys, and claims does it affect?
3. What work is required in each connected system?
4. What can Relay execute under current permissions, and what needs approval?
5. Did the approved work reach its destination and achieve the intended result?

The architecture and evidence-gated roadmap are in [vision.md](vision.md). Build the common facts and change lifecycle once, while shipping narrow workflows that are independently useful.

Relay will consume facts from existing analytics, feature flags, billing, CRM, support, and adoption systems. It will not recreate those full products. Use **Shots** as the specialized visual-production service for screenshots and launch assets.

## Current foundation and limits

Relay is an independent MIT-licensed repository derived from [OpenSEO](https://github.com/every-app/open-seo), outside its GitHub fork network. Retain the license and attribution, reusable research services, tenant isolation, dual SQLite/Postgres support, exact-change approvals, spending controls, and audit records.

The repository includes SEO research, audits, Search Console and GA4 integrations, opportunities, investigations, reviewed GitHub publishing, documentation indexing, experiments, CI checks, accessibility and performance workflows, Stripe attribution, scheduling, and a weekly work view.

The [codebase audit](docs/maintainers/relay-release-assurance-audit.md) records remaining integration and acceptance work. Protect still needs durable known-good production snapshots, confirmed regressions, incident-sourced repairs, proposal-bound checks, general verification of the original failure, and a validated paid service. Complete revenue-critical journey protection and the cross-system fact and impact model are new work.

Closed RFCs, source code, and smoke tests are engineering evidence. They do not prove paying customers, complete production coverage, reliable renewals, or causal revenue gains.

GitHub detachment did not disable the existing upstream-sync workflow. Review incoming improvements and security fixes while allowing Relay's operational model to evolve independently. Separate core operational services from SEO-specific components when the product-fact model and change lifecycle require it; do not make a large service split a prerequisite for a pilot.

## First experiment: three companies, five changes each

Recruit **three developer-led SaaS companies** with frequent releases. Examine Protect, Sync, and Launch as three related paid workflows:

1. Reconstruct each company's last five meaningful product changes.
2. Record what needed updating outside the product, what actually changed, what was missed, who corrected it, and how long that took.
3. Prepare a read-only change-impact report using authorized GitHub and website evidence. Add billing-plan configuration or documentation repositories only with permission.
4. Agree a bounded recurring review-and-correction service, with named reviewers, exact-change approvals, and destination checks.
5. Record actual payments, repeated use, approved corrections, completion evidence, costs, and reasons for refusal.

The purchase question is whether the buyer pays Relay to own recurring review and correction. Interest in a useful report alone is insufficient. Assisted delivery is acceptable when disclosed.

## First 90 days of Protect validation

These periods begin when the program starts. They are targets, not achieved results or calendar commitments. Broader workflow discovery can run alongside this first product.

| Period     | Work                                                                                                     | Required evidence                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Days 1–14  | Interview 15–20 qualified buyers and operators; run the five-change reconstruction with three companies. | Target three restricted-access paid pilots; distinguish commitments from payments and record refusals.                                           |
| Days 15–30 | Agree important pages, coverage, response ownership, and review permissions.                             | Reproducible findings, visible monitoring health, and a usable approval workflow.                                                                |
| Days 31–60 | Complete reviewed repairs through customers' release processes.                                          | Target two approved, deployed, production-verified repairs across separate organizations; measure false alerts, delay, cost, and support effort. |
| Days 61–90 | Test repeatability and renewal.                                                                          | Target 8–10 paying websites; record renewals when due and assess acquisition cost and gross margin.                                              |

If customers will not authorize the necessary workflow or pay for recurring protection, revisit the thesis before expanding. A larger collection of generated content or modules does not resolve a failed validation test.

Start distribution through useful checks in the [Relay SEO Check GitHub Action](https://github.com/PlaybookMediaLLC/relay-seo-check), founder-led outreach, and software-engineering communities. Publish customer case studies only with permission and supporting evidence.

## How we measure progress

The company metric to validate is **weekly paying businesses with verified coverage or completed customer-facing work**, defined in [vision.md](vision.md). During Protect validation, retain the narrower operational measure of weekly active protected paying websites.

Track coverage freshness, actionable-alert precision, missed seeded regressions, verified contradictions, accepted corrections, production-verified resolutions, time to completion, approval effort, repeat launches, and unresolved or blocked work. Pair these with payment, renewal, revenue per customer, acquisition cost, service spending, support time, and gross margin.

Keep a verified correction separate from its commercial effect. Adoption, conversion, and revenue observations require appropriate data and measurement windows. Before/after movement alone does not establish causation.

Quiet weeks are valid: report what was checked and whether coverage held. Never manufacture work to justify a subscription.

## Competitive hypothesis and business scale

Documentation maintenance, product analytics, adoption, launch communications, monitoring, and agent-assisted fixes are established areas. Relay's hypothesis is that important work still falls between independent systems.

The proposed advantage is precise source-to-claim mapping, dependable integrations, explicit authority, verified completion, and accumulated customer-specific decisions. Incumbents can pursue the same work. Relay must prove that it completes these workflows more reliably and with less setup than customers' existing combination of tools.

For scale illustration only: 5,000 customers at $200/month equals $12M ARR; 10,000 at $750 equals $90M; 15,000 at $2,500 equals $450M; and 20,000 at $4,000 equals $960M. These are arithmetic scenarios, not forecasts, market-size estimates, or evidence that Relay can reach those prices or customer counts. Larger contracts require repeated value across departments, trusted execution, and viable support economics.
