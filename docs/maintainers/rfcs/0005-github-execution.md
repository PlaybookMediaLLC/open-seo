# RFC-0005: GitHub execution, more change types and deployment signals

- **Status:** Draft
- **Date:** 2026-10-15
- **Brief section:** 6 (Feature D)
- **Depends on:** RFC-0001 configuration. Phase 1a has no other dependency. Phase 1b uses the RFC-0004 file locator.

## 1. Summary

Relay can open a pull request that changes one meta description in a static Next.js App Router page. The connection uses a fine-grained personal access token. A person must state that the change is deployed. The parser rejects route groups and metadata helper calls, which real sites use, including our own `playbookmedia.io`. This RFC adds support for both (phase 1a), then the title change, read-only deployment signals, repository check status and revert proposals (phase 1b), then a GitHub App, a Pages Router adapter, canonical and robots changes, and approved GitHub issues (phase 2).

## 2. What exists today

| Part          | Location                                                        | Behavior                                                                                                                                             |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design record | `docs/maintainers/specs/approved-github-metadata.md`            | Scope, approval model and failure handling.                                                                                                          |
| Connection    | `src/server/features/publishing/PublishingConnectionService.ts` | Fine-grained token for one repository. Checks push access and the base branch. Encrypts the token with `BETTER_AUTH_SECRET` (`publishingAccess.ts`). |
| Client        | `src/server/features/publishing/githubClient.ts`                | Fixed API origin, at most 32 requests per operation, 10-second timeout per request.                                                                  |
| Reads         | `githubRead.ts`                                                 | Tree and file reads at an exact commit. Rejects symlinks and submodules.                                                                             |
| Writes        | `githubWrite.ts`                                                | Create branch ref, update one file through the contents API, find or create one pull request.                                                        |
| Parser        | `nextMetadata.ts`                                               | Static App Router page only. Replaces one description string literal. Rejects dynamic routes, route groups, private folders and generated metadata.  |
| Proposal      | `opportunity_proposals`                                         | Description before and after, blob hashes, snippets, SHA-256 change hash, reason, effect, risk, verification plan.                                   |
| Execution     | `proposal_executions`, `proposal_execution_events`              | Phases `validating`, `branch_created`, `file_committed`, `pull_request_created`, `failed`. Recovery service for interrupted runs.                    |
| Merge check   | `src/server/features/experiments/experimentPullStatus.ts`       | Read-only. Verifies head, branch and the merged file blob.                                                                                           |
| Deployment    | `confirmDeployment`                                             | Human attestation with time and note. Immutable.                                                                                                     |

## 3. Goals

1. Change pages that sit in route groups or declare metadata through a helper call.
2. Change the title, or the title and description together, in one approved pull request.
3. Record read-only deployment evidence from GitHub and from the live page.
4. Show the repository's own checks on the pull request, without calling them a Relay build.
5. Prepare a revert as a new approved proposal when a result is negative.
6. Replace the personal token with a GitHub App for hosted users, and keep the token for self-hosters.
7. Support the Pages Router and, with extra confirmation, canonical and robots changes.
8. Create a GitHub issue from a ticket, after approval.

## 4. Non-goals

1. No deployment by Relay. No merge or revert without a person, except a restore merge under an opt-in RFC-0018 standing approval, inside branch protection.
2. No dynamic metadata (`generateMetadata`), dynamic route segments, rewrites or CMS content.
3. No structured-data or body-content edits in this RFC. They stay tickets.
4. No other frameworks. The adapter interface allows them later.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                   |
| ----- | ------------------------------------------------------------------------------------------ |
| 1a    | Route groups and metadata helper calls. Required before any change on test site S1.        |
| 1b    | Title change, combined proposals, deployment signals, repository checks, revert proposals. |
| 2     | GitHub App, Pages Router adapter, canonical and robots, GitHub issues.                     |

### 5.2 Route groups and metadata helper calls (phase 1a)

**Why:** real Next.js sites rarely export a literal metadata object from an ungrouped page. On test site S1, every page sits in the `(site)` route group and declares `export const metadata = pageMetadata('Our approach', 'How Playbook Media…', '/approach')`. The current parser rejects both forms, so Relay cannot change any page on our own site.

