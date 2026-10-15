# Relay growth platform RFCs

These RFCs close the gaps between the current code and the organic growth platform brief, then extend the same loop beyond SEO. Each RFC states what exists, what to build, a checklist that defines "ready for other users", and a real-site acceptance test that proves the work gives value.

The audit behind them is in `docs/maintainers/organic-growth-audit.md` and `docs/maintainers/organic-growth-handoff.md`. The design records for shipped work are in `docs/maintainers/specs/approved-github-metadata.md` and `docs/maintainers/specs/search-outcome-measurement.md`.

## Status of the brief on October 15, 2026

| Brief area                                                           | Status                                       | RFC                                             |
| -------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Launch readiness (credentials, Google verification, live acceptance) | Blocking                                     | [RFC-0001](0001-launch-readiness.md)            |
| A. Opportunity engine                                                | Partial: 2 of 7 types, Search Console only   | [RFC-0002](0002-opportunity-detectors.md)       |
| B. Opportunities queue                                               | Mostly done                                  | [RFC-0003](0003-opportunity-queue.md)           |
| C. AI SEO engineer                                                   | Missing                                      | [RFC-0004](0004-ai-seo-engineer.md)             |
| D. GitHub execution                                                  | Partial: one change type                     | [RFC-0005](0005-github-execution.md)            |
| E. Experiments and results                                           | Partial: Search Console only, manual refresh | [RFC-0006](0006-outcome-measurement.md)         |
| F. Portfolio operations                                              | Deferred by the brief                        | [RFC-0007](0007-portfolio-operations.md)        |
| 9. Automation and scheduling                                         | Missing                                      | [RFC-0008](0008-growth-automation.md)           |
| 10. Costs, limits and audit log                                      | Partial                                      | [RFC-0009](0009-spend-limits-and-audit-log.md)  |
| Prevention: SEO checks on pull requests (beyond the brief)           | Missing                                      | [RFC-0010](0010-seo-checks-in-ci.md)            |
| Controlled page-group split tests (beyond the brief)                 | Missing                                      | [RFC-0011](0011-page-group-split-tests.md)      |
| Beyond SEO: conversion optimization                                  | Missing                                      | [RFC-0012](0012-conversion-optimization.md)     |
| Beyond SEO: accessibility fixes in code                              | Missing                                      | [RFC-0013](0013-accessibility-fixes.md)         |
| Beyond SEO: web performance                                          | Missing                                      | [RFC-0014](0014-web-performance.md)             |
| Beyond SEO: release quality gate                                     | Missing                                      | [RFC-0015](0015-release-quality-gate.md)        |
| Beyond SEO: revenue attribution                                      | Missing                                      | [RFC-0016](0016-revenue-attribution.md)         |
| Beyond SEO: docs and support deflection                              | Missing                                      | [RFC-0017](0017-docs-and-support-deflection.md) |

## Order of work

Each step depends on the steps before it.

1. **RFC-0001, configuration blockers (B1 to B4, B6, B7).** No other user can complete the main workflow before this.
2. **RFC-0005, phase 1a.** Support route groups and metadata helper calls. Without it, Relay cannot change any page on test site S1.
3. **RFC-0004, phase 1.** Let the system find the file and draft the description. This closes the main acceptance-test gap.
4. **RFC-0001, B5.** Run the live acceptance on S1.
5. **RFC-0002, phase 1.** Add the low click-through rate and cannibalization detectors.
6. **RFC-0003.** Close the queue gaps.
7. **RFC-0005, phase 1b.** Add the title change, deployment signals, repository checks and revert proposals.
8. **RFC-0009.** Add spending limits and the audit log. Automation must not run before this.
9. **RFC-0008.** Add scheduled jobs on Trigger.dev.
10. **RFC-0010, phase 1.** Add SEO checks on pull requests. Install them on Relay and the monorepo first.
11. **RFC-0006.** Add GA4 outcomes and scheduled measurement.
12. **RFC-0011, phase 1.** Add page-group split tests, starting with the backtests on real data.
13. **RFC-0002, phases 2 and 3.** Add the remaining detectors.
14. **RFC-0005, phase 2.** Add the GitHub App and the remaining change types. Then RFC-0010 phase 2 (App mode).
15. **RFC-0007.** Start only when its entry criteria are met.

**Beyond SEO**, after the SEO core is live. Each one reuses the same loop: evidence, a reviewed pull request, a verified deploy and a measured result.

16. **RFC-0012, phase 1.** Conversion opportunities and copy changes. It reuses GA4, drafting, publishing and split tests.
17. **RFC-0013, phase 1.** Accessibility detection, clusters, and alt-text and language fixes.
18. **RFC-0015, phase 1.** Grow the SEO check into the release gate with the accessibility, links and security packs.
19. **RFC-0014.** Field data, causes, then performance fixes.
20. **RFC-0016.** Revenue attribution. Start with Relay's own billing.
21. **RFC-0017.** Docs signals, then support topics.

## Real-site test sites

Every RFC ends with a real-site acceptance test. Run it on these sites, not on fixtures.

| ID  | Site                      | Stack and repository                                                                                                                                                                                                                                                                                                                           | Use it for                                                                                                               |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| S1  | `playbookmedia.io`        | Next.js 16 App Router on Cloudflare (OpenNext). `PlaybookMediaLLC/monorepo`, root `apps/www`. Pages sit in the `(site)` route group and call `pageMetadata(title, description, path)`. The root layout sets a title template. GitHub deployments use the environment `production`. A staging copy runs at `www-staging.yoanyomba.workers.dev`. | Publishing, drafting, deployment signals, reverts, measurement plumbing.                                                 |
| S2  | `conduitt.io`             | Next.js marketing site. Confirm the repository before the test.                                                                                                                                                                                                                                                                                | Detection, drafting and measurement, when it meets the data floor.                                                       |
| S3  | `relay.playbookmedia.io`  | TanStack Start, not Next.js. `PlaybookMediaLLC/open-seo`. Search Console verified on 2026-10-15.                                                                                                                                                                                                                                               | Detection on a new site, site audits, automation, honest "not enough data" results, refusal of an unsupported framework. |
| S4  | Solomon AI marketing site | Next.js App Router with route groups and dynamic segments. `Oppulence-Engineering/oppulence-canvas`, root `apps/solomon-ai-marketing`. Confirm the domain before the test.                                                                                                                                                                     | Clean refusal of dynamic routes, and the file locator on a larger site.                                                  |

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
7. Never write to a customer repository, merge, deploy or revert without an explicit human approval.
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
