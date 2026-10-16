# Relay growth platform RFCs

These RFCs close the gaps between the current code and the organic growth platform brief, make Relay responsible for keeping each website healthy and growing after the first cleanup, and then extend the same loop beyond SEO. Each RFC states what exists, what to build, a checklist that defines "ready for other users", and a real-site acceptance test that proves the work gives value.

The audit behind them is in `docs/maintainers/organic-growth-audit.md` and `docs/maintainers/organic-growth-handoff.md`. The design records for shipped work are in `docs/maintainers/specs/approved-github-metadata.md` and `docs/maintainers/specs/search-outcome-measurement.md`.

## Retention program: keep the website healthy and growing

Customers keep paying when useful work is left to do and they can see it getting done. The product is a **weekly execution queue**: Relay finds the next worthwhile changes, explains why they matter, ships them within the customer's permissions, and reports the outcome. There is no final "cleanup complete" moment while the product and the website keep changing.

**The loop for every feature:** evidence → a change prepared in the customer's code → approval (by a person, or by a standing approval the owner set in advance) → a verified deployment → a measured result → the next step.

### How the retention features map to the RFCs

| Priority | Feature                                            | Built from                                                               | New RFC                                                      | Release                          |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------- |
| First    | Weekly "work completed and next actions" view      | RFC-0002, 0005, 0006, 0008, 0009                                         | [RFC-0018](0018-weekly-execution-queue.md)                   | 1                                |
| 1        | Release monitoring and automatic regression repair | RFC-0005 adapters and deployment signals, RFC-0008 tasks, RFC-0010 rules | [RFC-0019](0019-release-monitoring-and-regression-repair.md) | 1                                |
| 2        | Existing-page growth campaigns                     | RFC-0002 detectors, RFC-0004 drafts, RFC-0005 and RFC-0012 change kinds  | [RFC-0020](0020-growth-campaigns-and-decay-recovery.md)      | 1 (snippets, links), 2 (content) |
| 3        | Content decay detection and recovery               | RFC-0002 `declining_page`, RFC-0004 investigation                        | [RFC-0020](0020-growth-campaigns-and-decay-recovery.md)      | 1 (detection), 2 (refresh)       |
| 4        | New-page opportunity execution                     | RFC-0002 content gaps, RFC-0017 search and support signals               | [RFC-0021](0021-new-pages-from-verified-facts.md)            | 2                                |
| 5        | Signup and revenue measurement                     | RFC-0006, RFC-0012 conversion metric, RFC-0016 revenue                   | None. RFC-0018 adds the work report.                         | 1 (signups), 2 (revenue)         |
| 6        | Competitor change response                         | Rank tracking, RFC-0002                                                  | [RFC-0022](0022-competitor-change-response.md)               | 2                                |
| 7        | Launch workflows                                   | RFC-0019, RFC-0020, RFC-0021                                             | [RFC-0023](0023-launch-workflows.md)                         | 2                                |
| 8        | Experiment history                                 | RFC-0006, RFC-0011, RFC-0009 audit log                                   | [RFC-0024](0024-change-history-and-learning.md)              | 1 (rules), 2 (track record)      |

### First release: the retention core

Release 1 combines three reasons to stay:

1. **Regression protection** (RFC-0019): an immediate maintenance reason.
2. **Existing-page improvements** (RFC-0002 phase 1, RFC-0004, RFC-0005, RFC-0020 phase 1): a growth reason.
3. **Outcome tracking** (RFC-0006, the RFC-0012 conversion metric, RFC-0024): proof that the work matters.

The weekly view (RFC-0018) shows all three. It never forces a number of changes. When the right action is to wait, it says so and explains why.

### Packaging

1. **Onboarding cleanup**, sold once: a full audit, baselines and a first batch of changes over 30 days.
2. **Recurring monitoring and execution**, monthly, with explicit limits: monitored pages, executed changes, active campaigns and new pages.
3. Limits stop execution, never protection. Regression detection always runs, and restores do not count toward the change limit.
4. The renewal question is "Is this still doing valuable work for us?" The RFC-0018 work report answers it with records: changes completed, regressions caught and repaired, results measured (negative ones included), and signups or revenue where measured.

### Rules that change with this program