**Route groups:**

1. In `validateMetadataTarget`, accept folder segments that match `^\([a-z0-9-]+\)$`. Drop them when mapping the file path to the URL path.
2. Keep rejecting dynamic segments (`[x]`, `[...x]`, `[[...x]]`), parallel routes (`@x`), intercepting routes (`(.)x`, `(..)x`, `(...)x`) and private folders (`_x`).
3. When two route groups map to the same URL, Next.js fails the build. No deployed site has this, so Relay does not check for it.

**Metadata helper calls:**

1. Accept `export const metadata = helper(arg0, arg1, …)` when `helper` is an identifier from a named import.
2. Resolve the import at the same base commit:
   - A relative path, or
   - An alias from the app's `tsconfig.json` `compilerOptions.paths` that has the `prefix/*` form and one target.
   - Try `.ts`, `.tsx`, `.js`, `.jsx` and `/index.*`.
3. Read at most 2 extra files: `tsconfig.json` (for an alias only) and the helper module. A missing candidate in a folder that was already read costs no request.
4. In the helper module, find the exported function with that name. Accept a function declaration or `export const name = (…) =>`. Every parameter must be a plain identifier.
5. Prove the mapping. The function must return an object literal whose `description` property is the shorthand `description` or `description: <parameter>`. Apply the same rule to `title`. This maps a field to one parameter index, and so to one call argument.
6. The call argument must be a string literal, or a template literal without expressions. Otherwise reject with "The description is computed. Relay can only change literal text."
7. Replace only that argument literal. Keep its quote style, and switch quotes only when that needs fewer escapes, as Prettier does. S1 runs `prettier --check` with single quotes. Parse the page again.
8. List the other places inside the helper that use the same parameter. Show them in the risk text. On S1, `title` also feeds the Open Graph image `alt` text.
9. Show the helper in the diff: "Changes the `description` argument of `pageMetadata` (defined in `apps/www/lib/site.ts`)."

**Data model.** Add to `opportunity_proposals`:

| Column            | Type                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `metadata_source` | text enum `literal_object`, `helper_call`, default `literal_object` |
| `helper_path`     | text, nullable                                                      |
| `helper_blob_sha` | text, nullable                                                      |

Fingerprint version 2 (see 5.3) includes these three fields. At execution, the server reads the helper again and requires the same blob. A changed helper fails closed with "The metadata helper changed. Prepare the proposal again."

**Request budget:** at most 2 extra GitHub reads per proposal.

### 5.3 Title change (phase 1b)

1. Generalize the parser function to `prepareMetadataChange`, which takes a new `description`, a new `title`, or both.
2. Support a direct string literal (`title: "..."`) and the helper-call form from 5.2. Reject the object form (`{ default, template, absolute }`) in the page with a clear message.
3. Read the root layout and each parent layout of the page (at most 3 files). When one defines `title.template` as a literal, compute the final title by replacing `%s`. On S1 the template is `'%s | Playbook Media'`.
4. Title rule: the final title is 10 to 60 characters, with no control characters. Show the final title in the diff.
5. A proposal can change one or both fields in the same file.
6. Add to `opportunity_proposals`:

   | Column                 | Type                         |
   | ---------------------- | ---------------------------- |
   | `title_before`         | text, nullable               |
   | `title_after`          | text, nullable               |
   | `title_before_snippet` | text, nullable               |
   | `title_after_snippet`  | text, nullable               |
   | `fingerprint_version`  | integer, not null, default 1 |

7. Fingerprint version 2 hashes the four title fields, the three phase 1a helper fields and the existing inputs. Keep version 1 for existing rows, so their hashes stay valid.
8. The description columns stay required for back-compat. When a proposal changes only the title, the description columns hold the unchanged value, and `description_before` equals `description_after`.
9. Show both fields in the diff view.
10. Pull request title: "SEO: update title and description for {path}" or the single-field form.

### 5.4 Deployment signals (phase 1b)

Add `experiment_deployment_signals`:

