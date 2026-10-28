# IRFC-0005: Authorize exact PR writes and check customer-owned previews

**Status:** Ready to build; specified against `develop` on 2026-10-28  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0004  
**Canonical technical specifications:** [RFC-0027](../0027-source-mapped-regression-repairs.md) phase B, [RFC-0025](../0025-preview-sandboxes-on-cloudflare.md) phase 1a  
**Implementation order:** 0005 of 0032

## Implement this slice

Let an approver authorize one exact regression proposal. Relay then re-checks everything and opens exactly one pull request, records its head commit, and checks the customer's own preview deployment of that commit. The check uses the customer's CI results, the existing SEO check rules and the restored value rendered on the preview. Missing, stale, redirected or mismatched evidence is shown and never counts as passed. The customer reviews, merges and deploys.

Read RFC-0027 section 5 and RFC-0025 sections 5.3, 6 and 9 (phase 1a). Inspect `develop` before writing code: reuse what is listed here, and update this file if the code has moved.

## What exists to reuse

| Need                    | Existing code                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact-change execution  | `MetadataExecutionService.execute` behind `executeMetadataProposal` (`src/serverFunctions/publishing.ts`, `executeProposalInputSchema`: `changeHash`, `authorizePullRequest: true`, `note`). It recomputes the fingerprint and re-reads source at `baseSha`, matching blobs, helper and snippets; it checks the repository ID and `canPush`, and that the base ref is still at `baseSha` |
| Approver gate           | `authorizeApproval(context, projectId)` → `canApprove` (`publishingAccess.ts`), including `project_publishing_approvers`                                                                                                                                                                                                                                                                 |
| One PR only             | `beginExecution` (one-winner compare-and-set, lease `publishing:{projectId}`, `retireExecutions`); fixed branch `growth/{proposalId}`; PR marker `<!-- OpenSEO proposal:{id} change:{hash} -->`; `findPullRequest` and `verifyPull` for forward recovery; `checkpoint` phases                                                                                                            |
| Head commit             | `proposal_executions.commit_sha` once `pull_request_created`                                                                                                                                                                                                                                                                                                                             |
| Preview discovery       | `createGithubSignals`: `listDeployments(sha)` and `listDeploymentStatuses(id)` (with `environment_url` from IRFC-0003); `publishing_connections.production_environment` marks the production environment                                                                                                                                                                                 |
| SEO checks on a preview | `queueCheck(scope, input, { source: "app", installationId })` (`seo-checks/CheckApi.ts`), which `handleDeploymentStatus` already calls with `{ ...target, tokenId: null }` for App-mode PR previews. `ci_check_runs` is unique per (`project_id`, `head_sha`, `preview_origin`)                                                                                                          |
| Host and access policy  | `isAllowedPreviewHost` and `isTrustedPreviewHost` (`previewHosts.ts`), `ci_preview_hosts`, `ci_preview_access`; private `previewAccess(run)` in `seoCheckPlan.ts`; `crawlerHeadersFor` (`src/shared/crawler-access.ts`)                                                                                                                                                                  |
| Customer CI             | `getChecks(sha)` → `passing`, `failing`, `pending`, `not_configured`                                                                                                                                                                                                                                                                                                                     |
| PR state                | `getPullRequest(number)`; the pattern in `experiments/experimentPullStatus.ts`                                                                                                                                                                                                                                                                                                           |

## Execution

Extend `MetadataExecutionService.execute` with the regression evidence variant. Do not add a second publisher; RFC-0027 requires the existing controls.

1. **Same checks as today.** Recompute and compare the fingerprint, require an approver, and check that the connection is not revoked, the repository ID matches, `canPush` holds, the source re-proves at `baseSha` and the base ref is unchanged.
2. **Regression eligibility replaces the opportunity checks.** The GSC site, evidence run and 14-day window stay opportunity-only. Instead require:
   - the incident `open` at the proposal's `regression_evidence_version`;
   - the enrollment `active` with `allow_pull_requests`;
   - the page still active;
   - the mapping's `connection_id` equal to the active connection.
3. **A `beginExecution` regression variant.** It needs its own fence.
   - **Why:** today the winning compare-and-set writes `opportunities.lastDecisionId = eventId`, and every child insert is conditioned on that value. Add `site_regressions.last_decision_id` (nullable text) and use it the same way.
   - **The batch:**
     - compare-and-set the incident from `open` to `repairing` at the proposal's evidence version, setting `last_decision_id` to the new event ID;
     - insert the approval, execution, first event and audit rows, each conditioned on that `last_decision_id`, exactly as the opportunity path does;
     - refuse when another execution for the same incident and evidence version is `succeeded`.
   - **Stuck executions:** a `running` execution with an expired lease is taken over exactly as today (`previous = 'running'` with another ID is retired).
