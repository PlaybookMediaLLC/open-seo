# Product Reality Engine — implementation handoff and exact work packages

> **Implementation order:** [IRFC-0001–0033](implementation/README.md) supersedes the older numerical handoff order below. Its files point to canonical RFCs and define the actionable phase and exit gate.

**Status:** Suggested engineering plan, not executed.  
**Base repository:** `PlaybookMediaLLC/relay`, branch `develop` at the time of review.  
**Do not modify** prior RFCs 0001–0028 as a side effect of copying these draft files into the repository. The current RFC index may be updated in a separate reviewable PR.

## 0. Numbered sequence and actual first dependency

Existing Protect RFCs 0019/0025/0026/0027/0028 remain the **first active delivery path**. The new proposal order is: **0029 paid evidence → 0030 architecture → 0031 governance → 0032 connectors → 0033 intake → 0034 facts → 0035 assets/claims → 0036 impacts → 0037 work → 0038 verification → 0039 workbench → 0040 Sync → 0041 API/MCP → 0042 Launch → 0043–0046 demand-led expansions**.

Implementation PRs are intentionally **smaller than full RFC completion**. In particular, a manual change and a read-only fact view can be delivered without integrating every paid source or building every table in RFCs 0030–0036. See [numbered implementation backlog](PRODUCT-REALITY-RFC-INDEX.md) for the current delivery gate.

## 1. Workstream boundaries

| Workstream          | Suggested code locations                                                                                                | Required existing seams                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Change ingestion    | `src/server/features/reality/ingestion/`, `src/server/features/reality/repositories/`, `src/serverFunctions/reality.ts` | `src/server/features/growth/`, GitHub transport from publishing, existing audit      |
| Facts and authority | `src/server/features/reality/facts/`, `src/types/schemas/realityFacts.ts`                                               | `src/db/schema.ts`, `src/db/pg`, `src/db/runBatch.ts`, company-owned source policies |
| Assets/claims       | `src/server/features/reality/assets/`, `src/client/features/reality/`                                                   | `src/server/features/docs/docsIndex.ts`, publishing file/MDX parser                  |
| Impact detector     | `src/server/features/reality/impacts/`                                                                                  | canonical typed facts/asset refs, existing opportunities view patterns               |
| Work/verification   | `src/server/features/reality/work/`, `.../verification/`                                                                | `MetadataExecutionService`, publishing approval/recovery, RFC-0028 verification      |
| User experience     | `src/routes/_app/p/$projectId/changes/`, `src/client/features/reality/`                                                 | project navigation, ThisWeek, opportunity detail, billing/activity views             |
| API/MCP             | `src/routes/api/v1/` only when needed, `src/server/mcp/tools/reality-tools.ts`                                          | `withMcpProjectAuth`, input/output schemas, rate/spend guards                        |
| Schema              | `src/db/reality-*.schema.ts` and `src/db/pg/reality-*.schema.ts`                                                        | schema/provider exports, both migration directories, parity tests                    |

**Important:** these paths are proposed namespaces, not files observed in the repository. Begin implementation by inspecting current `develop` and naming conventions. Existing RFC-0019/0026–0028 work may be advancing independently; do not overwrite or reimplement those services. Avoid unnecessarily coupling a broad engine migration to the current Protect commercial pilot.

## 2. First implementation PR — minimal RFC-0030–0035 model and a read-only manual change

**Goal:** store a manually reviewed product change with concrete source proof, create one normalized accepted fact and link it to one affected asset; no external writes, no AI requirement.

- Add a small subset of reality schema with project-scoped `sources`, `ingest_events`, `observations`, `changes`, typed `facts` and `fact_evidence` as needed; resist generating all future tables at once.
- Implement service with `getProjectForOrganization`, correct `requireProjectContext`, CAS guards, bounded Zod inputs and explicit error codes.
- Add `manual_source` that requires an authorized product owner and a human-entered attestation; it cannot claim runtime deployment.
- Fetch list/detail through a read-only server function with pagination. Use a minimal Changes view from 0039 or existing project view.
- Add dual D1/PG migration, real SQL tests, per-project ownership tests, erasure and negative permission tests.
- Acceptance fixture: feature fact changes only for Enterprise US after a future effective date; before that date it is a planned change, not live public availability.

**Exit:** one read-only end-to-end source → change → scoped fact → evidence timeline works reliably without creating any PR or charging paid research credits.

