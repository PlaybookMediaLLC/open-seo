# Organic growth UI and agent integration audit

Scope: static repository inspection on October 14, 2026. No provider calls, runtime tests, or implementation changes were made during the audit. The code-review graph was queried first and explicitly reported an empty index. Source searches were used as fallback.

## Existing application patterns

### Routing and navigation

- `src/routes/_app/p/$projectId/route.tsx` owns the project subtree. It disables SSR, renders an Outlet, and checks project access through a React Query query. That check is redirect-only UX, not the authorization boundary. Every data call must authorize independently.
- `src/routes/_app/p/$projectId/reports/index.tsx` is the closest list-page template: route parameters, page header, query-state rendering, simple list, and confirmation-controlled mutations.
- `src/routes/_app/p/$projectId/reports/$reportId.tsx` is the closest detail-page template: route parameters, back link, loading skeleton, inaccessible/missing record handling, retry controls, and preservation of loaded data when a background refetch fails. NOT_FOUND replaces stale data rather than leaving inaccessible content visible.
- `src/client/navigation/items.ts` defines typed project links and grouped navigation. Add the opportunities entry there, rather than separately modifying desktop and mobile shells.
- URL-backed UI state uses `validateSearch` and Zod. This is suitable for status/type/priority filters and refreshable links.

### Components and server state

- `src/client/features/reports/ReportsList.tsx` demonstrates `TableCard`, table primitives, linked titles, `RowActionsMenu`, relative timestamps, and `EmptyState`.
- Reusable components: `src/client/components/PageHeader.tsx`, `QueryState.tsx`, `SkeletonPresets.tsx`, `ConfirmDialog.tsx`, `EmptyState.tsx`, and `RowActionsMenu.tsx`.
- UI primitives live in `src/client/components/ui/`. These are Base UI components. Compose a button with a link through `render`, using `nativeButton={false}` where appropriate, not Radix-style `asChild`.
- `src/client/features/reports/shared.tsx` centralizes project-scoped list/detail query keys and mutation hooks. Mutations invalidate lists and remove deleted detail cache entries. Confirmation controls expose pending state.
- `src/client/tanstack-db/queryClient.ts` defaults queries to five minutes of freshness and one hour of cache retention. Agent-written reports explicitly use `staleTime: 0`, so newly generated results are not hidden behind old cache data. Opportunity list/detail pages should make the same freshness decision explicitly.
- The global mutation cache displays errors through Sonner unless a mutation has its own `onError` or sets `meta.errorToast: false`. Avoid duplicate error toasts.
- `src/client/features/reports/ReportTemplateForm.tsx` demonstrates `useAppForm`, `revalidateLogic`, Zod validation, and React Query mutations for submitted forms.

## Server functions, authorization, and persistence

- `src/serverFunctions/reports.ts` and `src/serverFunctions/reportTemplates.ts` demonstrate `createServerFn({ method: "POST" }).middleware(requireProjectContext).validator(schema).handler(...)`.
- `src/middleware/ensureUser.ts` resolves authenticated request context. A top-level nonempty `projectId` in input triggers `ProjectRepository.getProjectForOrganization(projectId, context.organizationId)`. Inaccessible projects receive NOT_FOUND.
- `src/serverFunctions/middleware.ts` contains the global auth/error middleware composition and typed `requireProjectContext` narrowing. Handlers pass `context.projectId`, authenticated user ID, and authenticated organization ID to services. Actor identifiers must not come from model/client input.
- `src/server/features/reports/services/ReportService.ts` centralizes shared business rules. Services deliberately do not perform authorization, since each entry point authorizes first.
- `src/server/features/reports/repositories/ReportRepository.ts` demonstrates filtering every child read/write by both project ID and record ID, deterministic ordering, and selecting metadata without large document bodies.
- `src/serverFunctions/reportTemplates.ts` returns `{ ok: false, message }` for expected business refusals whose explanation the form must preserve. Serialized thrown errors otherwise lose detailed copy.
- The inspected report/template mutations enforce project membership but do not require an owner/admin reviewer role. An approval-specific role policy would need explicit new enforcement.
- Dual-dialect schema references: `src/db/reports.schema.ts`, `src/db/pg/reports.schema.ts`, `src/db/schema.ts`, `src/db/d1/schema.ts`, and `src/db/pg/schema.ts`. Repositories import provider-aware `db` from `@/db` and tables from `@/db/schema`. Schema parity tests guard drift between SQLite and Postgres.
- Opportunities, evidence, review decisions, and any future proposals should have explicit normalized relationships. Report HTML and project-context text are not an appropriate relational store.

