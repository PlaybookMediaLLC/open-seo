# Relay — company and commercial thesis

**Company:** Playbook Media LLC

**Product:** [relay.playbookmedia.io](https://relay.playbookmedia.io)

**Repository:** [PlaybookMediaLLC/open-seo](https://github.com/PlaybookMediaLLC/open-seo)

**Category:** Website release assurance and organic growth automation

**Strategy updated:** October 23, 2026

## What we are building

Relay helps businesses protect and grow the organic traffic their websites generate through their existing development, analytics, and marketing tools. It connects a consequential website problem to a reviewable correction, a confirmed production resolution, and subsequent observations.

Our commercial thesis is that customers will pay for dependable completion of that work. Release assurance is the initial product: protect important pages when the website changes. Continuous organic growth operations is the longer-term direction in [vision.md](vision.md).

SEO recommendations often remain in engineering backlogs. Meanwhile, releases can change indexing, metadata, performance, accessibility, or conversion behavior. Relay should explain what happened, prepare a narrow correction where it can prove the source, and verify the result through the customer's release process.

## Customer and initial scope

- **Primary customer:** Developer-led B2B SaaS companies with GitHub-managed marketing websites, frequent releases, meaningful organic acquisition, and limited dedicated SEO engineering capacity.
- **Buyer:** Founder, Head of Growth, or technical marketing leader.
- **Daily users:** Software engineers, growth marketers, and website operators.
- **Initial stack:** Next.js websites on GitHub, with Search Console and GA4 for prioritization and outcomes. Supported static routes and literal metadata are the first repair targets.

A protected website starts with a small, explicitly agreed set of commercially important pages. Monitoring can provide technical evidence before analytics has enough history; missing analytics must be visible and must not become invented impact. Unsupported code or changes outside the repository receive an actionable finding or ticket.

Agencies and multi-website portfolios are expansion segments after single-site onboarding and delivery are repeatable.

## Customer workflow

1. **Connect:** Confirm the production origin, important pages, repository, release environment, and permissions. Connect Search Console and GA4 where available.
2. **Understand:** Establish known-good website state, source mappings, search baselines, and the chosen conversion event.
3. **Detect and investigate:** Confirm consequential changes, show reproducible evidence, identify affected pages, and distinguish a suspected cause from a proven one.
4. **Prepare and review:** Produce a narrowly scoped correction with its source, exact diff, checks, risks, and fallback. A person approves repository writes and merges through the customer's process.
5. **Verify:** Confirm deployment and rerun the original failing rule on production. Separately observe search and conversion outcomes over suitable windows.
6. **Report:** Show coverage, service health, verified repairs, pending approvals, unresolved problems, and results still under measurement, including quiet weeks.

The customer retains testing, merge, deployment, and rollback control. Standing approvals and automatic merging are deferred options, not prerequisites for the initial service.

## Foundation and evidence

Relay is an MIT-licensed, upstream-tracking fork of [OpenSEO](https://github.com/every-app/open-seo), with additional work by Playbook Media. The repository contains SEO research, audits, Search Console and GA4 integrations, opportunity detection, investigations, reviewed GitHub publishing, experiments, CI checks, accessibility and performance workflows, Stripe attribution, scheduling, spending controls, and a weekly work view.

The [codebase audit](docs/maintainers/relay-release-assurance-audit.md) distinguishes implementation from remaining integration and acceptance work. The missing first-product pieces are durable known-good production snapshots and confirmed regressions, repairs sourced from those incidents, checks tied to the proposed commit, verification of the original failure, and a measurable paid service around them.

Closed RFCs and recorded smoke tests are engineering evidence. They do not establish paying customers, complete production coverage, reliable renewals, or causal revenue improvements. The [RFC delivery plan](docs/maintainers/rfcs/README.md) is the implementation sequence.

## Positioning and defensibility

Relay overlaps with Semrush, Ahrefs, SEOTesting, Search Atlas, audit tools, and website monitoring products. SEO automation and GitHub integration already exist in the market; recommendations and pull-request creation alone are insufficient differentiation.

The product hypothesis combines production awareness, execution inside the customer's repository and permissions, verification of the original problem, and persistent knowledge of prior decisions and outcomes. The defensibility hypothesis is dependable execution and customer-specific operational knowledge. Both require customer evidence.

## Pricing and distribution

Repository billing configuration currently defines a free tier with $1 in monthly research credits and a $10/month Base Plan with $10 in monthly research credits, plus top-ups. These are research products; they are not a shipped release-assurance subscription.

Test **$79–$149 per protected website per month** for restricted-scope release assurance, with transparent additional research costs. Price, page coverage, check frequency, support expectations, and included usage are pilot hypotheses. Do not sell unlimited monitoring or assume third-party calls, browser checks, storage, and support are free.

Start with useful checks through the [Relay SEO Check GitHub Action](https://github.com/PlaybookMediaLLC/relay-seo-check), founder-led outreach, and software-engineering communities. Demonstrate one consequential problem and a reviewable resolution. Sell a bounded paid pilot before requesting broader permissions. Publish technically detailed case studies only when the customer authorizes them and the evidence supports the claims.

## First 90 days of validation

This clock starts when the validation program starts; these are proposed thresholds, not achieved results or calendar commitments.

| Period     | Work                                                                                                                | Evidence required                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Days 1–14  | Interview 15–20 qualified buyers and operators; examine real incidents, authority, permissions, and existing tools. | Recruit three restricted-access paid pilots; record refusals and why they occur.                                                                                     |
| Days 15–30 | Protect a small set of important pages and establish review and response ownership.                                 | Reproducible findings, visible coverage and monitoring health, and a usable approval workflow. Assisted delivery is acceptable when disclosed.                       |
| Days 31–60 | Complete the repair loop with customers.                                                                            | At least two customer-approved, deployed, production-verified repairs across separate organizations; measure false alerts, time to repair, cost, and support effort. |
| Days 61–90 | Test repeatability and renewal.                                                                                     | Target approximately 8–10 paying websites; record actual renewal behavior where due, distinguish it from stated intent, and assess acquisition and gross margin.     |

If customers value recommendations but will not authorize the required workflow or pay for ongoing protection, pause investment in autonomous repair and revisit the thesis. Broader content generation is not the fallback for a failed release-assurance test.

## How we measure progress

Measure connected production websites, agreed high-value page coverage, successful and overdue monitoring runs, actionable confirmed regressions, reviewed false positives, approved fixes, production-verified resolutions, time to repair, and recurring usage. Count unsupported and blocked work as such.

Measure activation-to-payment, paid renewals, revenue per protected website, acquisition cost, API and compute spending, storage, support time, and gross margin. Track organic conversions and revenue where coverage permits. Observed before/after movements are not causal gains attributable to Relay.

An absence of incidents is valid. Reports must explain what was protected and whether checks actually ran; they must not manufacture changes to justify a subscription.
