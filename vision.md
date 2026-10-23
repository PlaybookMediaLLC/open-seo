# Relay — vision and path to the north star

**Updated:** October 23, 2026

Relay becomes the ongoing organic growth operations system for software businesses: identify what matters, get an approved change implemented, establish what happened in production, and preserve that knowledge for the next decision.

The initial promise is website release assurance for developer-led B2B SaaS teams. A customer connects a GitHub-managed Next.js marketing site, chooses important pages, and receives evidence of harmful changes, reviewable repairs, and verified resolutions through its existing release process. The commercial rationale and validation thresholds are in [company.md](company.md).

## The north-star experience

An owner can open Relay at any time and answer:

- Which important pages are protected, and when were they last checked successfully?
- What changed, what failed, and how certain are we about the cause?
- What exact correction is proposed, and what needs a person's decision?
- Has the approved correction reached production and resolved the original problem?
- What do subsequent search and conversion observations show, and what remains inconclusive?
- What should happen next, given the site's previous decisions and results?

The loop is **connect → baseline → detect → investigate → prepare → approve → verify production → observe outcomes → retain context**. A quiet week, an unsupported repair, or insufficient data is an explicit result.

## What exists and what is missing

The [October 23 codebase audit](docs/maintainers/relay-release-assurance-audit.md) finds substantial working foundations: research and audits, first-party analytics, opportunities, exact-change publishing, deployment signals, measurement, CI checks, and a weekly work view.

The repository does not yet implement the complete release-assurance loop. It lacks a durable production baseline and regression lifecycle, a repair path independent of Search Console opportunity records, general verification of the original failure, and a validated protected-site service. Customer previews are checked today, but proposal-bound preview orchestration is still planned. Basic cooldown and negative-result filters already exist; persistent page history and learning remain incomplete.

## Incremental delivery

RFC numbers are stable identifiers. The [RFC index](docs/maintainers/rfcs/README.md) defines delivery order and dependencies; numeric order is not priority.

| Stage                          | Customer value                                                                             | Work                                                          | Exit evidence                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Qualify a paid pilot        | An agreed problem, protected scope, owner, and price                                       | RFC-0026 phase A; relevant open RFC-0001/0007/0009 follow-ups | Three paid pilot commitments; production identity and permission/readiness checks recorded. No claim of automatic protection before activation.           |
| 1. Observe production reliably | Confirmed regressions on agreed pages, with honest coverage and actionable tickets         | RFC-0019 phases 1a–1b; reuse RFC-0008/0010/0015               | Known-good snapshots, confirmation and deduplication, visible failed/stale runs, and reviewed alert quality on authorized sites.                          |
| 2. Complete a reviewed repair  | A proven source edit, checks for that commit, and a resolved production failure            | RFC-0027 → RFC-0025 phase 1a → RFC-0028; RFC-0019 phase 1c    | Two approved, deployed, verified repairs across separate customer organizations. Merge alone never counts as resolution.                                  |
| 3. Deliver a recurring service | Clear weekly work and coverage, reliable operations, and a defensible renewal decision     | RFC-0018 reporting integration; RFC-0026 phase B              | A four-week operational record, measured service costs, actual payment and renewal evidence where due. Target 8–10 paying sites in the validation period. |
| 4. Improve existing pages      | Limited, measurable growth work informed by past outcomes                                  | RFC-0024, then RFC-0020; reuse RFC-0006/0012/0016 as eligible | Repeat paid demand for protection, adequate data, customer-approved campaigns, and honest positive, negative, or inconclusive outcomes.                   |
| 5. Expand from proven demand   | Facts-backed pages, launches, competitor responses, portfolios, optional delegated actions | RFC-0021/0023/0022/0007; later RFC-0018 and RFC-0025 phases   | Explicit customer demand, supported adapters, trustworthy verification, bounded costs, and a reviewed permission model for each expansion.                |

Discovery can run alongside engineering. Each engineering increment must be independently useful: a detection-and-ticket pilot does not need automatic repair; a reviewed repair does not need standing approvals; a customer-hosted preview does not need a Relay build platform.

## Product principles

**Production evidence is authoritative about observed behavior.** Keep production observations, source commits, suspected causes, approvals, previews, deployments, and outcomes linked but distinct. A fetched page does not prove which commit produced it. A successful deployment event does not prove a rule passed.

**Repairs must be narrow and explainable.** Restore a source literal only when it can be mapped to the observed behavior. Inherited title templates, metadata helpers, headers, dynamic routes, and rewrites require explicit handling or a ticket. Never paste a rendered title back into source without understanding its transformation.

**Authority remains explicit.** The initial service requires a person to approve the exact repository change and merge it. Customer CI, branch protection, deployment, and rollback remain in force. Agents can investigate and draft within their existing permissions. Limited standing approvals may be evaluated after paid validation; unrestricted autonomous publishing is outside the vision.

**Protection and growth have different evidence clocks.** Technical repair verification follows production deployment. Search and conversion measurement waits for complete, sufficient observations. An existing low-traffic page can still suffer a real indexing regression. It cannot support an invented traffic or revenue impact estimate.

**Reuse the foundation.** Retain upstream attribution, core integrations, tenant checks, dual SQLite/Postgres support, exact-change approval, spend controls, and audit records. Add the missing connections rather than rebuilding the SEO platform.

**Bound the service.** Every plan states its monitored set, cadence, limits, and support expectations. Exhausted research credits must not silently disable included basic checks; an inactive plan, exhausted operational budget, revoked connection, or failed run must show lost coverage and a next step.

**Learn from completed work.** Preserve failed experiments and customer decisions as well as successful repairs. Counts and before/after comparisons should remain descriptive unless a suitable experimental design supports causal attribution.

## Measuring the north star

The primary product metric to validate is **weekly active protected paying websites**: a paying website with an agreed monitored set, successful checks within its promised cadence, and a current coverage/work report. Count each website once per week. Failed or overdue coverage does not qualify merely because a schedule is enabled. Define the operational events and exclusions in RFC-0026 before treating this as a dashboard metric.

Pair it with production-verified resolutions, actionable-alert precision, missed seeded regressions, time from detection to resolution, review time, and renewal. Guard against false alerts, stale coverage, unsafe writes, unsupported repairs, and poor gross margin. Quiet weeks qualify through observed protection, not a quota of generated work.

Long-term growth value also includes approved improvements that reach production and receive a completed measurement or an explicit insufficient-data outcome. That is accountable work; it is not a guarantee of ranking or revenue growth.
