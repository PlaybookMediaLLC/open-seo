# RFC-0015: Release quality gate for websites

- **Status:** Done on 2026-10-19. Built in PRs #145 to #149: `relay-gate.json`, the pack columns and summaries grouped by pack (A), the security header pack (B), the links and assets pack (C), the accessibility pack (D) and the trend line (E). The public action `PlaybookMediaLLC/relay-seo-check` v2.0.0 sends the file. The owner chose on 2026-10-19 to keep the performance pack, the gate-only plan and the console-error rule as follow-ups in section 12.
- **Date:** 2026-10-15
- **Area:** beyond SEO. One pull request check for website quality.
- **Depends on:** RFC-0010 (SEO checks on pull requests). Uses rules from RFC-0013 (accessibility) and RFC-0014 (performance).

## Current delivery role — October 23, 2026

Implemented release-gate foundation for stages 1–2. Reuse existing packs; the unimplemented performance pack and separate gate-only plan do not block the metadata pilot.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

RFC-0010 stops SEO regressions before merge. The same preview-versus-production comparison can stop accessibility, performance, link, security-header and asset-weight regressions. This RFC grows the SEO check into one release gate with rule packs, budgets set in the repository, and stable results. It can be sold alone to developer teams, so it also brings new customers to Relay.

## 2. What exists today

| Part                      | Location                                               | Use in this RFC                                                                         |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| SEO check                 | RFC-0010                                               | Action, CI tokens, host allowlist, Trigger.dev task, findings, run history.             |
| axe-core rules            | RFC-0013                                               | Accessibility rule set and clustering.                                                  |
| Performance causes        | RFC-0014                                               | Lighthouse id mapping.                                                                  |
| Security headers on Relay | Cloudflare transform rules on `relay.playbookmedia.io` | HSTS, nosniff, Referrer-Policy and Permissions-Policy, a real baseline to test against. |

## 3. Goals

1. One check, five rule packs: SEO, accessibility, performance, links and assets, and security headers.
2. Report only new problems that the pull request introduces.
3. Budgets and rule switches live in the repository, so they are reviewed like code.
4. The same commit gives the same blocking result every time.
5. A developer installs it in under 10 minutes.

## 4. Non-goals

1. No full security scanning. Only response headers and mixed content.
2. No visual regression testing.
3. No checks that need a logged-in session in phase 1.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                   |
| ----- | ------------------------------------------------------------------------------------------ |
| 1     | Accessibility, links and assets, and security-header packs, with repository configuration. |
| 2     | Performance budgets with lab runs.                                                         |
| 3     | Gate-only plan and pricing. Pull request comments with trends.                             |

### 5.2 Browser runs

1. Run the packs that need a browser in the RFC-0010 Trigger.dev task, with a headless Chromium build extension.
2. Load each checked URL on production and on the preview with the same viewport, user agent and a cold cache.
3. Apply the RFC-0010 host allowlist, URL policy and protected-preview headers to every request.

### 5.3 Rule packs

**Accessibility (phase 1).**

1. Run the pinned axe-core version from RFC-0013 on both versions of each page.
2. A violation is new when its rule and cluster key are on the preview and not on production.
3. New `serious` or `critical` violations block. New `moderate` ones warn.

**Links and assets (phase 1).**

| Rule                                                       | Severity |
| ---------------------------------------------------------- | -------- |
| A new internal link returns 4xx or 5xx                     | Blocking |
| A new image over 300 KB                                    | Warning  |
| Page transfer size grows by 25% or more                    | Warning  |
| An `http:` subresource on an `https:` page (mixed content) | Blocking |
| A new console error on page load                           | Warning  |

**Security headers (phase 1).**

1. Compare these response headers on production and the preview: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and frame protection (`frame-ancestors` in CSP, or `X-Frame-Options`).
2. A header that production sends and the preview drops: blocking on a custom-domain preview, warning on platform preview hosts, because platforms set some headers themselves.
3. A weaker value (for example a shorter HSTS `max-age`, or `unsafe-inline` added to `script-src`): warning.

**Performance budgets (phase 2).**

1. Run Lighthouse 3 times per page on both versions, for the changed pages only (at most 10). Use the median.
2. Default budgets: LCP, Total Blocking Time and CLS may not get worse by more than 20% and also cross the "good" threshold. JavaScript transfer size may not grow by more than 10%.
3. A failed budget blocks only when all 3 runs agree. Otherwise it warns, so noise cannot block a merge.

### 5.4 Repository configuration