| Column          | Type                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `id`            | text primary key                                                         |
| `project_id`    | text, FK cascade                                                         |
| `experiment_id` | text, FK `growth_experiments.id`, cascade                                |
| `kind`          | text enum `human_attestation`, `github_deployment`, `live_content_match` |
| `observed_at`   | text                                                                     |
| `effective_at`  | text, the deployment time the signal supports                            |
| `environment`   | text, nullable                                                           |
| `external_id`   | text, nullable                                                           |
| `detail`        | text, at most 500 characters                                             |
| `created_by`    | text (user id or `system`)                                               |

Unique index on (`experiment_id`, `kind`, `external_id`).

**GitHub deployment signal.**

1. Add `production_environment` to `publishing_connections`: text, default `Production`.
2. After merge, read `GET /repos/{owner}/{repo}/deployments?sha={mergeCommitSha}`, then the statuses of each matching deployment.
3. A deployment matches when its environment equals `production_environment` (case-insensitive) and it has a `success` status.
4. Record one signal with `effective_at` = the success status time.
5. The token needs "Deployments: read". When GitHub returns 403, show "Add Deployments read access to see deployment status." Do not fail the experiment.

**Live content signal.**

1. Fetch the target URL with `readPages` (SSRF-checked on every hop).
2. Parse the `<title>` and `<meta name="description">` values.
3. Record a signal when each changed field equals its approved value after whitespace normalization. The rendered title includes the layout template, so it must contain the approved title.
4. This proves that the change is visible on the page. It does not prove which commit runs. Say so in `detail`.

**Measurement start rule.** Keep human attestation as one valid basis. Add a second: a `github_deployment` signal plus a `live_content_match` signal. Add `deployment_basis` to `growth_experiments`: text enum `human`, `verified`, nullable. With the verified basis, the deployment date is the GitHub `effective_at`. The person still declares other changes and seasonal risk before measurement starts.

### 5.5 Repository checks (phase 1b)

1. On the execution detail, read `GET /commits/{headSha}/check-runs` and `GET /commits/{headSha}/status`.
2. Show "Repository checks: passing, failing, pending or not configured".
3. Label it "Your repository's checks". Never call it a Relay build or validation.
4. The token needs "Checks: read" and "Commit statuses: read". On 403, show which permission is missing.
5. Store nothing. Read on demand, with a 60-second client cache.

### 5.6 Revert proposals (phase 1b)

1. On an experiment with a merged change, show "Prepare revert". Show it first on a `negative` result.
2. The service reads the current file at the base branch head. It requires that the file still contains the approved "after" values. Otherwise it stops with "The page changed after this proposal. Prepare a new proposal instead."
3. It creates a new proposal with before and after swapped. Add `reverts_proposal_id` to `opportunity_proposals`: text, nullable, FK `opportunity_proposals.id`, set null.
4. The revert uses the same exact-change approval and execution path. The execution gate has a revert branch: it skips the 14-day evidence age, keeps the opportunity status, allows the original's succeeded execution, and allows at most one succeeded revert. A failed revert leaves the opportunity status unchanged. A revert restores the earlier title even outside the 10 to 60 character rule.
5. After the revert merges and deployment is confirmed, set the opportunity status to `reverted`. Record a decision row with the actor.

### 5.7 GitHub App (phase 2)

**App registration.** Create one GitHub App, "Relay SEO", owned by Playbook Media.

| Permission      | Access         | Why                                                    |
| --------------- | -------------- | ------------------------------------------------------ |
| Metadata        | Read           | Required by GitHub.                                    |
| Contents        | Read and write | Read the page file, commit the change on a new branch. |
| Pull requests   | Read and write | Open the pull request, read its state.                 |
| Deployments     | Read           | Deployment signal.                                     |
| Checks          | Read           | Repository checks.                                     |
| Commit statuses | Read           | Repository checks.                                     |
| Issues          | Read and write | Phase 2 issues only.                                   |

Turn on "Request user authorization (OAuth) during installation". Use no webhooks in the first version.

**Installation flow.**

