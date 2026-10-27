# RFC-0025: Preview sandboxes on Cloudflare

- **Status:** Draft. Existing CI checks can inspect a supplied preview; proposal-bound customer-preview orchestration and Relay-owned builds are not implemented.
- **Date:** 2026-10-15
- **Delivery order updated:** 2026-10-23
- **Area:** stage 2 customer-preview checks first; Relay-owned builds deferred until demand and isolation are proven.
- **Depends on:** RFC-0005 proposal/execution and GitHub access, RFC-0008 jobs, RFC-0009 controls, RFC-0010/0015 checks. RFC-0027 supplies incident proposals. No dependency on RFC-0018 standing approvals; those later consume passed previews.

## 1. Summary

Relay opens pull requests against customer code. Today it validates a change only statically: it parses the file and checks the literal it changed. It never builds the site, so a change can still break the build or render differently than expected. The proposed release-assurance repair loop needs this evidence even while every write and merge remains human reviewed.

This RFC first connects a Relay proposal to checks on the customer's own preview for the exact commit. A later slice may build and serve previews on Cloudflare:

- **Path A:** when the customer's platform already builds previews (Vercel, Netlify, Cloudflare Pages or Workers Builds), Relay uses them.
- **Path B:** otherwise Relay builds the change itself in an isolated Cloudflare Container, serves the result from Workers for Platforms or from the container, checks it against production, and removes it afterwards.

The initial service uses **phase 1a, Path A only**. Phase 0 is a later feasibility gate for Relay-owned builds, not a prerequisite for customer previews. A person authorizes the exact branch/PR write before it triggers customer CI. Preview success then informs the separate customer merge decision. No standing approval or automatic merge is required.

## 2. What exists today

| Part                     | Location                                                                                                     | Use in this RFC                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Static validation        | `src/server/features/publishing/nextMetadata.ts`, `docs/maintainers/specs/approved-github-metadata.md`       | Parses and reparses the changed file. States that it is not a build. |
| Preview checks           | RFC-0010 and RFC-0015                                                                                        | Compare a preview with production. Need a preview URL.               |
| Deployment events        | RFC-0005 deployment signals, RFC-0010 phase 2 App webhooks                                                   | Find the customer's own previews.                                    |
| Untrusted-work isolation | The separate `open-seo-audit` Worker, which gets only the secrets it needs (`deploy/alchemy/alchemy.run.ts`) | The pattern for a separate preview Worker.                           |
| Relay's own previews     | `docs/maintainers/preview-deployments.md` (Alchemy stages behind Cloudflare Access)                          | Path A for Relay itself.                                             |

**Cloudflare products used:**

| Product                                                     | Role                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Containers, through the Sandbox SDK (`@cloudflare/sandbox`) | Run untrusted install and build steps. `exposePort()` gives preview URLs, which need a custom domain with wildcard DNS (not `workers.dev`) and are public by default. |
| Workers for Platforms                                       | Serve built output as user Workers in a dispatch namespace. User Workers run in untrusted mode. An outbound Worker can filter their `fetch()` calls.                  |
| R2                                                          | Source archives, build logs and the dependency cache.                                                                                                                 |
| Workflows                                                   | Durable steps for each build.                                                                                                                                         |

## 3. Goals

1. Show "Verified on a preview" only for the exact tested proposal/commit, before the customer approves merge. Initial branch/PR write approval is a separate preceding action.
2. Use the customer's own previews when they exist. Build only when they do not.
3. Run customer code only in containers, with no secrets inside.
4. Serve previews on a separate domain, never indexed, behind a signed link.
5. Remove every preview when its pull request closes, or after 7 days.
6. Keep the cost per build known and capped.

## 4. Non-goals

1. No hosting product. Previews are short-lived.
2. No previews for apps that need private services to render (databases, logins, internal APIs).
3. No production deployment.
4. In phases 1 and 2, previews only for Relay's own changes. Previews for any pull request are phase 3.

## 5. Design

### 5.1 Phases

| Delivery order / phase | Delivers                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First: 1a              | Path A only: approved branch/PR, customer preview bound to its head commit, required CI checks, rendered postcondition, explicit failed/unavailable/stale states. No Relay build infrastructure. |
| Later: 0               | Isolation, framework, runtime, outbound control, teardown, and cost spike from 5.12, only if customer demand warrants Path B.                                                                    |
| After 0: 1b            | Path B for static/OpenNext output, verification, access controls, and teardown.                                                                                                                  |
| 2                      | Path B Node-server output and per-project dependency cache.                                                                                                                                      |
| 3                      | Broader pull-request preview hosting through the release gate, if demand justifies it.                                                                                                           |