## 3. Second implementation PR — RFC-0033 GitHub observation with durable idempotency

- Wrap existing GitHub read transport to observe changed allowlisted paths/release metadata; no new GitHub OAuth flow.
- Persist immutable external revision, checksums and source branch/environment provenance.
- Add signed-webhook handling only if using existing GitHub App permissions; otherwise ship bounded polling first.
- Deduplicate replays and delayed events; do not turn every commit into an accepted business fact.
- Add cursor health and error reporting, per-run requests/bytes/time caps and cancel-on-revocation behavior.

**Exit:** replay ten overlapping delivery/poll fixtures with one logical change; a merged but not deployed commit remains unproven in production.

## 4. Third implementation PR — RFC-0034–0036 narrow Sync claim evidence

- Index only selected Git-backed `.md`/`.mdx` and simple pricing asset patterns; reuse existing docs AST parsing and 0017 file-read limits.
- Extract exact claim spans and typed candidate price/integration assertions with scope; refuse ambiguous claims.
- Compare one accepted scoped fact to one claim, with original proof and scope overlap explanation; no wide semantic graph.
- Provide reviewer approve/dismiss/conflict workflow. Dismissals are versioned and have reason/expiry.

**Exit:** one contradiction flagged, one grandfathered/audience-specific noncontradiction correctly ignored, and one unknown-scope candidate shown for review. False **confirmed** contradictions on seed fixtures must be zero.

## 5. Fourth implementation PR — RFC-0037–0038 reviewed correction, no new write privilege

- Turn a confirmed, accepted fact-backed impact into a typed work item.
- Reuse RFC-0017 safe Markdown/MDX proposal for supported edits or a typed RFC-0027 compatible publishing evidence variant.
- Require exact-diff review and customer-owned merge and deployment. Revalidate source/fact/evidence SHA before PR creation.
- Block if no actual source/URL mapping, or if fact/claim scope is unknown.
- Verify the production article independently after deployment (0038), marking unknown when provenance cannot be established.

**Exit:** a consenting owner approves one exact correction; same project runs deployed-content verification. Tests cover changed SHA, revoked membership, stale fact, unsupported MDX and external customer fix.

## 6. Protect and future tracks

After the above minimal shared services, integrate existing Protect monitoring incidents **without** changing its established RFC-0028 truth conditions. Only build browser journey checks (0043) after real buyers request and can safely configure test paths. Manual launch packets (0042) can use the same fact/change/work IDs after a paying pilot, with outbound delivery disabled until separate signoff.

Do not sequence RFC-0045/0046 activation and enterprise-facing enablement connectors into first-product readiness. They are architecture-informed opportunities, not a mandatory implementation backlog.

## 7. Required test matrix for every slice

| Layer             | Tests                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| DB and migrations | SQLite+PG real-SQL queries, schema parity, FK cascade, uniqueness, broken migration rollback, idempotent retries |
| Authorization     | user/member/editor, other org, revoked user, disconnected connector, background job and MCP authentication       |
| Evidence          | out-of-order events, unknown runtime deployment, expired/contradicted fact, scope and timezone windows           |
| Work              | immutable diff, changed blob SHA, source revocation, approval expiry, one external write despite retry           |
| Fetch/security    | bad signature, URL SSRF, redirects, oversized payload, prompt injection, provider 429 and timeout                |
| UX                | exact cited evidence, stale/degraded/unknown labels, keyboard review, changed evidence before approval           |
| Costs/ops         | budget exhaustion, retries, provider settlement accounting, coverage freshness, erase pending blobs              |

No live customer writes, GitHub PRs, deployments, paid provider requests, or test-message sends are performed merely by writing these RFCs.

## 8. Design-review ownership

- **Founder/product:** confirm actual customer job and commercial gate for each wave.
- **Platform:** prove tenant isolation, source-version identity, error taxonomy, SQL compatibility and cost enforcement.
- **Security/privacy:** inspect connector scopes, prompt injection, source egress, support/CRM retention, external action approvals.
- **Domain owner:** confirm exact predicates, scope calculus, output constraints and acceptable false-positive behavior.
- **UX:** validate reviewer understanding, source citations, incident and health states.
- **Independent reviewer:** challenge whether a simpler manual/service workflow can validate demand before a new platform layer.

Require an RFC design-review note per change area before PR implementation, and attach test evidence on merge. Closed engineering tests do not imply customer adoption.
