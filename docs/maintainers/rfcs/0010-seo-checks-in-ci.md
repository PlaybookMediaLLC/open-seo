# RFC-0010: SEO checks on pull requests

- **Status:** Draft
- **Date:** 2026-10-15
- **Brief sections:** 5 and 6 (agent and execution), extended to prevention
- **Depends on:** RFC-0008 (Trigger.dev tasks and signed internal endpoints) and RFC-0009 (audit log, rate limits). Phase 2 depends on the RFC-0005 GitHub App.

## 1. Summary

SEO damage usually ships in an ordinary pull request: a stray `noindex`, a changed canonical tag, a removed title, a broken link or invalid structured data. Crawlers and monitoring tools find it after release, and auto-fix tools patch it after the damage. This RFC adds a check that compares a pull request's preview deployment with production before merge, ranks each finding by the page's real Search Console traffic, and fails the build on blocking regressions.

It works for any framework, because it checks rendered HTML. Developers can install it alone, so it is also a way for new teams to find Relay.

## 2. What exists today

| Part                | Location                                                                                  | Use in this RFC                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| HTML analysis       | `src/server/lib/audit/page-analyzer.ts`, `analyzeHtml` (htmlparser2, no runtime bindings) | Extract title, description, canonical, robots, headings, links and structured data from both pages. |
| URL safety          | `src/server/lib/audit/url-policy.ts`, `normalizeAndValidateStartUrl`                      | Check every fetched URL and redirect hop.                                                           |
| Audit issue rules   | `src/server/lib/audit/issues/`                                                            | Rule names and wording to stay consistent with site audits.                                         |
| Search Console data | `GscService`, stored opportunity evidence                                                 | Clicks and impressions for each checked page.                                                       |
| Key pages           | `project_key_pages`                                                                       | Pages to check on every run.                                                                        |
| API keys            | `src/lib/auth-api-key.ts`                                                                 | User-level keys. Too broad for CI, so this RFC adds project-scoped CI tokens.                       |
| Rate limits         | `MCP_RATE_LIMIT` in `deploy/alchemy/alchemy.run.ts`                                       | Pattern for a CI token limit.                                                                       |
| Background tasks    | RFC-0008 Trigger.dev tasks and signed internal endpoints                                  | Run the check outside the request.                                                                  |

Preview deployments differ by host. Vercel adds `X-Robots-Tag: noindex` to preview deployments by default. Relay's own previews sit behind Cloudflare Access. Test site S1 deploys a staging copy to `www-staging.yoanyomba.workers.dev`.

## 3. Goals

1. Catch SEO regressions in a pull request before merge, on any framework.
2. Rank findings by the page's real search traffic, which no generic checker knows.
3. Produce no false blocking finding on an ordinary pull request.
4. Finish in under 3 minutes for 50 pages.
5. Install with one workflow step and one secret.
6. Later, run with no setup through the GitHub App on Vercel, Netlify and Cloudflare previews.

## 4. Non-goals

1. No performance scoring. Lighthouse CI covers it.
2. No content quality scoring.
3. No full-site crawl. The site audit covers it.
4. No automatic fixes. Findings link to Relay, where a person can create a ticket or a proposal.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 1     | GitHub Action, CI tokens, check API, Trigger.dev task, rules, run history.                                     |
| 2     | GitHub App mode: automatic runs from deployment events, Check Runs with annotations.                           |
| 3     | Optional rendered mode with a headless browser for client-rendered pages. Base-branch preview as the baseline. |

### 5.2 Flow (phase 1)

1. The customer adds one step to the workflow that deploys the preview:

   ```yaml
   - uses: PlaybookMediaLLC/relay-seo-check@v1
     with:
       token: ${{ secrets.RELAY_CI_TOKEN }}
       preview-url: ${{ steps.deploy.outputs.url }}
       fail-on: blocking # blocking | warning | never
   ```

2. The action collects the changed files with `git diff --name-only` against the base branch (at most 300 paths).
3. It calls `POST /api/ci/v1/checks` with the token, the preview URL, the repository, the pull request number, the head SHA and the changed files.
4. The Worker checks the token, the preview host and the plan quota. It stores a `queued` run. It triggers the Trigger.dev task `seo-check` with the idempotency key `{projectId}:{headSha}:{previewOriginHash}`. It returns the run id.
5. The action polls `GET /api/ci/v1/checks/{runId}` every 10 seconds, for at most 10 minutes.
6. The task selects the URLs, fetches each page on production and on the preview, runs the rules, and posts the results to the signed internal endpoint `POST /api/internal/ci/results`.
7. The action writes a Markdown summary to `$GITHUB_STEP_SUMMARY`, prints each finding, and exits with a failure according to `fail-on`.