### 5.2 Choosing the path

Store `preview_mode` per publishing connection: `customer_platform`, `relay_build` or `none`.

1. **Detect.** Read the deployments of the last 10 pull requests in the repository. When pull request head commits have successful deployments with an `environment_url` in a non-production environment, set `customer_platform`.
2. Only after phase 0/1b acceptance and owner opt-in, when the build checks in 5.4 pass, offer `relay_build`. Phase 1a never falls back to Relay-owned execution.
3. Otherwise set `none`, with the reason (for example "The app needs bindings that a preview cannot provide").
4. Owners can change the mode. Every change writes an audit event.

### 5.3 Path A: the customer's previews

1. After explicit approval of the exact proposal's branch/PR write, use the existing publisher to create that branch and PR. This is compatible with platforms that only build after a PR opens. Do not push a branch before authorization merely to obtain a preview.
2. Wait at most 30 minutes for the customer's successful deployment status for the exact head SHA and a non-production preview URL. Validate repository/environment ownership and allowed URL targets; never trust an arbitrary status URL as production or as authorization to send credentials.
3. Reuse RFC-0010 protected-preview access, required CI checks, and RFC-0010/0015 rules. Verify the proposed rendered field, accounting for supported templates/helpers and preview-specific noindex policy. A build status alone is not a rendered verification.
4. Store proposal fingerprint, repository, source/head SHA, deployment identity/URL, CI check references, rule result, observed time, and expiry. Extend normalized preview records for external builds without requiring sandbox configuration or R2 logs.
5. Any changed proposal/base/head, newer preview, expired result, revoked connection, failed required check, or unavailable render invalidates readiness. Show `pending`, `passed`, `failed`, `unavailable`, or `stale` with evidence and the next action. Never present unknown as passed.
6. If no customer preview is available, keep the finding/PR and explain the unsupported verification path. The customer retains GitHub authority, but Relay does not label it preview-verified or count it as an accepted preview-gated repair. An explicitly supported manual evidence path must be labeled separately.
7. The customer reviews and merges; production verification is RFC-0028. Customer-hosted preview cleanup remains with that platform. Relay expires its references and revokes any access material it owns.

### 5.4 Path B: the build pipeline (deferred phase 1b)

A separate Worker, `relay-preview`, owns the pipeline. Like the audit Worker, it gets only the secrets it needs: the GitHub App key for read tokens, the R2 binding, the Sandbox binding and the Workers for Platforms API token. It runs each build as a Cloudflare Workflow.

**Step 1: source.**

1. Mint a GitHub App installation token with `contents: read` only, for one repository, for this step only.
2. Download the archive of the base commit (`GET /repos/{owner}/{repo}/tarball/{sha}`).
3. For a change that is not yet a pull request, store the proposal's changed files (the exact "after" contents) as an overlay.
4. Write the archive and the overlay to R2 under `previews/{buildId}/`. Discard the token. It never enters the container.

**Step 2: build in a container.**

1. Start one sandbox per build from a pinned image `relay-preview-builder`: Node 22 with Corepack (pnpm, Yarn), npm, git, and Hugo for static sites.
2. Download the archive and the overlay with signed R2 links that expire in 10 minutes. Apply the overlay.
3. Find the workspace root and the app directory from the connection's root directory.
4. Require a lockfile. Choose the package manager from it: `pnpm-lock.yaml`, `package-lock.json` or `yarn.lock`. Refuse repositories without one.
5. Install with the frozen lockfile (`pnpm install --frozen-lockfile`, `npm ci`, `yarn install --immutable`).
6. Find the framework from the app's dependencies, and choose the build:

   | Found                                                       | Build                         | Output                       | Phase |
   | ----------------------------------------------------------- | ----------------------------- | ---------------------------- | ----- |
   | `@opennextjs/cloudflare`                                    | `opennextjs-cloudflare build` | Worker and assets            | 1     |
   | Astro with static output, Vite, or another static generator | The `build` script            | A static folder              | 1     |
   | Hugo config                                                 | `hugo`                        | A static folder              | 1     |
   | `next` without a Cloudflare adapter                         | `next build`                  | A Node server                | 2     |
   | Anything else                                               | None                          | Mode `none`, with the reason | —     |