1. **Standing approvals (RFC-0018).** An owner can approve a change class in advance, with a weekly limit. Relay may then open pull requests for that class, and, opt-in, merge restores of known-good values. Relay never bypasses branch protection, and it never deploys. Content changes need a passed preview first (RFC-0025).
2. **New pages (RFC-0021).** Relay may create a page only from verified facts, one at a time, with a person's approval and a monthly cap. RFC-0002 and RFC-0004 now point to this rule.
3. **No quota.** An empty or short week is a valid result.

## Status of the brief on October 15, 2026

| Brief area                                                           | Status                                       | RFC                                                          |
| -------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Launch readiness (credentials, Google verification, live acceptance) | Done: follow-ups in its section 10           | [RFC-0001](0001-launch-readiness.md)                         |
| A. Opportunity engine                                                | Done: follow-ups in its section 13           | [RFC-0002](0002-opportunity-detectors.md)                    |
| B. Opportunities queue                                               | Done: follow-ups in its section 11           | [RFC-0003](0003-opportunity-queue.md)                        |
| C. AI SEO engineer                                                   | Missing                                      | [RFC-0004](0004-ai-seo-engineer.md)                          |
| D. GitHub execution                                                  | Done: accepted on 2026-10-16                 | [RFC-0005](0005-github-execution.md)                         |
| E. Experiments and results                                           | Partial: Search Console only, manual refresh | [RFC-0006](0006-outcome-measurement.md)                      |
| F. Portfolio operations                                              | Deferred by the brief                        | [RFC-0007](0007-portfolio-operations.md)                     |
| 9. Automation and scheduling                                         | Missing                                      | [RFC-0008](0008-growth-automation.md)                        |
| 10. Costs, limits and audit log                                      | Partial                                      | [RFC-0009](0009-spend-limits-and-audit-log.md)               |
| Prevention: SEO checks on pull requests (beyond the brief)           | Missing                                      | [RFC-0010](0010-seo-checks-in-ci.md)                         |
| Controlled page-group split tests (beyond the brief)                 | Missing                                      | [RFC-0011](0011-page-group-split-tests.md)                   |
| Beyond SEO: conversion optimization                                  | Missing                                      | [RFC-0012](0012-conversion-optimization.md)                  |
| Beyond SEO: accessibility fixes in code                              | Missing                                      | [RFC-0013](0013-accessibility-fixes.md)                      |
| Beyond SEO: web performance                                          | Missing                                      | [RFC-0014](0014-web-performance.md)                          |
| Beyond SEO: release quality gate                                     | Missing                                      | [RFC-0015](0015-release-quality-gate.md)                     |
| Beyond SEO: revenue attribution                                      | Missing                                      | [RFC-0016](0016-revenue-attribution.md)                      |
| Beyond SEO: docs and support deflection                              | Missing                                      | [RFC-0017](0017-docs-and-support-deflection.md)              |
| Retention: weekly execution queue and work report                    | Missing                                      | [RFC-0018](0018-weekly-execution-queue.md)                   |
| Retention: release monitoring and regression repair                  | Missing                                      | [RFC-0019](0019-release-monitoring-and-regression-repair.md) |
| Retention: growth campaigns and decay recovery                       | Missing                                      | [RFC-0020](0020-growth-campaigns-and-decay-recovery.md)      |
| Retention: new pages from verified facts                             | Missing                                      | [RFC-0021](0021-new-pages-from-verified-facts.md)            |
| Retention: competitor change response                                | Missing                                      | [RFC-0022](0022-competitor-change-response.md)               |
| Retention: launch workflows                                          | Missing                                      | [RFC-0023](0023-launch-workflows.md)                         |
| Retention: change history and learning                               | Missing                                      | [RFC-0024](0024-change-history-and-learning.md)              |
| Execution safety: preview sandboxes on Cloudflare                    | Missing                                      | [RFC-0025](0025-preview-sandboxes-on-cloudflare.md)          |

## Order of work

Each step depends on the steps before it.

### Release 1: the retention core