A file `relay-gate.json` at the app root, validated with Zod:

```json
{
  "packs": {
    "seo": true,
    "accessibility": true,
    "links": true,
    "securityHeaders": true,
    "performance": false
  },
  "budgets": {
    "lcpWorsePercent": 20,
    "tbtWorsePercent": 20,
    "clsWorsePercent": 20,
    "jsGrowthPercent": 10,
    "imageMaxKb": 300
  },
  "ignore": [{ "rule": "color-contrast", "path": "^/legacy/" }]
}
```

1. The action sends the file content with the run.
2. Project settings give defaults. The repository file wins.
3. An invalid file fails the run with the exact Zod error, so mistakes are visible.
4. Changes to ignore rules in the file show in the run summary.

**As built (part A).** The check API takes the file as `gateConfig` text (20 KB at most) and validates it when the run is queued; an invalid file answers 400 `invalid_gate_config` with every Zod issue as `path: message`, so the mistake shows in CI. The run stores the text, its SHA-256 as `config_hash`, and the space-separated `packs_enabled` from the project defaults and the file. Project settings hold the defaults for the accessibility, links and security packs (all off, so existing projects see no new findings); SEO stays on unless the file turns it off. In App mode, Relay reads `relay-gate.json` at the deployed commit with `contents: read`. The public action sends the file from v2.0.0, which the owner approved on 2026-10-19; v1 is unchanged. File ignores are regular expressions, as in the example; project ignores keep their `*` globs. The API returns each finding's pack, the packs, the hash, the file's ignore rules and a Markdown `summary` grouped by pack, which the App Check Run uses. With the links pack, a broken new link is blocking in the links pack; without it, it stays an SEO warning.

**As built (part B, security).** The page snapshot keeps the six headers of the response that the check already fetches, so the pack costs no request. The frame rule passes when either `X-Frame-Options` or a non-empty CSP `frame-ancestors` is present. Platform hosts are the RFC-0010 preview platforms (`.vercel.app`, `.netlify.app`, `.pages.dev`, `.workers.dev`); every other allowed preview host counts as a custom domain. `'unsafe-inline'` is read from `script-src`, or from `default-src` when the policy has no `script-src`. Each header change is kept once per run, on the first page that shows it, because headers are usually site-wide.

**As built (part C, links and assets).** Page facts now list up to 100 subresources (images, scripts, stylesheets, frames, media) and the HTML size. A subresource is new when its absolute URL is not on production's page. Mixed content needs no request. Image and page sizes come from `HEAD` requests (Content-Length), deduplicated in a batch and capped at 200 for each run; images, scripts and stylesheets count toward the weight, and a page's weight compares only when every counted size is known on both versions. Each rule reports at most five findings a page. The console-error rule is not built: Cloudflare Browser Run quick actions cannot observe console messages during page load, and a browser session library would be a new dependency, so it is a follow-up.

**As built (part D, accessibility and browser runs).** Browser packs run in the RFC-0010 Cloudflare Workflow on Cloudflare Browser Run, not on a Trigger.dev machine: the owner chose the Workflow for RFC-0010 so that checks need no other account, and the same reasoning holds here. The RFC-0010 safety rules still apply: the host allowlist and URL policy choose the URLs, `runAxe` refuses a URL that is not crawlable, and a protected preview is not rendered, because the renderer would need the access secret; the run then shows one "accessibility not checked" warning. The pack checks up to 10 pages a run that loaded with status 200 on both hosts, and bills the browser time like rendered mode; without room in the credits or limits it checks nothing and says so. A violation is new when the preview has a node whose RFC-0013 cluster key production lacks, on a rule with more nodes on the preview than on production: the count stops a class name that changed between builds from looking new. Serious and critical block, moderate warns, minor is not reported. Findings use the axe-core rule id as their rule, so `relay-gate.json` can ignore `color-contrast` on a path.

### 5.5 Stable results

1. Fixed viewport, user agent, cold cache and the same network.
2. Performance blocks only on 3 of 3 runs.
3. Every finding stores the rule version, so results stay comparable after rule updates.

### 5.6 Data model

Extend RFC-0010:

1. `ci_check_findings.pack`: text enum `seo`, `accessibility`, `links`, `security`, `performance`.
2. `ci_check_runs.config_hash` and `ci_check_runs.packs_enabled`.
3. `ci_check_metrics`: `id`, `run_id` (FK cascade), `path`, `metric`, `base_median`, `preview_median`, `runs`.

### 5.7 Product