## Existing opportunities and measurement

### Computed search opportunities

`src/server/features/ga4/services/SearchOpportunityService.ts` already implements discovery. It is exposed as `get_search_opportunities` in `src/server/mcp/tools/google-analytics-tools.ts`, registered in `src/server/mcp/server.ts`, and adapted for SAM in `src/server/features/sam/samChatTools.ts`.

The service:

- Requires connected project GSC and GA4 properties.
- Joins GSC page rows ranking in positions 4 through 20 with GA4 organic landing-page outcomes.
- Scores matched rows using demand, business value, and reachability with weights 50%, 30%, and 20%.
- Uses engagement as a fallback when joined rows contain no key events.
- Leaves unmatched rows visible and unscored.
- Returns coverage, truncation, scoring rationale, quality metadata, and timezone caveats.

This is computed research data, not persisted opportunity records or a review queue. No existing application server-function wrapper for this service was found. Its score is comparative research prioritization, not a verified causal outcome forecast.

### Measurement inputs

Reusable implementations include:

- `src/server/features/ga4/services/Ga4ReportingService.ts`
- `src/server/features/ga4/services/Ga4OrganicOverviewService.ts`
- `src/server/features/ga4/services/Ga4MeasurementHealthService.ts`
- `src/server/features/gsc/services/GscService.ts`
- `src/server/features/gsc/searchPerformanceReport.ts`
- `src/serverFunctions/searchPerformance.ts`
- `src/server/mcp/tools/google-analytics-tools.ts`
- `src/server/mcp/tools/search-console-tools.ts`
- `src/server/features/ai-visibility/services/aiVisibilityTrend.ts`
- `src/server/features/ai-visibility/services/aiVisibilityResults.ts`

GSC Insights already provides striking-distance research and period comparisons. Rank tracking and AI visibility provide repeated observations. None of these establish experiment assignment, causal attribution, or a proposal-to-outcome lifecycle.

## Existing execution and approval boundaries

Domain-specific background execution exists in:

- `src/server/workflows/RankCheckWorkflow.ts`
- `src/server/workflows/AiVisibilityWorkflow.ts`
- `src/server/workflows/SiteAuditWorkflow.ts`

Spend-estimate and ceiling contracts exist in:

- `src/server/mcp/tools/add-rank-tracking-keywords.ts`
- `src/server/mcp/tools/estimate-rank-tracker-cost.ts`
- `src/server/mcp/tools/ai-visibility-tools.ts`
- `src/server/features/rank-tracking/services/RankTrackingKeywordService.ts`
- `src/shared/rank-tracking.ts`

These are paid research/tracking safeguards, not a general persistent human approval system. Some scheduled-tracking approvals acknowledge estimated recurring cost rather than imposing an absolute runtime spending cap.

The source audit found no application growth queue, durable proposal approval lifecycle, GitHub repository/content publisher, or A/B experiment assignment/results system. GitHub references were support/documentation links and contributor-oriented skill references. Existing report sharing is publication of a report, not publication to a customer website or GitHub repository.

## MCP and SAM extension seams

