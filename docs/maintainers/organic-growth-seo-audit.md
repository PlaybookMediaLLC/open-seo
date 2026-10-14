# SEO and analytics capability audit

Audit date: October 14, 2026. This is a source-inspection inventory for planning an organic-growth opportunity workflow, not a production readiness certification.

## Evidence and status definitions

The code-review graph was attempted first and returned zero communities and edges. Source inspection was used as fallback. No live provider calls, runtime tests, or deployed workflow checks were performed. Existing test files were inspected, not executed. No feature qualifies as **Fully implemented/functioning** on this evidence alone.

- **Partial**: substantial implementation exists, but end-to-end functioning was not verified in this audit. This does not mean the feature is a stub.
- **Needs improvement**: implemented behavior has material limitations for autonomous opportunity detection.
- **Missing**: not found in the inspected implementation/schema surface. This is not proof that no related implementation exists elsewhere.

## Feature inventory

### Google Search Console: Partial

Implemented account/property OAuth binding, token refresh, search analytics dimensions and filters, pagination, URL inspection, current/previous-period totals and query/page striking-distance reporting.

Sources:

- `src/server/features/gsc/services/GscService.ts`
- `src/server/lib/gscClient.ts`
- `src/server/features/gsc/searchAnalytics.ts`
- `src/server/features/gsc/searchPerformanceReport.ts`
- `src/serverFunctions/searchPerformance.ts`
- `src/server/mcp/tools/search-console-tools.ts`

`GscService.getPerformance` supports internal request pages up to 25,000 rows. MCP responses cap at 1,000. The app striking-distance scan fetches 1,000 query/page rows and selects each query's best-ranking page when its position is 5 through 20. Query/page tables paginate separately. URL inspection captures per-URL failures but propagates token/grant failures.

Limitations: bounded result sets are not complete demand inventories. Missing rows are not necessarily zero traffic. Scheduled detection needs explicit dates, final-data selection, coverage metadata and request bounds.

### Google Analytics 4: Partial

Implemented organic overview/trend, landing pages, page performance, key events, acquisition, ecommerce, site search, audience breakdown and measurement health. Reporting includes timezone/date handling, quota and connection errors, restricted metrics, pagination and report metadata.

Sources:

- `src/server/features/ga4/services/Ga4ReportingService.ts`
- `src/server/features/ga4/services/Ga4ReportDefinitions.ts`
- `src/server/features/ga4/services/Ga4OrganicOverviewService.ts`
- `src/server/features/ga4/services/Ga4MeasurementHealthService.ts`
- `src/server/lib/ga4Client.ts`
- `src/serverFunctions/ga4.ts`
- `src/server/mcp/tools/google-analytics-tools.ts`

The dashboard exposes a narrower organic summary than the MCP report tools. Connected properties, meaningful key-event configuration and sufficient data remain prerequisites for business-value interpretation.

### Existing search opportunity scoring: Needs improvement

An opportunity detector already exists. Do not describe all opportunity detection as missing.

Sources:

- `src/server/features/ga4/services/SearchOpportunityService.ts`
- `src/server/features/ga4/services/SearchOpportunityService.test.ts`
- `src/server/mcp/tools/google-analytics-tools.ts`
- `src/server/mcp/server.ts`
- `src/server/features/sam/samChatTools.ts`

`get_search_opportunities` is registered and available to SAM. It joins GSC pages ranking in positions 4 through 20 with GA4 organic landing-page outcomes. The score combines demand (50%), business value (30%) and reachability (20%). Business value uses session key-event rate, falling back to engagement rate when all matched candidates have zero key events.

The default shared period spans 28 days and ends three days before the current GA4 property date. Results expose source properties, dates, match coverage, truncation and timezone/data-quality warnings.

Limitations:

- Both GSC and GA4 must be connected. Unmatched GSC rows remain visible but unscored.
- Only the first 1,000 rows from each source are considered. Output is capped at 100 candidates.
- Page-position filtering differs from the app's query-level best-page striking-distance rule.
- URL normalization removes query/fragment and trailing slash but does not resolve canonicals. Normalized GA4 key collisions overwrite rather than aggregate. This is a source-observed limitation to validate, not a reproduced production defect.
- Scores are relative heuristics, not predicted incremental conversions or causal evidence.
- The service returns a transient report, not a durable opportunity/review lifecycle.