1. Phase 3 adds a gate-only plan per repository, with a free tier for public repositories.
2. The pull request summary shows a trend line from the last 10 runs on the base branch.

**As built (part E, trend).** Runs do not record a base branch, so the trend uses the repository's last 10 finished runs up to the current one, oldest first. It is one line of block characters with the counts in brackets, so it renders in the Action's job summary and in a Check Run without images. Fewer than two runs show no trend.

## 6. Security

1. The same host allowlist, URL policy and secret handling as RFC-0010.
2. The browser runs on Trigger.dev machines, not in the Relay Worker.
3. Console error text is stored at 300 characters at most.

## 7. Cost

Browser and Lighthouse runs use Trigger.dev compute only. No paid provider. Phase 2 runs up to 60 Lighthouse loads per run (10 pages, 3 runs, 2 versions). Cap the run at 10 minutes.

## 8. Alternatives considered

1. **Separate tools (Lighthouse CI, pa11y, link checkers).** Each needs its own setup, and none compares with production or knows page traffic.
2. **Block on single performance runs.** Rejected. Lab noise would block good pull requests.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] Headless Chromium in the Trigger.dev task with the RFC-0010 safety rules.
- [x] Accessibility pack with new-violation detection by cluster key (tests).
- [ ] Links and assets pack (one test per rule).
- [x] Security header pack with the custom-domain and platform-host rules (tests).
- [x] `relay-gate.json` schema, precedence and error reporting (tests).
- [x] Pack column, config hash and packs-enabled columns in D1 and Postgres.
- [x] Summary groups findings by pack.
- [x] `content/docs/release-gate.mdx` with the file reference.

### Phase 2

- [ ] Performance pack with 3 runs, medians and the 3-of-3 blocking rule.
- [ ] `ci_check_metrics` table.

### Phase 3

- [ ] Gate-only plan and the public-repository free tier.
- [x] Trend line in the summary.

## 10. Real-site acceptance test

**Sites:** S1 (staging as the preview) and S3.

**Steps:**

1. Open a control pull request on S1 (a text change). Run the gate 5 times on the same commit.
2. Open a seeded pull request with: a button without a name, a new 800 KB image, an `http:` script, a dropped `Referrer-Policy` header on a custom-domain staging host, and a broken new link.
3. Turn on the performance pack. Add a 400 KB synchronous script to one page in a second seeded pull request.
4. Install the gate on S3 with a `relay-gate.json` that ignores one rule.

**Pass when:**

- The control pull request passes 5 times out of 5, with identical findings.
- The first seeded pull request fails, and all 5 problems appear in the correct packs.
- The script pull request fails the performance budget on 3 of 3 runs.
- The S3 run honors the ignore rule and shows it in the summary.

**Value check:** one check replaces several tools and stops quality regressions before customers see them.

## 11. Completion criteria

- 100% of seeded problems found across 3 seeded pull requests.
- 0 false blocking findings across 10 real pull requests on S1 and S3.
- Identical blocking results in 10 of 10 repeated runs of one commit.
- Phase 1 run under 5 minutes for 30 pages. Phase 2 run under 10 minutes.
- A new developer installs the gate with `relay-gate.json` in under 10 minutes from the docs.

## 12. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [ ] Real-site acceptance (section 10) on S1 staging and S3: 5 runs of a control pull request, a seeded pull request with the five phase 1 problems, and an S3 install that honors an ignore rule. Trigger: the GitHub App installed again on PlaybookMediaLLC, or a CI token on S1, and a staging host on the S1 project.
- [ ] Completion criteria (section 11): seeded problems found, no false blocking findings on 10 real pull requests, 10 identical repeated runs, run times, and a 10-minute install. Trigger: the acceptance above.
- [ ] Performance pack and `ci_check_metrics` (phase 2). The owner decided on 2026-10-19 to wait: checks run in a Cloudflare Workflow (the RFC-0010 decision), so Lighthouse would come from DataForSEO as a paid call on every run, instead of the free Trigger.dev compute that section 7 assumed. Trigger: a free Lighthouse runner, or the owner approves the paid path.
- [ ] Gate-only plan and a free tier for public repositories (phase 3). Trigger: the owner sets the price and creates the product in Autumn; then the plan check is wired.
- [ ] Console errors in the links and assets pack. Browser Run quick actions cannot observe console messages during page load, and a browser session library such as `@cloudflare/puppeteer` is a new dependency. Trigger: a real pull request that ships a console error the gate should have caught.