7. Environment: `CI=1`, `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, and the customer's preview values (5.7). Nothing else.
8. Limits: 15 minutes per build, and the instance size chosen in the spike. Stop the container at the limit.
9. Keep the last 200 log lines in R2 for 7 days. Mask every preview value in them. Store a short error summary on the build row.

**Step 3: publish (phase 1b).**

1. Upload the output as a user Worker in the dispatch namespace `relay-previews`, named `p-{project}-{build}`, with static assets.
2. Give it no bindings except its assets. Use the compatibility date and flags from the customer's Wrangler file when one exists.
3. When the customer's Worker needs other bindings (KV, R2, D1, queues), stop and set the reason: "The app needs services that a preview cannot provide."
4. Destroy the sandbox. A static or OpenNext preview runs without a container.

**Step 4: serve.**

1. Register a separate domain for previews, owned by Playbook Media on Cloudflare, so that customer code never runs on a Relay domain or shares its cookies.
2. A dispatch Worker on `*.{previewDomain}` maps `{buildId}.{previewDomain}` to the user Worker.
3. Access: a signed token in the first link sets a cookie for that host only. Without it, return 404. Links expire with the preview.
4. Every response gets `X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`.
5. An outbound Worker blocks private and reserved address ranges, logs outbound hosts, and caps outbound requests per page load.

**Step 5: verify.**

1. Run the RFC-0010 rules, comparing the preview with production, on the changed pages and the key pages (at most 20).
2. Check that each change renders. For example, the new description appears in the preview's `<meta name="description">`.
3. Store the result. Show "Verified on a preview" only when the change renders and no blocking rule fails.

**Step 6: tear down.**

1. Delete the user Worker when the pull request closes or merges, or after 7 days.
2. R2 lifecycle rules delete `previews/` objects after 7 days.
3. A daily task deletes anything that the event path missed.

### 5.5 Node server previews (phase 2)

1. Keep the sandbox running and start the server (`next start -p 3000`).
2. Expose the port with `exposePort()` on the preview domain, with a fixed token per build.
3. Put the same access check, `noindex` header and outbound limits in front of it.
4. The sandbox sleeps after 10 minutes without requests. The preview expires after 24 hours.
5. At most 3 running Node previews per organization.

### 5.6 Dependency cache (phase 2)

1. Cache the package store per project in R2, keyed by the lockfile hash and the image version.
2. Never share a cache between projects, because a shared cache could carry one customer's tampered packages to another.
3. Delete caches after 30 days without use.

### 5.7 Preview values

Many builds need environment values, for example a public API base URL.

1. `preview_env_vars`: `id`, `project_id` (FK cascade), `name`, `encrypted_value`, `key_version`, `created_by`, `created_at`. Encrypt with the RFC-0009 key.
2. The settings page says: "Use only values that are safe in a public preview. Never enter production secrets."
3. Inject them only into that project's sandbox, and mask them in logs.

### 5.8 Data model

| Table                   | Columns                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preview_builds`        | `id`, `project_id` (FK cascade), `proposal_id` (nullable FK), `pull_request` (nullable), `source_sha`, `overlay_hash`, `path` (`customer_platform`, `relay_static`, `relay_opennext`, `relay_node`), `framework`, `package_manager`, `status` (`queued`, `fetching`, `building`, `publishing`, `ready`, `failed`, `expired`), `preview_host`, `started_at`, `finished_at`, `duration_ms`, `error_summary`, `log_r2_key`, `expires_at` |
| `preview_verifications` | `id`, `build_id` (FK cascade), `checked_at`, `change_rendered`, `blocking_count`, `warning_count`, `ci_check_run_id` (nullable FK to RFC-0010 runs)                                                                                                                                                                                                                                                                                   |
| `preview_env_vars`      | 5.7                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Add `preview_mode` and `preview_mode_reason` to `publishing_connections`.

### 5.9 Changes to other RFCs

1. **RFC-0005/0027:** preserve explicit authorization for the initial branch/PR write. Show exact-commit preview status before the customer's merge decision. Missing previews remain explicit.
2. **RFC-0018:** deferred policies consume preview evidence; previews do not depend on policies. No restore exception permits automatic merging without current passed evidence.
3. **RFC-0010/0015:** reuse existing check runners and rule packs, with exact proposal/commit linkage.
4. **RFC-0019/0028:** preview checks establish readiness; only subsequent production checks establish repair resolution.
5. **RFC-0021:** later new pages must render before approval to merge; preliminary repository writes still require authorization.