1. The user clicks "Install GitHub App" in project Integrations.
2. The server creates a signed, single-use state value with a 10-minute expiry. Reuse the pattern in `src/server/features/google/googleOAuthState.ts`.
3. GitHub redirects to `/api/github/app/setup` with `installation_id`, `setup_action`, `code` and `state`.
4. The server consumes the state. It exchanges `code` for a user token.
5. It calls `GET /user/installations` with the user token. It continues only when the list contains `installation_id`. The setup URL parameters alone are not trusted.
6. It lists the installation's repositories with the user token. The user picks one repository and the base branch.
7. The server discards the user token after the flow.

**Data model.**

- `github_app_installations`: `id`, `organization_id` (FK cascade), `installation_id` (integer), `account_login`, `account_type`, `created_by`, `created_at`, `revoked_at` (nullable). Unique on (`organization_id`, `installation_id`).
- `publishing_connections.transport`: text enum `pat`, `github_app`, default `pat`.
- `publishing_connections.installation_ref`: text, nullable, FK `github_app_installations.id`, set null.

**Tokens per operation.**

1. Sign a JWT with the app private key (RS256, 9-minute expiry) using WebCrypto.
2. Call `POST /app/installations/{id}/access_tokens` with `repository_ids: [repositoryId]` and only the permissions that the operation needs.
3. Keep the token in memory for that operation only. Never store it.
4. On 404 or 403 for the installation, set `revoked_at` and show "Reconnect the GitHub App."

**Secrets.** `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`. GitHub issues the key in PKCS#1 PEM. Convert it to PKCS#8 for WebCrypto (`openssl pkcs8 -topk8 -nocrypt`). Document this in `docs/maintainers/playbook-deployment.md`.

**Personal tokens** stay available for self-hosted installs and as a fallback. Hosted mode shows the App first.

### 5.8 Pages Router adapter (phase 2)

1. Choose the adapter by file path. `validateTarget` checks the path and URL before any GitHub request, and `prepareChangeAt` reads the page at a commit and prepares the change with the adapter for its router. Prepare, execution and revert all use it.
2. The App Router logic stays in `nextMetadata.ts`, without behavior change. A file locator (`candidatePaths`) belongs to RFC-0004 and is not part of this adapter.
3. Add `pagesRouterHead.ts`: files under `pages/` or `src/pages/`, excluding `_app`, `_document`, `api/` and dynamic segments.
4. Support only direct literals inside `next/head`: `<title>text</title>` and `<meta name="description" content="text" />`. New text uses HTML entities for JSX-special characters, so it reads back exactly. Pages have no title template, so the final title is the title.
5. Reject expressions, spreads, multiple matches and components that wrap `Head`.
6. Store `adapter_id` on `opportunity_proposals` (text, not null, default `app_router_metadata`). Fingerprint version 4 binds it.

### 5.9 Canonical and robots (phase 2)

1. App Router only. Support `alternates: { canonical: "literal" }` and `robots: { index: true|false, follow: true|false }` with literal values.
2. These changes can remove a page from Google. Require a second confirmation: the user types the page path.
3. The verification plan always includes a URL Inspection check after deployment.
4. Only `technical_blocker` opportunities for canonical or noindex issues offer these changes.
5. Store them as fields `canonical` and `robots` with the same before and after columns pattern as the title.

### 5.10 GitHub issues (phase 2)

1. On any approved opportunity, "Create GitHub issue" shows the RFC-0003 ticket text and the target repository.
2. The user approves the exact text. The server stores an approval with the SHA-256 of the text.
3. The server creates the issue with the App token (Issues write) or a personal token that has Issues write.
4. Store `opportunity_tickets`: `id`, `project_id`, `opportunity_id`, `connection_id`, `text_hash`, `issue_number`, `issue_url`, `created_by`, `created_at`.
5. The same approval cannot create a second issue.

## 6. Security

1. Every GitHub write still follows a stored exact-change approval.
2. App tokens are scoped to one repository and the needed permissions, and are never stored.
3. The setup callback trusts only the user-token check, not the URL parameters.
4. Live content checks use `readPages`. Responses are parsed, never executed.
5. Reads of deployment and check data never change repository state.
6. `BETTER_AUTH_SECRET` encrypts personal tokens today. RFC-0009 moves this to a separate, versioned key.

## 7. Alternatives considered