### Keyword research: Partial

Implemented suggestions/ideas blending, related-keyword fallback, Google Ads fallback markets, local volume, keyword difficulty, CPC, intent, trends, SERP analysis and saved keyword tags/export/refresh.

Sources:

- `src/server/features/keywords/services/KeywordResearchService.ts`
- `src/server/features/keywords/services/research/research.ts`
- `src/server/features/keywords/services/research/research-data.ts`
- `src/server/features/keywords/services/research/serp.ts`
- `src/server/features/keywords/repositories/KeywordResearchRepository.ts`
- `src/server/mcp/tools/research-keywords.ts`

Research uses a Zod-validated, organization/project/market/parameter-scoped R2 cache with a 24-hour TTL. Empty cached rows are not reused. National metric persistence is best-effort. Local metrics are deliberately not stored as national metrics. Research can issue multiple paid calls, including fallbacks, so it should not be an implicit enrichment in a free detection run.

### Site audit: Partial

Implemented bounded crawling, page and multipage technical checks, Lighthouse strategy, optional JavaScript rendering, history/status/results, crawler credentials and durable workflow execution.

Sources:

- `src/server/features/audit/services/AuditService.ts`
- `src/server/features/audit/services/CrawlerCredentialService.ts`
- `src/server/workflows/SiteAuditWorkflow.ts`
- `src/server/lib/audit/page-analyzer.ts`
- `src/server/lib/audit/issues/multipage-checks.ts`
- `src/server/mcp/tools/site-audit-tools.ts`
- `src/shared/audit-limits.ts`

Page limits are 50 for free, 10,000 for paid and 1,000 for rendered audits. Organization-level capacity/concurrency checks and rendering credit holds exist. Rendering requires suitable deployment/provider configuration. An opportunity workflow should read existing audit evidence before considering a fresh crawl.

### Rank tracking: Partial

Implemented tracker configuration, keywords/devices/locations/depth, manual and scheduled checks, latest results, histories, position matrices, trends and live/queued collection paths.

Sources:

- `src/server/features/rank-tracking/services/RankTrackingService.ts`
- `src/server/features/rank-tracking/services/rankTrackingResults.ts`
- `src/server/features/rank-tracking/services/scheduledRankChecks.ts`
- `src/server/features/rank-tracking/services/rankCheckRunGuards.ts`
- `src/server/workflows/RankCheckWorkflow.ts`
- `src/server/mcp/tools/run-rank-tracker.ts`

Explicit runs accept an approved `maxCostCredits` ceiling, checked again in the workflow. Hosted access requires a paid plan. Active-run uniqueness and stale-run reconciliation protect duplicate starts. Existing result reads are distinct from paid refreshes.

### Backlinks: Partial

Implemented overview/history/new-lost trends, backlink rows, referring domains, top pages, target scopes, filters, spam controls and exports.

Sources:

- `src/server/features/backlinks/services/BacklinksService.ts`
- `src/server/features/backlinks/services/backlinksServiceData.ts`
- `src/server/features/backlinks/services/backlinksSubfolderOverview.ts`
- `src/server/mcp/tools/get-backlinks-overview.ts`
- `src/server/mcp/tools/get-backlinks-profile.ts`

Validated caches last six hours and are organization-scoped, including target scope/path/subdomain/filter parameters. Exact-URL history is unavailable. Other history remains subdomain-inclusive because the provider history endpoint does not support that filter. Fresh reads can incur costs when caches miss.

### AI visibility: Partial

Implemented prompt research/generation, trackers, manual/scheduled runs, answers/citations/owned-page views, matched-cell trends, exports and retention.

Sources:

- `src/server/features/ai-visibility/services/AiVisibilityService.ts`
- `src/server/features/ai-visibility/services/aiVisibilityRuns.ts`
- `src/server/features/ai-visibility/services/aiVisibilityCost.ts`
- `src/server/features/ai-visibility/services/aiVisibilityTrend.ts`
- `src/server/features/ai-visibility/services/aiVisibilityRetention.ts`
- `src/server/workflows/AiVisibilityWorkflow.ts`
- `src/server/mcp/tools/ai-visibility-tools.ts`
- `src/shared/ai-visibility.ts`

