# RFC-0025: Preview sandboxes on Cloudflare

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** execution safety. Every change that Relay proposes should build and render before anyone approves it.
- **Depends on:** RFC-0005 (GitHub App tokens and proposals), RFC-0008 (tasks), RFC-0009 (encryption key, audit log, limits), RFC-0010 and RFC-0015 (checks against a preview), RFC-0018 (standing approvals).

## 1. Summary

Relay opens pull requests against customer code. Today it validates a change only statically: it parses the file and checks the literal it changed. It never builds the site, so a change can still break the build or render differently than expected. Standing approvals (RFC-0018) and automatic restores (RFC-0019) make this gap more important.

This RFC adds a preview for every Relay change, on Cloudflare:

- **Path A:** when the customer's platform already builds previews (Vercel, Netlify, Cloudflare Pages or Workers Builds), Relay uses them.
- **Path B:** otherwise Relay builds the change itself in an isolated Cloudflare Container, serves the result from Workers for Platforms or from the container, checks it against production, and removes it afterwards.

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

1. Show "Verified on a preview" on a proposal before a person approves it.
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

| Phase | Delivers                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | A spike that confirms the open questions in 5.12.                                                                                                             |
| 1     | Path A detection and use. Path B for Cloudflare-ready output (static sites and OpenNext builds) served from Workers for Platforms. Verification and teardown. |
| 2     | Path B for Node server output, served from the container. A per-project dependency cache.                                                                     |
| 3     | Previews for any pull request, as part of the RFC-0015 release gate.                                                                                          |

### 5.2 Choosing the path

Store `preview_mode` per publishing connection: `customer_platform`, `relay_build` or `none`.

1. **Detect.** Read the deployments of the last 10 pull requests in the repository. When pull request head commits have successful deployments with an `environment_url` in a non-production environment, set `customer_platform`.
2. Otherwise, when the build checks in 5.4 pass in a trial build, set `relay_build`.
3. Otherwise set `none`, with the reason (for example "The app needs bindings that a preview cannot provide").
4. Owners can change the mode. Every change writes an audit event.

### 5.3 Path A: the customer's previews

1. After Relay pushes its branch, wait for a successful deployment status for the head commit with an `environment_url`.
2. Wait at most 30 minutes. Then mark the preview "not available" and, when allowed, fall back to Path B.
3. Use the RFC-0010 protected-preview access methods (a bypass header or a Cloudflare Access service token).
4. For checks before a pull request exists, Path A needs a branch. Relay pushes its branch, but opens the pull request only after the preview passes. The branch name stays the deterministic RFC-0005 name.

### 5.4 Path B: the build pipeline

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

**Step 3: publish (phase 1).**

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

1. **RFC-0005:** the proposal panel offers "Build preview" before approval, and the approval view shows the result. When previews are not available, a person can still approve, with a warning.
2. **RFC-0018:** standing approvals at `open_pr` for content classes (`meta_description`, `meta_title`, `alt_text`, `html_lang`, `internal_link`) need a passed preview. `restore_regression` can open a pull request without one, because it restores a value that was live before. `merge` always needs a passed preview when the project supports previews.
3. **RFC-0010 and RFC-0015:** Relay-built previews are valid targets for the checks.
4. **RFC-0019:** restores build a preview before the pull request opens, when the mode allows it.
5. **RFC-0021:** a new page must render on a preview before approval.

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
2. Whether Containers can limit outbound network access. When they cannot, keep the sandbox free of secrets and accept open outbound access during builds.
3. The Sandbox SDK methods for files, commands and ports, and the sleep setting.
4. That an OpenNext build deploys to Workers for Platforms with static assets, and that a static site does too.
5. Build time and cost for S1 (`PlaybookMediaLLC/monorepo`, root `apps/www`).
6. The Workers for Platforms plan needed, and its limits on user Workers.

## 6. Security

