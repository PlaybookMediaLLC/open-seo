# RFC-0015: Release quality gate for websites

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** beyond SEO. One pull request check for website quality.
- **Depends on:** RFC-0010 (SEO checks on pull requests). Uses rules from RFC-0013 (accessibility) and RFC-0014 (performance).

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

- [ ] Headless Chromium in the Trigger.dev task with the RFC-0010 safety rules.
- [ ] Accessibility pack with new-violation detection by cluster key (tests).
- [ ] Links and assets pack (one test per rule).
- [ ] Security header pack with the custom-domain and platform-host rules (tests).
- [ ] `relay-gate.json` schema, precedence and error reporting (tests).
- [ ] Pack column, config hash and packs-enabled columns in D1 and Postgres.
- [ ] Summary groups findings by pack.
- [ ] `content/docs/release-gate.mdx` with the file reference.

### Phase 2

- [ ] Performance pack with 3 runs, medians and the 3-of-3 blocking rule.
- [ ] `ci_check_metrics` table.

### Phase 3

- [ ] Gate-only plan and the public-repository free tier.
- [ ] Trend line in the summary.

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