Engine types are ChatGPT, Gemini, Google AI Overviews, Claude and Perplexity. Claude/Perplexity use model APIs, which should not be equated with consumer search-product observations. Trend tools withhold movement claims for incomplete, scope-changed or insufficient-history comparisons. Explicit collection validates an approved `maxCostUsd`. Provider configuration and credits are required for new answers.

## Accounting, caching and budgets

`src/server/lib/dataforseo/client.ts` implements hosted provider accounting: reserve estimated credits before dispatch, refuse uncovered calls, settle actual envelope cost, account for billed failures and group holds for batches. `waitUntil` protects settlement work from client disconnect. Estimates come from `src/server/lib/dataforseo/pricing.ts`. Self-hosted mode skips OpenSEO credit billing, not provider costs.

`src/server/lib/r2-cache.ts` is a shared soft-TTL primitive, not proof that every provider call is cached. Callers must validate cached shapes and scope keys appropriately.

`src/server/billing/researchSpend.ts` is a separate post-settlement path for admitted research. It permits monthly overdraft, logs settlement failure and avoids replaying uncertain non-idempotent charges. Existing credit balances, estimates and per-run ceilings are not a universal per-project daily autonomous-agent spending budget.

## Security boundaries

`src/server/mcp/project-auth.ts` verifies project/org membership, rebinds user-scoped credentials to the project's organization and constructs project-scoped billing context. App entry points use `requireProjectContext` from `src/serverFunctions/middleware.ts`. Direct services assume their caller has performed authorization. Background detection must preserve equivalent context.

Google OAuth token encryption is enabled in `src/lib/auth-config.ts`; lifecycle implementation is in `src/server/features/google/googleOAuth.ts`. Report services select saved account/property bindings rather than arbitrary caller-supplied properties.

`src/server/lib/audit/url-policy.ts` blocks unsupported schemes, internal hostnames and private IP literals, and checks DNS for start URLs and initial redirect hops. DNS failures/no answers fail open, while discovered URLs use synchronous hostname/IP checks rather than per-link DNS resolution. These are review boundaries, not demonstrated exploits.

## Recommended first vertical slice

A GSC-only first version avoids requiring GA4 integration and supports useful project-specific candidates with no OpenSEO data credits:

1. Fetch bounded current query/page rows for striking-distance candidates through `GscService.getPerformance`.
2. Fetch bounded current and equal-length previous page rows for declining-page candidates.
3. Reuse `buildStrikingDistanceRows` and `previousPeriod` from `src/server/features/gsc/searchPerformanceReport.ts` where their semantics match the agreed contract.
4. Persist run/source/date/coverage metadata and stable evidence alongside deduplicated opportunities and review decisions.
5. For decline comparisons, absent rows in a bounded response are unknown, not zero. Compare observed pages in both windows, retaining truncation warnings. Do not silently merge canonical aliases.
6. Defer low-CTR claims until brand, position and SERP context can support a credible baseline.

Later enrichment can reuse `get_search_opportunities` and `get_google_analytics_measurement_health`. Existing `get_audit_issues`, `get_audit_pages`, `get_rank_tracker`, `get_ai_visibility_results` and `get_ai_visibility_trend` are candidate evidence readers. Fresh keyword/backlink/rank/AI collection should require explicit budget authorization and use established metering.

## Missing autonomous-growth capabilities in the inspected surface

The inspected existing opportunity service/schema surface did not provide durable normalized opportunity/evidence snapshots, dedupe/status/review lifecycle, scheduled cross-source detection, per-project daily detection budgets or intervention-to-baseline/outcome attribution. These are distinct from existing research tools and manual reports. This inventory describes the baseline before any new opportunity implementation undertaken from this audit.

## Validation boundary

Inspected tests include `src/server/features/ga4/services/SearchOpportunityService.test.ts`, `src/server/features/gsc/services/GscService.test.ts`, `src/server/features/ga4/services/Ga4ReportingService.test.ts` and `src/server/lib/dataforseo/client.test.ts`. The tests cover relevant scoring, date, property, quota and billing seams, but were not executed for this audit. Live credentials, connected project datasets, production provider responses and workflow bindings remain unverified.