The action is a composite action in a new public repository, `PlaybookMediaLLC/relay-seo-check`. It uses only `curl` and `jq`, which GitHub runners include. Tag each release, and document pinning by commit SHA.

### 5.3 URL selection

Check at most 100 URLs per run. Record why each URL was chosen.

1. **Changed pages.** Map changed App Router and Pages Router files to URL paths. Drop route groups. For a dynamic segment, take up to 5 matching URLs from the production sitemap. Files of other frameworks are not mapped.
2. **Key pages.** All project key pages, `money` and `hub` first.
3. **Top traffic.** The 30 pages with the most Search Console clicks in the last 28 days. Use stored data when the latest opportunity run is under 7 days old. Otherwise make one free Search Console request.
4. **Sample.** 10 sitemap URLs, chosen with the head SHA as the random seed, so a re-run checks the same pages.

### 5.4 Fetching

1. **Hosts.** The base host must be the project's domain. The preview host must be on the project's allowlist: the project domain and its subdomains, `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, `*.workers.dev`, and hosts that an owner adds. Anything else is refused, so Relay cannot be used as an open fetch proxy.
2. **Safety.** Check every URL and every redirect hop with the URL policy. Follow at most 3 hops.
3. **Protected previews.** An owner can store one access method per project, encrypted with the RFC-0009 key: a header name and value (for example `x-vercel-protection-bypass`), or a Cloudflare Access service token pair. Send it only to the preview host.
4. **Limits.** 4 parallel requests per host. 10-second timeout. 2 MB maximum body. HTML responses only.
5. **Identity.** User agent `RelaySEOCheck/1.0 (+https://relay.playbookmedia.io/docs/seo-checks)`.
6. Fetch `robots.txt` and the sitemap (from `robots.txt`, or `/sitemap.xml`) on both hosts.

### 5.5 Normalization

1. Replace the preview origin with the production origin in canonical, `hreflang` and `og:url` values before comparing them.
2. Ignore `X-Robots-Tag` on known preview hosts, because platforms add `noindex` there. An owner can turn this check on per project.
3. Compare paths only. Ignore query strings and fragments.
4. Trim and collapse whitespace in text values.

### 5.6 Rules

**Blocking:**

| Rule                  | Fails when                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `newly-noindex`       | The page's meta robots has `noindex` on the preview and not on production.                                  |
| `canonical-changed`   | The normalized canonical differs from production, or was removed.                                           |
| `status-regressed`    | Production returns 200 and the preview returns 4xx or 5xx.                                                  |
| `newly-redirected`    | Production returns 200 and the preview redirects.                                                           |
| `robots-txt-blocks`   | The preview `robots.txt` disallows a checked URL that production allows, for Googlebot.                     |
| `title-removed`       | Production has a title, and the preview has none.                                                           |
| `description-removed` | Production has a meta description, and the preview has none.                                                |
| `json-ld-invalid`     | A JSON-LD block that parses on production fails to parse on the preview, or a top-level `@type` disappears. |
| `sitemap-shrunk`      | The preview sitemap is missing, or lists fewer than 90% of production's URLs.                               |

**Warning:**

| Rule                                   | Warns when                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `title-changed`, `description-changed` | The text changed. Show both values and flag lengths outside 10 to 60 (title) and 70 to 160 (description) characters. |
| `h1-changed`, `multiple-h1`            | The H1 text changed, or a second H1 appeared.                                                                        |
| `internal-links-dropped`               | Internal links on the page fell by 30% or more.                                                                      |
| `broken-internal-link`                 | A link that is new on the preview page returns 4xx or 5xx on the preview. Check at most 200 links per run.           |
| `hreflang-changed`                     | The normalized `hreflang` set changed.                                                                               |
| `og-removed`                           | `og:title` or `og:image` disappeared.                                                                                |
| `content-shrunk`                       | Visible text fell by 50% or more. This can mean client-only rendering.                                               |

### 5.7 Traffic weighting

1. Every finding shows the page's clicks and impressions for the last 28 days and its key-page role.
2. Sort findings by impressions, highest first.
3. Mark pages with 1,000 or more impressions, and `money` key pages, as "High-traffic page".
4. Raise `internal-links-dropped` and `content-shrunk` to blocking on high-traffic pages. An owner can turn this off.

### 5.8 Overrides and ignore rules

1. A pull request label `relay-seo-override` turns blocking findings into a passing run. The action reports the label, and Relay writes an RFC-0009 audit event with the actor and the pull request.
2. Owners can add ignore rules: a rule id and a path pattern. Every change writes an audit event.

### 5.9 Data model

| Table               | Columns                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci_tokens`         | `id`, `project_id` (FK cascade), `name`, `token_hash`, `display_prefix` (`relay_ci_` plus 4 characters), `created_by`, `created_at`, `last_used_at`, `revoked_at`                                                                                                       |
| `ci_check_runs`     | `id`, `project_id`, `token_id`, `repository`, `pull_request`, `head_sha`, `preview_origin`, `base_origin`, `status` (`queued`, `running`, `succeeded`, `failed`), `blocking_count`, `warning_count`, `url_count`, `override_used`, `started_at`, `finished_at`, `error` |
| `ci_check_urls`     | `id`, `run_id` (FK cascade), `path`, `reason` (`changed_file`, `key_page`, `top_traffic`, `sitemap_sample`), `base_status`, `preview_status`, `clicks_28d`, `impressions_28d`                                                                                           |
| `ci_check_findings` | `id`, `run_id` (FK cascade), `path`, `rule`, `severity` (`blocking`, `warning`), `before_value`, `after_value` (each at most 300 characters), `message`                                                                                                                 |
| `ci_check_ignores`  | `id`, `project_id`, `rule`, `path_pattern`, `created_by`, `created_at`                                                                                                                                                                                                  |
| `ci_preview_access` | `id`, `project_id`, `kind` (`header`, `cf_access`), `header_name`, `encrypted_value`, `key_version`                                                                                                                                                                     |
| `ci_preview_hosts`  | `id`, `project_id`, `host`, `created_by`, `created_at`                                                                                                                                                                                                                  |

Unique on `ci_check_runs` (`project_id`, `head_sha`, `preview_origin`). Delete runs older than 90 days in the RFC-0008 retention task.

### 5.10 API and limits

1. `POST /api/ci/v1/checks` and `GET /api/ci/v1/checks/{id}`. Bearer CI token. Zod-validated bodies.
2. A CI token can only create and read runs for its own project.
3. Rate limit per token with a new Alchemy binding `CI_CHECK_RATE_LIMIT` (10 requests per minute).
4. Plan quota: 30 runs per month on the free plan, 1,000 on paid plans. Over quota, return a clear message with a link to Billing. The action prints it and passes, so a quota never blocks a customer's merge.
5. A failed Relay run never fails the customer's job unless `fail-on` is `warning`. Print "Relay could not complete the check: {reason}."

### 5.11 User interface

Project settings → new **SEO checks** tab:

1. Create and revoke CI tokens. Show a new token once.
2. Copy-ready workflow snippet with the project's values.
3. Allowed preview hosts and the protected-preview access method.
4. Ignore rules and the traffic-weighting switch.
5. Run history: pull request, status, counts, duration. A run opens a sheet with each finding, its values and its traffic.
6. From a finding, "Create ticket" uses the RFC-0003 ticket text.

### 5.12 Phase 2: GitHub App mode

1. Add App permissions Checks (write) and Pull requests (read), and subscribe to the `deployment_status` and `pull_request` events.
2. Verify `X-Hub-Signature-256` on every webhook. Deduplicate by delivery id.
3. On a successful `deployment_status` with an `environment_url` for a pull request's head SHA, start a run with no workflow step.
4. Post a Check Run with the summary and one annotation per finding on the changed file that maps to the page.

### 5.13 Phase 3: rendered mode

For pages flagged `content-shrunk` or `javascript-rendering-suspected`, render both versions in a headless browser and compare the rendered HTML. Use it only for those pages, because rendering is slow and costs more.

### 5.14 Use it ourselves

1. Add the action to Relay's own preview workflow (S3), with a Cloudflare Access service token.
2. Add it to the monorepo workflow for S1, against the staging deployment.

## 6. Security

1. CI tokens are hashed, scoped to one project, revocable, and shown once.
2. The host allowlist and the URL policy stop Relay from fetching arbitrary hosts.
3. Preview access secrets are encrypted and sent only to the preview host.
4. Stored values are short snippets (at most 300 characters). Full pages are never stored.
5. The action needs no repository write permission.

## 7. Cost

No paid providers. Each run uses one Trigger.dev task of about 30 to 90 seconds and at most one free Search Console request.

## 8. Alternatives considered

1. **Lighthouse CI.** It focuses on performance. Its SEO checks are shallow and do not compare with production.
2. **Post-deploy monitoring.** It finds the damage after release.
3. **Headless rendering for every page.** Too slow and costly for every run. Phase 3 uses it only where needed.
4. **GitHub App only.** It excludes teams that deploy previews from their own CI. The action comes first.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] Seven tables with D1 and Postgres migrations and the parity test.
- [ ] CI token create, hash, verify and revoke, with tests.
- [ ] Check API with token, host, quota and rate-limit checks (one test each).
- [ ] Test: a token from project A cannot read or create runs for project B.
- [ ] Test: a preview host outside the allowlist is refused before any fetch.
- [ ] URL selection with tests for each reason, the dynamic-segment sitemap match and the 100-URL cap.
- [ ] Fetcher with the URL policy, redirect limit, size limit, timeouts and protected-preview headers (tests).
- [ ] Normalization tests, including the preview-origin canonical and the ignored preview `X-Robots-Tag`.
- [ ] One test per rule, positive and negative.
- [ ] Traffic weighting and severity raise tests.
- [ ] Override label writes an audit event (test).
- [ ] `seo-check` Trigger.dev task with the idempotency key.
- [ ] Composite action repository with a tagged `v1` release and a README.
- [ ] SEO checks tab with tokens, hosts, access, ignores and history.
- [ ] `content/docs/seo-checks.mdx` with setup for Vercel, Netlify, Cloudflare and GitHub Actions previews.
- [ ] Installed on Relay's own previews and on the monorepo for S1.

### Phase 2

- [ ] App permissions and webhook subscriptions added.
- [ ] Signature check and delivery deduplication (tests).
- [ ] Automatic run from a Vercel preview `deployment_status`.
- [ ] Check Run with annotations on the mapped files.

### Phase 3

- [ ] Rendered mode for flagged pages, with a time and cost cap.

## 10. Real-site acceptance test

### Phase 1

**Sites:** S1 (the monorepo's staging deployment as the preview) and S3 (Relay's own previews behind Cloudflare Access).

**Steps:**

1. Open a control pull request on S1 that changes only a CSS color. Deploy it to staging. Run the check.
2. Open a seeded pull request on S1 with 6 regressions: a `noindex` on one page, a canonical changed on another, a removed meta description, a broken internal link, invalid JSON-LD, and a `robots.txt` rule that blocks one page. Deploy it to staging. Run the check.
3. Add the `relay-seo-override` label to the seeded pull request. Run again.
4. Open an ordinary feature pull request on Relay (S3). Run the check through Cloudflare Access.
5. Run the check 5 times on recent real S1 and S3 pull requests that were merged without SEO problems.

**Pass when:**

- The control pull request passes with 0 blocking findings.
- The seeded pull request fails, and all 6 regressions appear with the correct rule, page and values.
- Each finding shows the page's real clicks and impressions.
- The override run passes, and the Activity page shows the override.
- The S3 run reaches the protected preview and completes.
- The 5 real pull requests produce 0 false blocking findings.
- Each run finishes in under 3 minutes.

**Value check:** a developer learns, before merge, that a change would deindex or break a page that brings real traffic.

### Phase 2

**Site:** a test repository deployed on Vercel, with the GitHub App installed.

**Steps:**

1. Open a pull request with one seeded regression. Add no workflow step.
2. Wait for the Vercel preview.

**Pass when:**

- A Check Run appears on the pull request within 5 minutes of the preview, with an annotation on the changed file.

**Value check:** a team gets SEO protection on every pull request with no setup.

## 11. Completion criteria

**Detection**

- 100% of seeded regressions are found across 3 seeded pull requests, with the correct rule and page.
- 0 false blocking findings across 10 real pull requests on S1 and S3.
- No more than 2 warnings per real pull request on average.

**Speed and limits**

- Under 3 minutes for 50 URLs at the 95th percentile. Under 6 minutes for 100.
- A run never makes more than 2 page requests per URL, plus robots, sitemaps and at most 200 link checks.

**Safety**

- 0 fetches to hosts outside the allowlist in a test of 20 disallowed hosts, including private addresses.
- Preview access secrets never appear in logs, findings or summaries (search check).
- A quota or Relay failure never fails a customer job unless `fail-on` is `warning`.

**Usability**

- A developer who has never used Relay installs the action from the docs in under 10 minutes.
- The job summary shows each blocking finding with its page, rule, before and after values, and traffic in one table.

**Adoption**

- The check runs on every pull request of Relay and the monorepo for 2 weeks, with no manual retry.