4. **Retire.** `retireExecutions` gets the regression variant too. Retiring a regression execution moves its incident from `repairing` back to `open` in the same batch. The publishing lease is shared per project, so an opportunity publish can retire a regression execution; without this, the incident would stay `repairing` forever.
5. **Publish.**
   - Execution passes `restore: true` to `prepareChangeAt` for regression proposals, as `prepare` did. Today `execute` sets `restore` only for reverts, so a known-good title outside 10–60 characters would prepare and then always fail.
   - `publishProposal` changes in one way: it takes the PR body text from its caller. Opportunity callers pass today's text ("approved in the growth queue"). The regression caller passes the incident link, baseline value, bad value and confirmations.
6. **Failure and recovery.** A failure moves the incident back to `open` in the same batch as the failed checkpoint. `PublishingRecoveryService` stays opportunity-only. A regression recovers by approving the same proposal again: `findPullRequest`, `verifyPull` and the branch-commit check reuse any verified PR or commit, as forward recovery does today.
7. **Closed PR.** A PR closed without merging moves the incident back to `open` and adds one to its `evidence_version`. The old proposal becomes stale, so the reviewer prepares and approves a new proposal, which gets a new ID and branch. Without the bump, IRFC-0004's dedupe would return the old proposal, and `execute` would stop at "already has a recorded pull request".

The new server function `approveRegressionRepair` takes the same input as `executeProposalInputSchema` and calls the extended service. Approval binds `change_hash`, which in version 7 covers the incident evidence version and the source mapping. The preview check below binds the resulting head SHA.

## Preview check

New table **`proposal_preview_checks`** in the protection schema:

| Column                                                                             | Type and rule                                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `id`, `project_id` (FK cascade), `execution_id` (FK `proposal_executions` cascade) | text                                                                             |
| `head_sha`                                                                         | text, not null                                                                   |
| `status`                                                                           | `PREVIEW_CHECK_STATUSES` = `pending`, `passed`, `failed`, `unavailable`, `stale` |
| `deployment_id`, `environment`, `preview_url`                                      | nullable                                                                         |
| `ci_check_run_id`                                                                  | nullable FK `ci_check_runs` on delete set null                                   |
| `repository_checks`                                                                | nullable: `passing`, `failing`, `pending`, `not_configured`                      |
| `rendered_value`                                                                   | text, nullable, at most 1000                                                     |
| `reason`                                                                           | text, nullable, at most 500: why it is not passed, and the next action           |
| `started_at`, `checked_at`, `expires_at`                                           | `expires_at` is `started_at` + 7 days                                            |

Unique (`execution_id`, `head_sha`).

**`PreviewCheckService.tick(now)`** runs from `runProtectionMonitor` on every tick, for every `pending` check. A check older than 30 minutes goes straight to step 6.

1. **Find the preview.**
   - Call `listDeployments(head_sha)` and skip the production environment.
   - Take the newest status that is `success` and has an `https` `environment_url`.
   - The host must pass `isAllowedPreviewHost` for the project domain and its `ci_preview_hosts`, and `normalizeAndValidateStartUrl`. A failure is `unavailable` with "preview host not allowed", and no credentials are sent.
2. **Run the SEO check.**
   - Reuse the `ci_check_runs` row for (`head_sha`, preview origin) when the webhook already queued one.
   - Otherwise call `queueCheck` with the publishing connection's installation and `changedFiles: [file_path]`. `queueCheck` starts the workflow itself, so do not start it again.
   - **Base origin:** `queueCheck` compares against `https://${domain}`, but `projects.domain` is the bare host. On a site served from `www.`, every base page answers 301, `comparePage` finds nothing, and the check passes vacuously. Extend `queueCheck` with an optional `baseOrigin`, defaulting to today's value, and pass the enrollment's `production_origin`.
   - **Refusals:** every non-queued `queueCheck` result becomes `unavailable` with the API's own message. That covers `quota_reached` (these checks count toward the project's monthly SEO check quota), `no_domain` and `preview_host_not_allowed`.
   - Wait for the run to finish. A `failed` run or any blocking finding is `failed`.
