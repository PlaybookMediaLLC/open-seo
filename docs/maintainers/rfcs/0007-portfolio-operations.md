# RFC-0007: Portfolio operations (deferred)

- **Status:** Draft. Deferred by decision.
- **Date:** 2026-10-15
- **Brief section:** 8 (Feature F)
- **Depends on:** RFC-0001 to RFC-0006 in production, and the entry criteria in section 5.

## 1. Summary

The brief asks for project isolation now, and portfolio features later. Project isolation exists. This RFC records what exists, the one isolation task to do now, the conditions to start portfolio work, and a first design sketch so later work starts from agreed boundaries.

## 2. What exists today

| Part                    | Location                                                                                       | Behavior                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations and roles | `docs/maintainers/specs/0011-multi-user-organizations.md`, `src/lib/org-permissions.ts`        | Owner, admin and member roles. `billing:manage` is owner only. `project:create/delete` and `integration:manage` are owner and admin. Every invitee is an admin. |
| Project scoping         | `docs/maintainers/specs/0001-project-scoping-for-server-functions.md`, `requireProjectContext` | Server functions resolve the project inside the caller's organization.                                                                                          |
| Growth data             | Opportunities, publishing and experiment tables                                                | Every row carries `project_id`. Services check the organization first.                                                                                          |
| Reports and sharing     | Specs 0012 to 0014                                                                             | Dynamic reports, templates and public share links per project.                                                                                                  |
| Website dashboard       | Spec 0015                                                                                      | One dashboard per project.                                                                                                                                      |

## 3. Decision

Do not build portfolio summaries, cross-site comparisons, site budgets, agency client spaces, white-label reports or delegated execution authority now.

**Reason:** the brief puts the first complete customer workflow first. No current user runs more than a few projects. Building administration before the workflow works adds risk and slows the core work.

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

## 6. Design sketch for later

These are boundaries, not a final design.

1. **Portfolio summary.** One read-only page per organization. It aggregates existing per-project tables with grouped queries: open opportunities by type and status, experiments by label, spend by project (RFC-0009 ledger). No new data copies.
2. **Cross-site comparison.** Compare Search Console totals per project for the same dates. Reuse the stored measurement days and the dashboard cache. Do not make new provider calls for the comparison page.
3. **Site budgets.** Already covered by RFC-0009 project limits.
4. **Approval roles.** Today every invitee is an admin and can approve pull requests. Add a separate `publishing:approve` statement. Give it to owners by default. Let owners grant it per member. Keep `integration:manage` for connecting accounts.
5. **Delegated execution authority.** A per-project setting that lists who may approve repository writes. Store it in a normalized table (`project_publishing_approvers`), not in JSON.
6. **Agency client spaces.** Use one organization per client. Add an "agency" link table between an agency organization and client organizations, with explicit, revocable grants. Do not mix client projects in one organization.
7. **White-label reports.** Extend the existing report templates and share links with a logo and a brand color per organization. Remove the Relay mark from shared report pages only for paid plans.

## 7. Alternatives considered

1. **Build the portfolio page now from the existing tables.** Rejected for now. It is cheap, but it adds UI to maintain before the workflow it summarizes is proven.
2. **Folders of projects inside one organization for agencies.** Rejected. It weakens client separation and billing boundaries.

## 8. Ready-for-other-users checklist

Only section 4 applies now.

- [x] `tenancy.test.ts` covers every growth service read and write.
- [ ] The suite runs on D1 and Postgres in CI. It runs on SQLite in CI and passed on Postgres locally on 2026-10-17. A Postgres job in CI changes `.github/**`, which needs the maintainer's review.
- [x] The schema check fails for a growth table without `project_id` (prove it with a temporary failing case, then remove it).
- [ ] This RFC is reviewed again when an entry criterion is met.

## 9. Real-site acceptance test

**Site:** production `relay.playbookmedia.io`, with two real Google accounts in two organizations. Each organization has one project (S1 and S3).

**Steps:**

1. As organization A, copy the URLs of one opportunity, one proposal and one experiment.
2. As organization B, open each URL.
3. As organization B, call `get_opportunity` and `list_opportunities` from an MCP client with organization A's project id.

**Pass when:**

- Every page and tool call returns "not found". No data from organization A appears in any response.

**Value check:** customers can trust that their search data, repositories and results stay in their own workspace.

## 10. Completion criteria

- The tenancy suite covers 100% of growth service functions. A count of exported service functions equals the count of tested ones.
- Manual checks find no cross-organization data in the UI, server functions, MCP tools, CSV exports, notifications or share links.
- The schema guard fails on a temporary growth table without `project_id`, then passes after its removal.
