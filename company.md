# Relay — company and commercial thesis

**Company:** Playbook Media LLC

**Product:** [relay.playbookmedia.io](https://relay.playbookmedia.io)

**Repository:** [PlaybookMediaLLC/relay](https://github.com/PlaybookMediaLLC/relay)

**Category:** SaaS customer-facing operations

**Strategy updated:** October 27, 2026

## Company north star

**Relay keeps everything a SaaS business promises, publishes, and delivers aligned as its product changes.**

Build the operating system for a software company's customer-facing operations. Relay should know what a company sells, what has actually shipped, which customers a capability or price applies to, what its website and teams promise, and what work each change creates. It then identifies affected surfaces, prepares precise corrections, secures approval, and verifies completion.

The unit of value is **one customer-facing change carried through to a verified outcome**. A dashboard, a draft, or a merged pull request is not enough. A repair must resolve the original production failure; a content update must be live at its intended destination; a launch packet must reflect what is actually available to its intended audience.

**Protect → Sync → Launch** is the initial commercial progression. SEO intelligence remains an acquisition capability, not the boundary of the company. The broader system may eventually cover conversion and revenue integrity, product activation, support intelligence, sales enablement, API and partner materials, and ongoing growth work. Those extensions require their own commercial evidence.

This is the company's direction, not proof that the complete platform exists or that customers will pay for every proposed module.

## The recurring customer problem

A product change creates more work than merging code. A new integration or pricing model can affect billing entitlements, landing pages, documentation, onboarding, support replies, sales materials, customer notices, and acquisition channels. Those systems have different owners and update cycles. The product may be correct while the company continues to make inaccurate promises.

Consider an illustrative pricing change for _new US Business-plan customers_. Correcting the pricing page does not prove that checkout matches the offer, existing customers keep grandfathered terms, documentation lists the new limits, or sales briefs use the right eligibility rules. Relay's proposed responsibility is to establish those scoped facts, find affected claims and journeys, prepare authorized changes, and independently check their destinations.

Most teams already own tools that solve individual parts of this work. Relay should coordinate the unfinished work _between_ them rather than replace analytics, billing, support, CRM, feature flags, or CI. The business only works if customers recognize the recurring costs of missed changes and will pay for verified completion.

## Customer and first commercial scope

Start with developer-led B2B SaaS companies that release frequently, use GitHub-managed marketing websites, and have limited capacity to coordinate engineering, growth, product marketing, and support.

- **Initial buyer:** Founder, technical growth lead, or engineering leader.
- **Initial users:** Software engineers, growth marketers, and website operators.
- **Initial stack:** Next.js websites on GitHub, with Search Console and GA4 where available. Supported static routes and literal metadata are the first repair targets.
- **Expansion buyers:** Product operations, product marketing, support leadership, and customer success, once the corresponding workflow has proved valuable.

A Protect pilot starts with a small, agreed set of commercially important pages, an owner, a check cadence, and explicit permissions. Add signup, demo-booking, checkout, and conversion-tracking checks only where a bounded journey can be tested safely and verified. Unsupported code or changes outside an approved integration receive a finding or ticket.

Agencies and portfolios follow repeatable single-company delivery. The broader ambition must not turn a first pilot into a demand for access to every customer system.

## Three flagship offers

| Offer             | Work customers would pay for                                                                                                                                                                                      | Buyer                                             | Delivery and pricing status                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Relay Protect** | Monitor selected production pages, confirm harmful regressions, propose source-backed fixes, and verify that customer-deployed repairs work. Expand to signup, demo, checkout and tracking checks when validated. | Founder, technical growth or engineering leader   | **Initial paid entry.** Per protected site/month, priced and scoped with pilot customers; broader journeys are planned. |
| **Relay Sync**    | Reconcile scoped, versioned product facts with pricing, feature, integration, marketing and documentation claims. Prepare approved corrections and verify publication.                                            | Product operations, marketing, support or founder | **Planned expansion.** $299–$999/month is a hypothesis, not a live plan.                                                |
| **Relay Launch**  | Coordinate fact-backed website changes, docs, announcements, sales assets, owners and evidence of publication after a meaningful release.                                                                         | Product marketing, growth or founder              | **Planned expansion.** $399–$1,499/month is a hypothesis, not a live plan.                                              |

These are three offers using one shared operational model, not three separate sources of truth. Initial sales require bounded contracts: monitored pages and assets, check cadence, permissions, usage limits, support expectations, and named decision-makers. Do not sell unlimited agent execution or assume production automation is ready.

The hosted application currently has a free research tier with $1 in monthly credits and a $10/month Base Plan with $10 in monthly credits, plus top-ups. **These research plans are not paid Protect, Sync, or Launch subscriptions.**

## One shared product foundation

The planned **Product Reality Engine** provides a common model for Protect, Sync and Launch:

1. **Observe:** ingest authenticated change events and production observations with source identity, version, scope, timestamps and collection health. A commit is not proof of deployment.
2. **Establish facts:** record versioned prices, entitlements, feature availability, APIs, integrations, release cohorts, geographies and effective dates. Conflicting or missing evidence is explicit.
3. **Determine impact:** link accepted facts to claims, assets, journeys and owners. An approximate text match isn't proof that a published statement is wrong.
4. **Prepare and approve:** assemble the specific work, source revision, diff, permissions and review decision. Use existing GitHub approval and publishing controls before adding any new writer.
5. **Execute, verify and learn:** distinguish prepared work, a merged PR, observed deployment, confirmed production resolution, and later business outcome. Record failed and inconclusive results as well as successful ones.

The intended lifecycle is **observe → establish facts → determine impact → prepare → approve → execute → verify → learn**. The review interface should expose real evidence and pending decisions; APIs, MCP tools, CI and connected software should apply the same tenant and permission rules. Agents can investigate and draft but do not inherit authority to publish, merge, charge, or send communications.

Start with Git-backed changes, pricing and integration facts, and public content. Reuse existing authorization, docs indexing, GitHub publishing, measurement, jobs and spend controls. Integrate external analytics, billing, CRM, support and feature-flag providers rather than rebuilding them. Shots can supply visual materials for Launch when explicitly connected and authorized.

The [vision](vision.md) defines the long-term model, while the [numbered IRFC implementation queue](docs/maintainers/rfcs/implementation/README.md) defines the actual work order. Build the smallest customer-valuable slice of this architecture, not the entire schema before the first paid use.

## Current foundation and limits

Relay is an independent MIT-licensed repository derived from [OpenSEO](https://github.com/every-app/open-seo), outside its GitHub fork network. Retain the license and attribution, reusable research services, tenant isolation, dual SQLite/Postgres support, exact-change approvals, spending controls, and audit records.

The repository includes SEO research, audits, Search Console and GA4 integrations, opportunities, investigations, reviewed GitHub publishing, documentation indexing, experiments, CI checks, accessibility and performance workflows, Stripe attribution, scheduling, and a weekly work view.

The [October 23 codebase audit](docs/maintainers/relay-release-assurance-audit.md) recorded remaining integration and acceptance work: durable known-good production snapshots, confirmed regressions, incident-sourced repairs, proposal-bound checks, production verification of the original failure, and a validated paid service. Recheck these gaps against the latest `develop` revision during implementation; an audit is a dated baseline, not an eternal assertion. Full revenue-critical journey protection, cross-system facts and impact analysis, Sync and coordinated Launch are proposed, not shipped.

Closed RFCs, source code, and smoke tests are engineering evidence. They do not prove paying customers, complete production coverage, reliable renewals, or causal revenue gains.

GitHub detachment did not disable the existing upstream-sync workflow. Review incoming improvements and security fixes while allowing Relay's operational model to evolve independently. Separate core operational services from SEO-specific components when the product-fact model and change lifecycle require it; do not make a large service split a prerequisite for a pilot.

## One numbered execution plan

Engineers and coding agents should start at the [implementation index: IRFC-0001–0033](docs/maintainers/rfcs/implementation/README.md). Each IRFC names the exact technical slice, the original detailed RFC, its prerequisites, required acceptance evidence, and what is deferred. Original RFC-0001–0046 numbers remain stable historical design references; completed scopes are not to be implemented again.

| Implementation order | Milestone                                                                                                                                      | Investment gate                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **IRFC-0001–0007**   | Protect: paid pilot, monitored pages, confirmed incidents, reviewed source repairs, previews, production verification and recurring reporting. | Actual payments and working customer-owned repair outcomes, with manageable cost and reliable coverage.                       |
| **IRFC-0008–0019**   | Product Reality Engine's minimum useful slice and Relay Sync: accepted facts → affected claims → authorized corrections → verified results.    | A buyer repeatedly pays for an accurately detected, corrected and independently verified inconsistency.                       |
| **IRFC-0020–0022**   | Customer-created page launch checks, approved Relay Launch packets and selective read-only API/MCP access.                                     | Repeated releases coordinated and used by customers; no assumption that read-only integrations require a new platform.        |
| **IRFC-0023–0033**   | Broader growth, journeys, revenue integrity, support, sales, delegated authority, sandboxes and portfolios.                                    | Demand, safety and cost gates for each optional workflow. Skip or defer failures rather than manufacture implementation work. |

**Sequence is about proven customer outcomes, not the number of implemented RFCs.** Discovery can happen in parallel; a paid validation failure should change the investment decision. Coding agents should inspect the current branch before each item, reuse existing code and preserve human approval and independent production verification.

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
| Days 61–90 | Test repeatability and renewal.                                                                          | Paying-website target (set privately); record renewals when due and assess acquisition cost and gross margin.                                    |

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

Expansion economics depend on proven per-workflow willingness to pay, customer acquisition cost, provider and compute expenses, human support time, renewal, and whether multiple departments truly adopt the same evidence and execution system. Revenue scenarios should be modeled from observed customer segments and pricing tests rather than presented as a market forecast.