1. Customer code and its install scripts run only in containers, never in Relay's Workers.
2. No Relay secret, GitHub token or production value enters a container. The source arrives through expiring R2 links.
3. Previews run on a separate domain, in untrusted user Workers with no bindings, behind signed links.
4. Every preview sends `noindex` and is deleted on schedule.
5. Logs mask preview values. Build logs are visible only to members of the project's organization.
6. A canary test: a seeded build script tries to read environment values, files and internal endpoints. It must find nothing secret.

## 7. Cost

Container time per build, Workers for Platforms requests for previews, and small R2 storage. The spike records the median and 95th-percentile cost per build. Plans set their build allowance from it.

## 8. Alternatives considered

1. **Build in the customer's GitHub Actions.** It needs changes to their workflows and runs near their secrets. Offer it later as an option, not as the default.
2. **Build on Trigger.dev machines.** Possible, but the serving side would still need Cloudflare, and the owner prefers one platform.
3. **One Cloudflare Pages project per customer.** Simple for static sites, but Pages projects per account are limited, and the URLs share `pages.dev`. Workers for Platforms fits many tenants better.
4. **Serve previews from Relay's main Worker or domain.** Rejected. Untrusted code must not run on Relay's domain.
5. **Only static validation.** Rejected now that standing approvals and restores can act without a click.

## 9. Ready-for-other-users checklist

### Phase 0

- [ ] Spike results for every item in 5.12, recorded in the PR.
- [ ] Preview domain registered on Cloudflare.

### Phase 1

- [ ] `preview_builds`, `preview_verifications`, `preview_env_vars` and the connection columns in D1 and Postgres.
- [ ] Mode detection from recent pull request deployments (tests).
- [ ] Path A wait, timeout and fallback (tests).
- [ ] `relay-preview` Worker with only its listed secrets.
- [ ] Source step with a read-only, one-repository token that never reaches the container (test).
- [ ] Builder image, lockfile rules, framework detection and the 15-minute limit (tests with fixture repositories).
- [ ] Publish to Workers for Platforms with assets and no bindings, and the refusal for apps that need bindings (tests).
- [ ] Dispatch Worker with signed access, `noindex`, `no-store` and the outbound Worker (tests).
- [ ] Verification with the RFC-0010 rules and the render check.
- [ ] Teardown on close, merge and expiry, and the daily sweep (tests).
- [ ] Proposal panel and approval view show the preview result.
- [ ] RFC-0018 policy rule for content classes enforced (test).
- [ ] Canary security test passes.
- [ ] `content/docs/previews.mdx`.

### Phase 2

- [ ] Node server previews with sleep, expiry and the per-organization cap.
- [ ] Per-project dependency cache, never shared (test).

### Phase 3

- [ ] Previews for any pull request through the release gate.

## 10. Real-site acceptance test

### Phase 1

**Sites:** S1 for Path B (OpenNext on Cloudflare), a Vercel test repository for Path A, and S3 for the refusal and the protected Path A.

**Steps:**

1. On S1, prepare a description proposal. Build its preview before opening the pull request.
2. Open the preview link. Check the page and its headers.
3. Seed a second S1 proposal that breaks the build (an invalid literal in a copied file on a test branch). Build it.
4. On the Vercel test repository, let Relay open a pull request and use the platform preview.
5. On S3, run mode detection.
6. Run the canary build on a test repository.
7. Close the S1 pull request.

**Pass when:**

- The S1 preview builds, renders the new description, and passes the RFC-0010 rules.
- The preview responds with `noindex` and `no-store`, and returns 404 without the signed link.
- The broken proposal fails with a clear build error, and no pull request opens under a standing approval.
- Relay uses the Vercel preview with no build of its own.
- S3 reports that its previews come from its own platform, or that a Relay build is not possible, with the reason.
- The canary finds no secret.
- The S1 preview disappears within 1 hour of closing the pull request.

**Value check:** the customer sees their own site, with Relay's change applied and checked, before anyone approves it.

## 11. Completion criteria

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

- 0 pull requests opened under a standing approval for content classes without a passed preview.
- At least 1 broken change is caught by a preview build before it reaches a pull request during the test.