### 5.10 Limits and plans

| Limit                                  | Default                                       |
| -------------------------------------- | --------------------------------------------- |
| Builds per month                       | Set per plan from the spike's cost per build. |
| Parallel builds per organization       | 2                                             |
| Build time                             | 15 minutes                                    |
| Preview lifetime                       | 7 days (static, OpenNext), 24 hours (Node)    |
| Running Node previews per organization | 3                                             |

Builds use RFC-0009 admission, so a project limit stops them before they start.

### 5.11 Abuse controls

1. A build is stopped at its time limit, and repeated limit hits pause builds for the project.
2. Builds start only for repositories connected to a project, for Relay's own changes (phases 1 and 2).
3. Outbound hosts per build are logged and reviewed for patterns such as mining pools.
4. An operator can disable builds per organization.

### 5.12 Spike (phase 0)

Confirm, and record in the PR:

1. The current Container instance sizes and prices. A Next.js build needs about 2 to 4 GB of memory.
2. Whether Containers can enforce the required isolation and outbound controls. If trusted-network isolation or abuse/cost bounds cannot be demonstrated, do not enable Path B; retain customer previews. An absence of injected secrets alone does not prove safe execution.
3. The Sandbox SDK methods for files, commands and ports, and the sleep setting.
4. That an OpenNext build deploys to Workers for Platforms with static assets, and that a static site does too.
5. Build time and cost for S1.
6. The Workers for Platforms plan needed, and its limits on user Workers.

## 6. Security

For phase 1a, validate the preview URL and redirects, scope bypass credentials to the configured host, recheck tenant/repository authorization, and bind results to the exact head commit. The following container/serving requirements apply when Path B is enabled.

1. Customer code and its install scripts run only in containers, never in Relay's Workers.
2. No Relay secret, GitHub token or production value enters a container. The source arrives through expiring R2 links.
3. Previews run on a separate domain, in untrusted user Workers with no bindings, behind signed links.
4. Every preview sends `noindex` and is deleted on schedule.
5. Logs mask preview values. Build logs are visible only to members of the project's organization.
6. A canary test: a seeded build script tries to read environment values, files and internal endpoints. It must find nothing secret.

## 7. Cost

Phase 1a uses customer CI compute plus bounded GitHub reads and Relay check/render costs. Paid checks retain RFC-0009 admission; disclose the cost and unavailable states. There is no Relay container/build cost in that slice.

Container time per build, Workers for Platforms requests for previews, and small R2 storage. The spike records the median and 95th-percentile cost per build. Plans set their build allowance from it.

## 8. Alternatives considered

1. **Build in the customer's GitHub Actions.** It needs changes to their workflows and runs near their secrets. Offer it later as an option, not as the default.
2. **Build on Trigger.dev machines.** Possible, but the serving side would still need Cloudflare, and the owner prefers one platform.
3. **One Cloudflare Pages project per customer.** Simple for static sites, but Pages projects per account are limited, and the URLs share `pages.dev`. Workers for Platforms fits many tenants better.
4. **Serve previews from Relay's main Worker or domain.** Rejected. Untrusted code must not run on Relay's domain.
5. **Only static validation.** Insufficient for a preview-verified repair: a parsed edit may still fail the build or render differently. Initial repairs remain human reviewed.

## 9. Ready-for-other-users checklist

### Phase 1a: customer previews first

- [ ] Normalize external preview identity, proposal fingerprint, exact commit, check references, result, and expiry in both database dialects.
- [ ] Explicit approval precedes branch/PR creation; no preview discovery bypasses write authorization.
- [ ] Detect the correct repository, head SHA, non-production deployment, and allowed URL; support the existing protected-preview access method.
- [ ] Required build/CI and rendered/rule checks show passed, failed, unavailable, or stale results accurately.
- [ ] Changes to proposal/head/base, revoked permissions, expired checks, and duplicate events invalidate or deduplicate correctly.
- [ ] The review surface links exact evidence and distinguishes preview readiness from production verification.
- [ ] No-preview sites receive a useful finding and explicit unsupported/manual status; no automatic sandbox fallback.
- [ ] Phase 1a acceptance and user documentation complete without a container, preview domain, or standing-approval setting.

### Phase 0: later Path B feasibility gate