- `src/server/mcp/project-auth.ts`: `withMcpProjectAuth` authorizes user-scoped tokens through membership in the project's organization and rebinds billing context. Organization-scoped credentials are checked against that organization. Every new project tool should reuse this gate.
- `src/server/mcp/server.ts`: explicit MCP tool registration.
- `src/server/features/sam/samChatTools.ts`: adapts the same MCP definitions and handlers into AI SDK tools, preserving instrumentation and authorization. Project ID is removed from model-visible inputs and injected from the server-side SAM session. New tools need an explicit SAM mapping, not just MCP registration.
- `src/server/mcp/tools/report-tools.ts`: saved report CRUD and attribution patterns. Reports have no version history and are not suitable as mutable approved proposal records.
- `src/server/mcp/tools/project-context.ts` and `src/server/features/project-context/`: durable shared business context and research log, useful as discovery context rather than workflow state.
- `src/server/features/sam/samSkills.ts`: bundles public `.agents/skills/*/SKILL.md`, excluding internal skills and the `simple-issue-description` and `seo-report` skills. SAM currently has no report tools. Its surface note redirects report-delivery instructions into chat. Do not assume all external MCP capabilities are already available to SAM.

## Relevant shipped skills

Canonical skill files and plugin counterparts exist for:

- `.agents/skills/seo-audit/SKILL.md`
- `.agents/skills/ai-visibility-audit/SKILL.md`
- `.agents/skills/keyword-research/SKILL.md`
- `.agents/skills/keyword-clustering/SKILL.md`
- `.agents/skills/competitive-landscape/SKILL.md`
- `.agents/skills/competitor-analysis/SKILL.md`
- `.agents/skills/link-prospecting/SKILL.md`
- `.agents/skills/ai-prompt-research/SKILL.md`
- `.agents/skills/seo-project-setup/SKILL.md`
- `.agents/skills/seo-report/SKILL.md`

Plugin copies are under `plugins/openseo/skills/`.

`seo-audit` investigates a shortlist and produces one to three leading recommendations, then saves a report and durable context/research-log updates. `keyword-research` requires explicit confirmation before saving keywords. `ai-visibility-audit` specifies cost estimates and approval before paid checks. These are agent instructions, not stored approval or execution records.

The globally advertised `marketing-loops` and `ab-testing` skills do not have corresponding local repository folders. Their external contents were not inspected.

## Minimal opportunities review integration

Proposed new files, not existing implementations:

- `src/routes/_app/p/$projectId/opportunities/index.tsx`
- `src/routes/_app/p/$projectId/opportunities/$opportunityId.tsx`
- `src/client/features/opportunities/OpportunitiesList.tsx`
- `src/client/features/opportunities/shared.tsx`
- `src/serverFunctions/opportunities.ts`
- `src/server/features/opportunities/services/OpportunityService.ts`
- `src/server/features/opportunities/repositories/OpportunityRepository.ts`
- `src/types/schemas/opportunities.ts`
- Corresponding SQLite/Postgres schema definitions, migrations, and barrel integration.

The first surface can stay bounded to a project-scoped list/detail, URL-backed status/type/priority filters, explicit detection trigger, evidence and score rationale, and Reviewed/Approved/Rejected/defer actions. Reuse report query/error/confirmation patterns and add a single project navigation entry.

Important boundaries:

1. List/detail loading reads stored state rather than silently starting paid research.
2. Detection is an explicit mutation with pending/error feedback and list invalidation.
3. Review decisions use server-authenticated actors and explicit transitions.
4. Approval is separate from execution. No approval button should imply publishing is enabled or code changes have been verified.
5. If mutable proposals are later introduced, approvals must bind to the reviewed revision so edited content cannot inherit an old approval.
6. Evidence retains source/date/quality and scoring rationale rather than displaying a score without qualifications.
7. GitHub publishing and experiments remain separate future capabilities.
8. Agent creation/review tools require explicit MCP registration and optional SAM mapping. Adding a shipped MCP tool triggers the repository's plugin-version policy.

## Validation and remaining decisions

Validation consisted of graph-first discovery, static source inspection, targeted searches across routes, server functions, services, schemas, MCP tools, and local skills. `git status --short` was clean at audit completion. No test suite, browser, provider API, or runtime execution was used.

Before implementing the frontend, establish the exact list/detail/filter/detection/review contracts and whether approval permissions are ordinary project membership or a restricted role. Frontend work remains blocked on those contracts rather than inventing backend semantics.
