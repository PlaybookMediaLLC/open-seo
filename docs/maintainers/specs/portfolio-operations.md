# Portfolio operations

Design record for [RFC-0007](../rfcs/0007-portfolio-operations.md) section 6: oversight across projects and organizations without weakening the per-project boundary.

## Scope

Six capabilities, each built on records Relay already keeps:

1. A read-only portfolio summary of an organization's active projects.
2. A Search Console comparison across those projects for the same dates.
3. Site budgets, which the RFC-0009 project limits already provide.
4. Approval of pull requests as its own permission.
5. A per-project list of who may approve repository writes.
6. Agency access to a client organization, and white-label shared reports.

None of them copies product data into a new store, moves a project between organizations, or makes a provider call on a page load.

## Portfolio summary

One page per organization lists every active project with its open opportunities by status and type, its tracked experiments by result label, its committed credits and limit for the month, and its Search Console clicks and impressions. Each value comes from a grouped query over the project's own tables: opportunities, the latest completed primary measurement run of each experiment, and the spend ledger. The experiment label follows the same rule as the experiments page (a final label, or "measuring" until the window is complete). Spend uses the same committed-credit rule as the spending limits. Opportunities that are completed, rejected or reverted count as closed.

Every member can read the page. It changes nothing and spends nothing.

## Cross-site comparison

The comparison reads each project's last 28 days of Search Console queries from the dashboard's existing cache entry, under the same key the dashboard writes. A cache-only read never loads, so the page cannot call Google or spend a provider request. A project whose dashboard never stored the data says so rather than showing zero, and a project without a Search Console connection says that.

Stored entries can end on different days. The newest window on the page is the reference, and any project whose window ends earlier is marked as covering other dates. Totals are the sum of the reported queries. Search Console keeps some rare queries private, so these totals can be lower than the property totals, and the page says so.

Measurement days cover only the pages of tracked experiments, so they are not used for site totals; they feed the experiment labels instead.

## Approval roles

`publishing:approve` is a separate access-control statement. Owners hold it. An owner grants it to a member by adding the `approver` role to that member's role list, so a teammate reads as "Admin, Approver". The grant lives in the member row the request already resolves, so checking it needs no extra query.

Better Auth's own role endpoint lets any admin set any non-owner role. Its update hook therefore refuses any change that adds or removes `approver`, and only an owner-only server function changes it, with an audit event in the same batch. Admins who belonged to an organization before the statement existed received the approver role, so no one lost an ability they had. Behind an Every App gateway the gateway owns the team, so gateway admins keep approval there.

Approval is required, in addition to integration management, wherever Relay writes to a customer repository: executing an approved proposal, opening a split-test pull request, and ending a split test. Preparing changes, connecting repositories and recovering a failed attempt still need integration management only.

## Delegated execution authority

`project_publishing_approvers` is a normalized table of project and member pairs. When a project has rows, only those members and the owners may approve its pull requests. With no rows, approval follows the organization statement. A row references the member, so removing someone from the organization removes their rows. Only owners change the list, only members who can manage integrations can be on it, and every change writes an audit event in the same batch. The project service and its readers sit in the RFC-0007 tenancy suite, so another organization gets "not found".

## Agency client spaces

Each client keeps its own organization, billing and projects. `agency_client_links` records an explicit grant between an agency organization and a client organization. The agency's owner asks for a client organization they already belong to. The client's owner accepts. Either owner can decline, withdraw or end it, and a partial unique index allows one open link per pair. Each step writes an audit event into both organizations' activity logs.

While a link is accepted and not ended, the agency's portfolio page shows the client's summary in its own section. That is the only thing the grant exposes: no project pages, reports, credentials or writes. Ending the link removes the section on the next load.

## White-label reports

`organization_branding` holds one optional brand color and one optional logo per organization. The logo is a PNG or JPEG data URL of at most 48 KB. Its signature bytes must match the declared format, so an SVG or HTML payload cannot pass. The server checks both values on save and again on every read, and drops a stored value that fails. Shared report pages show the logo and use the color for the header and buttons. `list_report_templates` returns the color, so agents use it as the accent of reports they write from a template.

The Relay mark (the "Made with" line, the try button, and the Relay name in the title and link preview) comes off only when the organization has branding and pays for a plan. The paid check reads the locally synced billing status, so a public page never calls the billing provider. Self-hosted deployments have no plans, so branding there always removes the mark.

## Alternatives considered

- **A folder of client projects inside the agency's organization.** Rejected: it mixes client billing, membership and data in one tenant, and a mistake in any project query would cross clients.
- **Copying client summaries into the agency organization.** Rejected: the copies drift and outlive a revoked grant.
- **Live Search Console calls for the comparison.** Rejected: one page load would make one provider call per project, and a slow property would hold up the page.
- **Approval stored as a separate grant table.** Rejected for the organization level: the member row already carries the role, and the check stays free of queries. The per-project list needs its own table because it relates two records.
- **A logo URL instead of an uploaded image.** Rejected: an external image on a public page tracks its readers and can change after review. Better Auth's organization logo field was not reused, because its own endpoints accept any string from any admin.