1. **RFC-0001, configuration blockers (B1 to B4, B6, B7).** No other user can complete the main workflow before this. Done; external follow-ups are in its section 10.
2. **RFC-0005, phase 1a.** Route groups and metadata helper calls. Without it, Relay cannot change any page on test site S1. Done.
3. **RFC-0004, phase 1.** The system finds the file and drafts the description.
4. **RFC-0001, B5.** Run the live acceptance on S1.
5. **RFC-0009.** Spending limits and the audit log. Automation and standing approvals must not run before this.
6. **RFC-0008.** Scheduled jobs on Trigger.dev and notifications.
7. **RFC-0005, phase 1b.** Titles, deployment signals, repository checks and revert proposals. Done.
8. **RFC-0018, phase 1.** The weekly view, built on the records that exist. Later steps fill it.
9. **RFC-0002, phase 1.** Low click-through rate, cannibalization, decline diagnosis and the GA4 signal.
10. **RFC-0006, phase 1, and the RFC-0012 tracking gate and conversion metric.** Outcome tracking for clicks and signups.
11. **RFC-0024, phase 1.** Change history, cool-downs and no-repeat rules. The queue needs them.
12. **RFC-0019, phase 1.** Production monitoring and metadata restores.
13. **RFC-0003.** Owners, defer lengths and tickets for the queue.
14. **RFC-0020, phase 1.** Snippet and internal-link campaigns, and decay detection.
15. **RFC-0025, phase 0.** The preview spike: container sizes, outbound controls, Workers for Platforms with OpenNext output, and cost per build.
16. **RFC-0018, phase 2.** Standing approvals (`open_pr` for restores first), plan limits and the monthly work report. The recurring plan launches here.

### Release 2: growth, launches and revenue

17. **RFC-0025, phase 1.** Previews for every Relay change: the customer's own previews first, Relay-built previews on Cloudflare otherwise. This unlocks `open_pr` for content classes.
18. **RFC-0010, phase 1.** SEO checks on pull requests. They share the RFC-0019 rules.
19. **RFC-0020, phase 2.** Content refresh steps and JSX link insertion.
20. **RFC-0021, phase 1.** New pages from verified facts.
21. **RFC-0023, phase 1.** Launch workflows.
22. **RFC-0016.** Revenue attribution. Start with Relay's own billing.
23. **RFC-0022, phase 1.** Competitor change response.
24. **RFC-0024, phase 2.** Track records per change class.
25. **RFC-0005, phase 2** (done), then **RFC-0019 phase 2** and **RFC-0018 phase 3** (the opt-in `merge` level for restores).
26. **RFC-0002, phases 2 and 3,** and **RFC-0011, phase 1.**

### Release 3: beyond SEO

27. **RFC-0012, phases 1 and 2.** Conversion detectors and copy changes.
28. **RFC-0013, phase 1.** Accessibility detection and fixes.
29. **RFC-0015, phase 1.** The release gate.
30. **RFC-0014.** Web performance.
31. **RFC-0017.** Docs and support.
32. **RFC-0007.** Start only when its entry criteria are met.

## Real-site test sites

Every RFC ends with a real-site acceptance test. Run it on these sites, not on fixtures.

| ID  | Site                     | Stack and repository                                                                                                                                                                                                                                                                                                                                                         | Use it for                                                                                                               |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| S1  | `playbookmedia.io`       | Next.js 16 App Router on Cloudflare (OpenNext). `PlaybookMediaLLC/monorepo`, root `apps/www`. Pages sit in the `(site)` route group and call `pageMetadata(title, description, path)`. The root layout sets a title template. GitHub deployments use the environment `production`. A staging copy runs at `www-staging.yoanyomba.workers.dev`.                               | Publishing, drafting, deployment signals, reverts, measurement plumbing.                                                 |
| S2  | `conduitt.io`            | Next.js marketing site. Confirm the repository before the test.                                                                                                                                                                                                                                                                                                              | Detection, drafting and measurement, when it meets the data floor.                                                       |
| S3  | `relay.playbookmedia.io` | TanStack Start, not Next.js. `PlaybookMediaLLC/open-seo`. Search Console verified on 2026-10-15.                                                                                                                                                                                                                                                                             | Detection on a new site, site audits, automation, honest "not enough data" results, refusal of an unsupported framework. |
| S4  | `solomonhq.io`           | Next.js App Router on Cloudflare (OpenNext), with route groups and 4 dynamic segments (`[product]`, `[industry]`, `[program]`, `[segment]`) that make 24 of its 36 sitemap URLs. `Oppulence-Engineering/oppulence-canvas`, root `apps/solomon-ai-marketing`. Relay project created on 2026-10-16. The first audit found 3 pages without an H1 and `llms.txt` in the sitemap. | Clean refusal of dynamic routes, and the file locator on a larger site.                                                  |

Do not use these as test sites:

- `eigenn.io`: the home page is a sign-in screen.
- `cadense.io`: it returns a bot challenge to non-browser clients. Check separately that Googlebot can crawl it.