1. **Infer deployment from the merge.** Rejected in the design record. Many repositories do not deploy on merge.
2. **Webhooks for pull request and deployment events.** Deferred. Polling on demand and by schedule (RFC-0008) is enough at this scale, and it needs no public webhook secret handling.
3. **One generic field-change table.** Rejected for now. Four known metadata fields fit explicit columns, and the fingerprint stays simple.
4. **A universal CMS layer.** Rejected by the brief for this release.

## 8. Ready-for-other-users checklist

### Phase 1a

- [x] `validateMetadataTarget` accepts route groups and still rejects dynamic, parallel, intercepting and private segments (one test each).
- [x] Route-group URL mapping. Two groups that map to one URL fail the Next.js build, so there is no check for them (5.2).
- [x] Helper-call support: relative import, `@/*` alias import, function declaration and arrow function (tests).
- [x] Rejection tests: destructured parameters, a computed argument, a helper that renames the field, an unresolvable import.
- [x] Only the target argument literal changes (test on a copy of the S1 `approach` page and `lib/site.ts`).
- [x] `metadata_source`, `helper_path` and `helper_blob_sha` columns in D1 and Postgres.
- [x] Test: a changed helper blob at execution fails closed.
- [x] Diff view names the helper and lists other uses of the parameter (risk text).
- [ ] S1 repository CI passes on a real test pull request.
- [ ] Phase 1a acceptance test run in production (section 10).

### Phase 1b

- [x] `prepareMetadataChange` for title and description, with tests for literal, helper call, object form (rejected) and the final title with a layout template.
- [x] Title columns and `fingerprint_version` in D1 and Postgres.
- [x] Test: version 1 hashes of existing proposals do not change (golden hash from the code before version 2).
- [x] Combined proposal diff shows both fields.
- [x] Execution writes one file with both changes (test against the GitHub mock).
- [x] `experiment_deployment_signals` table.
- [x] `production_environment` on connections, editable in the UI.
- [x] GitHub deployment signal with tests for match, no match, failed status and 403.
- [x] Live content signal with tests for match, mismatch and SSRF refusal.
- [x] `deployment_basis` and the verified-start rule, with a test that a single signal is not enough.
- [x] Repository checks view with tests for each state and for 403.
- [x] Revert proposal with the "file changed" refusal test.
- [x] Opportunity becomes `reverted` after the revert is confirmed (test).
- [x] Token instructions list the new read permissions.
- [ ] Live check on S1: the GitHub deployment signal (environment `production`) and the live content signal appear after merge and deploy.
- [ ] Live check: prepare and open a revert pull request. Do not merge it unless the owner approves.
- [x] `content/docs/github-publishing.mdx` covers titles, deployment signals, checks and reverts.

### Phase 2

- [ ] GitHub App registered with the listed permissions only.
- [ ] Secrets set, and the PKCS#8 conversion documented.
- [ ] Setup callback with state, user-token check and repository picker.
- [ ] Test: a forged `installation_id` that the user cannot access is refused.
- [ ] Installation tokens limited to one repository and the needed permissions (test of the request body).
- [ ] Revoked installation is detected and shown.
- [ ] Personal tokens still work for self-hosting (regression test).
- [x] Adapter dispatch (`validateTarget`, `prepareChangeAt`), with the App Router logic and its tests unchanged.
- [x] Pages Router adapter with tests for supported and rejected forms.
- [ ] Canonical and robots changes with the typed confirmation and the inspection step.
- [ ] GitHub issues with exact-text approval, and a test that one approval creates one issue.
- [ ] Live check: install the App on `PlaybookMediaLLC/monorepo` only, open a pull request for S1, create an issue, then uninstall and see the revoked state.
- [ ] Docs cover the App install and permissions.

## 9. Open questions

1. Should hosted users still be allowed to use personal tokens after the App ships?
2. Which deployment environments besides "Production" are common for Netlify and Cloudflare Pages repositories?
3. Should the live content check run on a schedule after merge (RFC-0008), or only on demand?

## 10. Real-site acceptance test

### Phase 1a

**Sites:** S1 (`PlaybookMediaLLC/monorepo`, root `apps/www`) and S4 (`apps/solomon-ai-marketing`).

**Steps:**