3. **Check the rendered value.**
   - Fetch the preview page with `fetchSnapshot`, using the protected-preview access from `previewAccess`. It is already exported from `seoCheckPlan.ts` and used by `seoCheckRun.ts`, and it sends secrets only to a trusted host.
   - The whitespace-squashed field must equal the mapping's `expected_value`. A mismatch is `failed`, with "preview renders … , expected …".
   - Preview `noindex` is ignored, following the preview policy.
4. **Read customer CI.** Call `getChecks(head_sha)`:
   - `failing` is `failed`;
   - `pending` waits;
   - `not_configured` is allowed and shown as "No CI checks are configured".
5. **Pass.** All of the above passing gives `passed`.
6. **Time out.** At 30 minutes with no preview or CI result, the check is `unavailable`: "No preview deployment for {sha} within 30 minutes", or "CI still running". The PR stays open; Relay only declines to label it preview-verified.

**Staleness** is re-checked whenever the incident page loads and on each tick. A passed check becomes `stale` when any of these holds:

- the PR head differs from `head_sha` (it no longer contains exactly the approved change);
- the incident is no longer `repairing`;
- the connection was revoked;
- `expires_at` has passed.

**PR state** is read with `getPullRequest`, cached for 5 minutes:

- A PR closed without merging moves the incident back to `open` and bumps its evidence version, as in **Execution** step 7.
- A merged PR keeps it `repairing` until IRFC-0006 verifies production.

## Interface

The incident page gains a **Repair** section:

- **Approve and open pull request.** A `ConfirmDialog` shows the exact diff and says Relay will create branch `growth/{id}` and one PR, and that the customer reviews and merges.
- **After approval:** the PR link and head SHA, then the preview check status with its reason and next action, the CI result, the rendered and expected values, and a link to the SEO check run.
- **Preview-verified** is shown only for a current `passed` check. Every other state names itself, and production verification is described as a later, separate step.

## Tests

- `MetadataExecutionService.test.ts`, regression cases:
  - a non-approver is refused;
  - a changed evidence version, a resolved incident and an enrollment without PRs are each refused before any GitHub write;
  - a duplicate approval produces one PR through the existing recovery path;
  - a failed execution returns the incident to `open`;
  - a known-good title outside 10–60 characters executes, because `restore` is passed;
  - the PR body is the regression text, and the opportunity PR body is unchanged;
  - the opportunity cases still pass unchanged.
- `publishingExecution.test.ts`, real SQLite and Postgres:
  - one regression approval wins, and the incident moves `open` → `repairing` only at the matching evidence version;
  - a losing approval's child rows never land (the `last_decision_id` fence);
  - `retireExecutions` retiring a regression execution reopens its incident;
  - after a PR is closed unmerged, a new proposal at the bumped evidence version can be approved and opens a second PR.
- `previewCheck.test.ts`, real SQL with a fake GitHub client and `fetch`:
  - finds the preview for the exact SHA;
  - ignores production and other SHAs;
  - a disallowed host is `unavailable` and sends no credentials;
  - a check older than 30 minutes becomes `unavailable` on the next tick;
  - a `quota_reached` or `preview_host_not_allowed` result from `queueCheck` is `unavailable` with its message;
  - on a `www.` production origin, the SEO check compares against that origin, not the bare domain;
  - the workflow is started once;
  - failing CI is `failed`;
  - a rendered mismatch is `failed`;
  - a changed PR head is `stale`;
  - reuses an existing check run for the same SHA and origin;
  - `passed` only when every part passes.
- `githubSignals` tests cover the deployment status schema with and without `environment_url`.

## Acceptance gate

Use an authorized Next.js repository whose platform builds PR previews.

1. Approve one IRFC-0004 proposal. Exactly one PR opens. Retrying the approval opens no second PR.
2. The preview for that head SHA is found and checked, and the restored value renders.
3. Push a commit to the PR. The result becomes stale.
4. Test each failure case. None may show as passed or leak a bypass credential:
   - a failed build;
   - no preview;
   - a wrong environment;
   - a disallowed preview host;
   - revoked access;
   - a protected preview.
5. The customer merges. Relay neither merges nor deploys.

## Explicit boundary

Do not build Relay-owned Cloudflare sandboxes, standing approval policies, or auto-merge. Do not mark the incident resolved; IRFC-0006 owns production verification.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0006](0006-verify-repaired-behavior-in-production.md)
