# RFC-0007: Portfolio operations

- **Status:** Section 4 done on 2026-10-17 (PR #83). Section 6 implemented on 2026-10-27 at the owner's request, before an entry criterion in section 5 was recorded as met. Real-site acceptance (section 9) and live acceptance of section 6 are pending. The owner decided on 2026-10-17 that the follow-ups in section 11 do not block closing this RFC.
- **Date:** 2026-10-15
- **Brief section:** 8 (Feature F)
- **Depends on:** RFC-0001 to RFC-0006 in production, and the entry criteria in section 5.

## Current delivery role — October 23, 2026

Isolation is a stage-0 prerequisite. Portfolio product work remains stage 5 for commercial validation; single-site paid validation comes first. On 2026-10-27 the owner chose to build section 6 ahead of the entry criteria, so the code exists, but it does not count as evidence that any criterion was met.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

The brief asks for project isolation now, and portfolio features later. Project isolation exists. This RFC records what exists, the one isolation task to do now, the conditions to start portfolio work, and a first design sketch so later work starts from agreed boundaries.

## 2. What exists today

| Part                    | Location                                                                                       | Behavior                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations and roles | `docs/maintainers/specs/0011-multi-user-organizations.md`, `src/lib/org-permissions.ts`        | Owner, admin and member roles. `billing:manage` is owner only. `project:create/delete` and `integration:manage` are owner and admin. Every invitee is an admin. Since 2026-10-27, `publishing:approve` is owner and approver (section 6.4). |
| Project scoping         | `docs/maintainers/specs/0001-project-scoping-for-server-functions.md`, `requireProjectContext` | Server functions resolve the project inside the caller's organization.                                                                                                                                                                      |
| Growth data             | Opportunities, publishing and experiment tables                                                | Every row carries `project_id`. Services check the organization first.                                                                                                                                                                      |
| Reports and sharing     | Specs 0012 to 0014                                                                             | Dynamic reports, templates and public share links per project.                                                                                                                                                                              |
| Website dashboard       | Spec 0015                                                                                      | One dashboard per project.                                                                                                                                                                                                                  |

## 3. Decision

Do not build portfolio summaries, cross-site comparisons, site budgets, agency client spaces, white-label reports or delegated execution authority now.

**Reason:** the brief puts the first complete customer workflow first. No current user runs more than a few projects. Building administration before the workflow works adds risk and slows the core work.

**Update, 2026-10-27:** the owner reversed this decision and asked for section 6 to be built. Section 6 records what was built. The design record is [Portfolio operations](../specs/portfolio-operations.md).

## 4. Work to do now

One task: prove isolation with one automated suite.

1. Add `src/server/features/growth/tenancy.test.ts` (fork-owned).
2. Create two organizations, each with one project, in the real-SQL test database (D1 and Postgres).
3. For every growth service read and write (opportunities, decisions, proposals, drafts, executions, experiments, measurements, schedules, notifications), call it with organization A's context and project B's id.
4. Assert `NOT_FOUND` for reads and no row change for writes.
5. Add a check that fails when a new growth table lacks `project_id`. Read the table list from the Drizzle schema objects.

As built: `src/server/features/growth/tenancy.test.ts` calls every exported function of the 18 growth services with organization A's context and organization B's ids. It expects "not found" from each, and no change in the row count of any growth table. A coverage check fails when a growth service gains a function that the suite does not call. Two functions have no project boundary of their own and are left out: the GitHub App setup callback, which is signed, and the brand-term store, whose entry points authorize. Schedules and notifications do not exist yet; RFC-0008 adds their services to the suite. The only growth table without `project_id` is `github_app_installations`, which is organization-level by design.

## 5. Entry criteria to start portfolio work

Start when any one of these is true:

1. Five paying organizations each run 3 or more projects.
2. An agency customer signs a contract that requires client separation.
3. Support requests for cross-project views reach 5 in one month.

## 6. Design sketch, and what was built

These were boundaries, not a final design. Each item ends with what was built on 2026-10-27.

1. **Portfolio summary.** One read-only page per organization. It aggregates existing per-project tables with grouped queries: open opportunities by type and status, experiments by label, spend by project (RFC-0009 ledger). No new data copies.
   - As built: the **Portfolio** page (`/portfolio`, linked from the project switcher). One row per active project: open opportunities by status and type (completed, rejected and reverted count as closed), experiments by the experiments page's label rule, and committed credits and limit from the same query as the spending card. Every member can read it.
2. **Cross-site comparison.** Compare Search Console totals per project for the same dates. Reuse the stored measurement days and the dashboard cache. Do not make new provider calls for the comparison page.
   - As built: clicks and impressions come from the dashboard's stored 28-day query rows, read under the dashboard's own cache key with a read that never loads. A project with no stored rows says so instead of showing zero. A project whose stored window ends before the newest one is marked "Other dates". Measurement days cover only experiment pages, so they feed the experiment labels, not the site totals.
3. **Site budgets.** Already covered by RFC-0009 project limits.
   - As built: verified existing. The portfolio shows each project's limit and links to the Billing page that sets it.
4. **Approval roles.** Today every invitee is an admin and can approve pull requests. Add a separate `publishing:approve` statement. Give it to owners by default. Let owners grant it per member. Keep `integration:manage` for connecting accounts.
   - As built: `publishing:approve` belongs to owners and to the new `approver` role, which an owner adds to a member's role from organization settings. Better Auth's role endpoint may not add or remove it. Executing a proposal, opening a split-test pull request and ending a split test need it as well as `integration:manage`. A migration gave existing admins the approver role, so nobody lost an ability, and Every App gateway admins keep it because the gateway owns the team.
5. **Delegated execution authority.** A per-project setting that lists who may approve repository writes. Store it in a normalized table (`project_publishing_approvers`), not in JSON.
   - As built: `project_publishing_approvers` (project, member). When a project lists members, only they and the owners approve its pull requests. Only owners edit the list, only members who manage integrations can be listed, and removing a member removes their rows. The service is in the tenancy suite.
6. **Agency client spaces.** Use one organization per client. Add an "agency" link table between an agency organization and client organizations, with explicit, revocable grants. Do not mix client projects in one organization.
   - As built: `agency_client_links`. The agency's owner asks for a client organization they belong to, the client's owner accepts, and either owner ends it. While it is accepted, the agency's Portfolio page shows the client's summary in its own section, and nothing else. Every step is in both organizations' activity logs.
7. **White-label reports.** Extend the existing report templates and share links with a logo and a brand color per organization. Remove the Relay mark from shared report pages only for paid plans.
   - As built: `organization_branding` holds a color and a PNG or JPEG logo of at most 48 KB, checked on save and on read. Shared pages and their link previews show the brand; `list_report_templates` returns the color for the report accent. The Relay mark comes off only for a branded organization whose synced billing status is paying, or on a self-hosted deployment, which has no plans.

## 7. Alternatives considered

1. **Build the portfolio page now from the existing tables.** Rejected on 2026-10-15 because it adds UI to maintain before the workflow it summarizes is proven. Built on 2026-10-27 at the owner's request.
2. **Folders of projects inside one organization for agencies.** Rejected. It weakens client separation and billing boundaries.
3. **Live Search Console calls for the comparison page.** Rejected. One page load would cost one provider call per project.

## 8. Ready-for-other-users checklist

Only section 4 applies now.

- [x] `tenancy.test.ts` covers every growth service read and write.
- [x] The suite runs on D1 and Postgres in CI. It runs on SQLite in CI and passed on Postgres locally on 2026-10-17. A Postgres job in CI changes `.github/**`, which needs the maintainer's review. Done 2026-10-18: PR #84 added the Postgres job; it passed 729 tests on its first run.
- [x] The schema check fails for a growth table without `project_id` (prove it with a temporary failing case, then remove it).
- [ ] This RFC is reviewed again when an entry criterion is met.
- [x] Section 6 has behavior tests on SQLite and Postgres: approval rules and the role-endpoint guard, the approver list, the portfolio summary and comparison, agency links, and white-label share pages. The approver service is in the tenancy suite.
- [ ] Section 6 is accepted on a real site (see section 9).

## 9. Real-site acceptance test

**Site:** production `relay.playbookmedia.io`, with two real Google accounts in two organizations. Each organization has one project (S1 and S3).

**Steps:**

1. As organization A, copy the URLs of one opportunity, one proposal and one experiment.
2. As organization B, open each URL.
3. As organization B, call `get_opportunity` and `list_opportunities` from an MCP client with organization A's project id.
4. Section 6: as an admin of organization A without approval, try to approve a pull request; as A's owner, list that admin as a project approver and try again. Open the Portfolio page of A and B. Ask for agency access from A to an organization the tester belongs to, check that the Portfolio page shows it only after its owner accepts, then end it. Share a report from a branded organization on a paid plan and on the free plan.

**Pass when:**

- Every page and tool call returns "not found". No data from organization A appears in any response.
- The unlisted admin is refused, the listed admin can approve, and the portfolio shows a client only while its link is accepted. The paid shared report has no Relay mark; the free one keeps it.

**Value check:** customers can trust that their search data, repositories and results stay in their own workspace.

## 10. Completion criteria

- The tenancy suite covers 100% of growth service functions. A count of exported service functions equals the count of tested ones.
- Manual checks find no cross-organization data in the UI, server functions, MCP tools, CSV exports, notifications or share links.
- The schema guard fails on a temporary growth table without `project_id`, then passes after its removal.

## 11. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [x] The tenancy suite runs on Postgres in CI. Trigger: the maintainer reviews and merges PR #84, which adds a fork-owned Postgres workflow. Done 2026-10-18 (PR #84).
- [ ] Real-site acceptance (section 9) with two real Google accounts in two organizations. Trigger: a second organization exists with its own project. The invitation to the second account is still pending.
- [x] Schedules and notifications join the suite. Trigger: RFC-0008 adds their services. The schedule service joined the suite (PR #88). Notifications belong to an organization, and their own test proves that one organization never sees another's (PR #87).
- [ ] Review this RFC again. Trigger: one entry criterion in section 5 is met.
- [ ] Live acceptance of section 6 (section 9, step 4). Trigger: the deployment carrying it, with a second organization and a paid organization to test with.
- [ ] Run the two-account MCP isolation suite with the growth tools it now calls (`pnpm test:e2e:mcp-isolation`). Trigger: a hosted test environment with sign-up configured.

Evidence for the completion criteria that code can show:

- **Coverage:** the suite calls every exported function of the 18 growth services, and a coverage check fails when a service gains a function that the suite does not call.
- **Isolation:** every call from another organization answers "not found", and no growth table changes, on SQLite (CI) and Postgres (local run, 2026-10-17).
- **Schema guard:** the check failed on a temporary growth table without `project_id`, and passed after its removal. A temporary service without its authorization call also failed the suite.
- **Section 6:** the approver service joined the tenancy suite. The portfolio reads another organization's projects only through an accepted agency link, and a test proves the client's section appears only while the link is accepted. Shared pages and link previews rebuild their branding from validated values on every request. The MCP isolation matrix now includes `list_opportunities`, `get_opportunity`, `get_opportunity_ticket` and `get_experiment_results`.