1. Prepare description proposals for 3 S1 pages: `/approach`, `/company` and `/`.
2. Read each diff.
3. Prepare a proposal for an S4 page under `[product]`.

**Pass when:**

- All 3 S1 proposals are prepared. Each diff changes only the description argument of `pageMetadata`. The title and path arguments do not change.
- Each diff names `apps/www/lib/site.ts` as the helper.
- The S4 proposal is refused with a message that names the dynamic segment and offers a ticket.

**Value check:** Relay can change pages on a typical production Next.js site, including our own.

### Phase 1b

**Site:** S1. The site owner approves the merge and the production deploy.

**Steps:**

1. Prepare a title and description proposal for one S1 page. Approve it.
2. Open the pull request. Check the repository checks state in Relay.
3. Merge it. Let the monorepo pipeline deploy production.
4. In Relay, refresh the experiment status.
5. Prepare a revert proposal. Open the revert pull request, but do not merge it.

**Pass when:**

- The pull request changes one file, and only the approved literals.
- The final title, with the `| Playbook Media` template, is at most 60 characters. Relay showed it before approval.
- Relay shows the same checks state as GitHub.
- Within 1 hour of the production deploy, Relay records the GitHub deployment signal and the live content signal.
- Measurement can start on the verified basis without a manual deployment date.
- The revert diff is the exact inverse of the first diff.

**Value check:** the owner sees "approved, merged, deployed, visible on the live page" from one screen, with evidence for each step.

### Phase 2

**Sites:** S1 for the App and issues. A test Pages Router repository for the adapter.

**Steps:**

1. Install the GitHub App on `PlaybookMediaLLC/monorepo` only.
2. Repeat phase 1b steps 1 and 2 with the App.
3. Create a GitHub issue from a ticket.
4. Prepare a canonical change on a test page, with the typed confirmation.
5. Uninstall the App. Try a new proposal.

**Pass when:**

- No personal token is used.
- The issue text matches the approved ticket exactly. A second click does not create a second issue.
- The canonical change needs the typed path, and its verification plan includes URL Inspection.
- After the uninstall, Relay shows "Reconnect the GitHub App" and makes no write.

**Value check:** a team connects a repository in two clicks, with access limited to one repository.

## 11. Completion criteria

**Phase 1a: real-site coverage**

Dry run on 2026-10-16, parser only, no pull request:

- S1: 9 of 9 static pages prepared. Each diff changes one line, the `description` argument of `pageMetadata`, in single quotes.
- S4: 0 of 19 pages prepared, each with its reason. 4 dynamic routes (`[product]`, `[industry]`, `[program]`, `[segment]`) are refused with the segment name. 13 pages call `createSolomonMetadata({ title, description, path })`, which takes a destructured object and passes it to a package helper. 1 page is over 32 KiB. 1 page references `metadata` elsewhere.

- Dry runs (no pull request) prepare a proposal for every S1 static page. Record the count. The target is 100%.
- Each S1 diff changes only the target argument. The S1 repository CI passes on the test pull request.
- On S4, every dynamic route is refused with the segment name. Record the count of supported and refused pages, with the reasons.
- A changed helper on a test branch makes execution fail closed.

**Phase 1b: execution and signals**

- The GitHub deployment signal appears within 1 hour of the production deploy.
- The live content signal appears within 1 hour of the deploy, or the PR explains a cache delay with its length.
- The repository checks state in Relay matches GitHub for 3 pull requests, through pending to passing.
- A 70-character title is refused before approval because of the template rule.
- A revert executed against a staging branch restores the original text on the staging site.
- An interrupted execution recovers without a second pull request.
- The audit log shows an approval record for every repository write. No write lacks one.

**Phase 2: GitHub App**

- The token request body asks only for the permissions of each operation (log review).
- A token for the monorepo gets `403` on any other repository.
- After uninstalling, the next operation shows the reconnect message and writes nothing.
- On a Pages Router test repository with 5 pages, every supported form succeeds, and every unsupported form is refused with its reason.
- A canonical change cannot proceed without the typed path. URL Inspection shows the expected canonical within 7 days of deploy.
- One approval creates exactly one GitHub issue, whose text hash matches the approval.
- A second person reviews the install flow security before release.