- [ ] Spike results for every item in 5.12, including bounded cost, isolation, and the go/no-go decision.
- [ ] Preview domain and access design verified before enabling hosted customer code.

### Phase 1b: Relay-owned builds (deferred)

- [ ] `preview_builds`, `preview_verifications`, `preview_env_vars`, and connection columns complete for hosted builds in D1 and Postgres.
- [ ] Separate preview Worker with minimal secrets; no GitHub credential reaches the build container.
- [ ] Pinned builder, lockfile/framework limits, request/compute bounds, and refusal of unsupported bindings.
- [ ] Separate-domain serving, signed access, `noindex`, `no-store`, outbound controls, and canary test pass.
- [ ] Exact-overlay/commit verification and explicit authorization before any repository write.
- [ ] Teardown on merge, close, expiry, cancellation, and failure; reconciliation sweep and cost reporting.
- [ ] Proposal view and hosted-preview documentation match actual supported frameworks and limits.

### Phase 2

- [ ] Node server previews with sleep, expiry and the per-organization cap.
- [ ] Per-project dependency cache, never shared (test).

### Phase 3

- [ ] Previews for any pull request through the release gate.

## 10. Real-site acceptance test

### Phase 1a

Use an authorized Next.js repository whose customer platform builds PR previews. Prepare a source-mapped repair, approve the exact branch/PR write, and confirm Relay finds the preview for that head SHA. Run the repository's required checks and verify the intended rendered value. Change the PR head and ensure the old result becomes stale. Test a failed build, missing preview, wrong SHA/environment, revoked access, and protected-preview access; none may appear passed or leak a bypass credential. No Relay-owned build or standing policy is required.

Pass when the reviewer can trace proposal → approved write → exact commit → preview/check result, and only a current passing result is labeled verified on preview. After the customer merges, RFC-0028 independently establishes production resolution.

### Phase 1b (deferred)

**Sites:** S1 for Path B (OpenNext on Cloudflare), a Vercel test repository for Path A, and S3 for the refusal and the protected Path A.

**Steps:**

1. On S1 staging, prepare a description proposal and build its overlay preview without a repository write. Obtain exact-change authorization before any later branch/PR creation.
2. Open the preview link. Check the page and its headers.
3. Seed a second S1 proposal that breaks the build (an invalid literal in a copied file on a test branch). Build it.
4. On the Vercel test repository, let Relay open a pull request and use the platform preview.
5. On S3, run mode detection.
6. Run the canary build on a test repository.
7. Close the S1 pull request.

**Pass when:**

- The S1 preview builds, renders the new description, and passes the RFC-0010 rules.
- The preview responds with `noindex` and `no-store`, and returns 404 without the signed link.
- The broken proposal fails with a clear build error and cannot be presented as ready for merge. Any later policy feature must obey the same failure result.
- Relay uses the Vercel preview with no build of its own.
- S3 reports that its previews come from its own platform, or that a Relay build is not possible, with the reason.
- The canary finds no secret.
- The S1 preview disappears within 1 hour of closing the pull request.

**Value check:** the customer sees their site with the exact change applied and checked before deciding to merge it. Authorization for preliminary branch/PR writes remains explicit.

## 11. Completion criteria

**Phase 1a**

- Every passed result names the exact tested proposal/commit, build/check evidence, and rendered postcondition.
- Failed, unavailable, stale, and unauthorized cases never display as passed; no repository write precedes authorization.
- A broken change is caught before merge on an authorized test repository.
- Customer-preview wait/check latency and paid check cost are measured; timeout is visible and bounded.

The hosted-build reliability, speed, isolation, and teardown criteria below apply to phase 1b/2 and are not phase-1a prerequisites. Policy criteria apply only if the deferred RFC-0018 feature is enabled.

**Reliability**

- At least 90% of builds succeed on supported repositories across 20 builds (S1 and fixture repositories).
- Every failed build shows a reason that a developer understands without the full log.

**Speed and cost**

- S1 builds in under 5 minutes at the median and under 10 minutes at the 95th percentile.
- The median cost per build is recorded and within the budget set in the spike.

**Safety**

- 0 secrets found by the canary test.
- 100% of preview responses carry `noindex` and need the signed link.
- 100% of previews are deleted on close, merge or expiry.

**Effect**

- 0 policy-driven merges without current passed preview and required checks; any preliminary policy-authorized branch/PR write is explicitly scoped and never labeled verified before the checks pass.
- At least 1 broken change is caught by a preview build before merge during the test.