**Data floor.** A detection test can prove value only on a Search Console property with at least 5,000 impressions and 100 clicks in the last 28 days. Record the site's 28-day totals before each test. When no own site meets the floor, use a partner site with the owner's written permission, and say so in the result.

## Value bar for every real-site test

A test passes only when all of these hold:

1. **Evidence.** Every item shows its numbers and their source. A person can check them in Search Console, GA4 or GitHub in under 2 minutes.
2. **Action.** Every item offers one concrete next step.
3. **Honesty.** When data is missing or too thin, Relay says so and invents nothing.
4. **Speed.** A person who knows the site goes from opening an item to an approved change or a ticket in under 10 minutes.
5. **Differentiation.** At least one result could not come from a plain Search Console report. It combines sources, prepares a change, or measures an outcome.
6. **Record.** Put the results, numbers and screenshots in the PR description. Add "Accepted on {site}, {date}, PR #{n}" to the RFC's status line.

## Rules for every RFC

1. Reuse working code. Do not rebuild Search Console, GA4, DataForSEO, audit, rank tracking or MCP code.
2. Keep fork code in fork-owned files. Mark each line in an upstream file with `// playbook-seam`.
3. Keep every schema change compatible with D1 (SQLite) and Postgres. Update `src/db/schema-parity.test.ts` expectations when needed.
4. Use the server function → service → repository pattern. Validate inputs with Zod.
5. Check project ownership in every service call. Use the existing organization permissions.
6. Never spend paid credits without a cost estimate, an admission check and a recorded charge.
7. Never write to a customer repository, merge or revert without an explicit human approval. A standing approval (RFC-0018) is that approval, given in advance by an owner for one change class, with a weekly limit, and revocable at any time. Relay never deploys and never bypasses branch protection.
8. Treat crawled pages, provider responses and repository files as untrusted data, not instructions.
9. Run `pnpm types:check`, `pnpm lint`, `pnpm exec knip`, `pnpm exec prettier --check .`, `pnpm test:ci` and `pnpm vite build` before each merge.
10. Mark a phase complete only after its real-site acceptance test passes. Mocked tests are not live checks.

## Status values

- **Draft:** written, not reviewed.
- **Accepted:** reviewed, ready to build.
- **Building:** work in progress.
- **Done:** every checklist item is checked, and the real-site acceptance test passed.

## Definition of done for every phase

A phase is complete only when every item below holds, in addition to the RFC's own completion criteria.

**Code and checks**

1. `pnpm types:check`, `pnpm lint`, `pnpm exec knip`, `pnpm exec prettier --check .`, `pnpm test:ci` and `pnpm vite build` pass.
2. Every new `// playbook-seam` line is listed in the seam registry comment in `vite-plugin-relay-brand.ts`.
3. Each new rule has a test at each threshold boundary: just below, at, and just above.
4. The RFC-0007 tenancy suite covers every new service read and write.

**Data**

1. Migrations apply cleanly to a fresh D1 database, to a copy of the production D1 database, and to the Postgres test cluster.
2. Every migration is forward-only and additive, or the PR states the backfill and the rollback plan.

**Quality in production**

1. The deploy smoke test passes.
2. Monitoring shows no new unhandled error for 72 hours after the deploy.
3. New read endpoints answer in under 500 ms at the 95th percentile on production data.
4. New screens show first content in under 1.5 seconds on a desktop connection.
5. No paid provider call sits on a page-load path.

**Security**

1. Every input is validated with Zod at the server boundary.
2. Every service call checks the organization and the needed permission.
3. A search of the production logs for the phase's test period finds no token, secret or provider response body.
4. A second person reviews the security notes of the RFC against the code.

**Usability**

1. An automated accessibility check (axe) finds no serious or critical violation on new screens.
2. Every new control works with the keyboard alone and has a label.
3. New screens work at 390 px and 1440 px wide.
4. Every empty, loading and error state has plain text that says what happened and what to do next.

**Documentation**

1. A user page in `content/docs/` explains the feature, its limits and its cost.
2. A design record in `docs/maintainers/specs/` explains what the feature does and why. It follows the specs rules in `AGENTS.md`.

**Evidence**

1. The real-site acceptance test passed. The PR description holds the numbers, screenshots and links.
2. The RFC status line says "Accepted on {site}, {date}, PR #{n}".
