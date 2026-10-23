# RFC-0014: Web performance fixes and field measurement

- **Status:** Done on 2026-10-19. Built in PRs #138 to #143: CrUX field data and the weekly refresh (A), `performance_issue` detection with the cause table and tickets (B), the field result over 4 weeks (C), the three phase 2 fixes in code (D), lab checks of three Lighthouse runs (E), and the Web Vitals snippet with its GA4 report (phase 3). The real-site acceptance test, the completion criteria and a few small items are follow-ups in section 12.
- **Date:** 2026-10-15
- **Area:** beyond SEO. Speed affects rankings, engagement and conversion.
- **Depends on:** RFC-0005 (publishing), RFC-0013 (`jsx_attribute` change kind), RFC-0008 (scheduled refresh).

## Current delivery role — October 23, 2026

Implemented specialized performance foundation. Keep field/lab prerequisites explicit; performance expansion follows pilot demand and measured costs.

The historical status and acceptance notes below are retained. The [delivery plan](README.md) and [current audit](../relay-release-assurance-audit.md) distinguish implementation, live acceptance, and commercial evidence.

## 1. Summary

The audit stores Lighthouse scores and lab metrics, but Relay does not find the cause of a slow template, does not fix it, and does not measure real users. This RFC adds real-user data from the Chrome UX Report (CrUX), finds templates that fail Core Web Vitals on pages that matter, maps the cause from the stored Lighthouse report, fixes common causes by pull request, and measures the effect in lab and field data.

Relay's own landing page is a real example: Lighthouse mobile shows a simulated LCP of about 3.7 seconds, mainly from the render-blocking `app.css`.

## 2. What exists today

| Part             | Location                             | Use in this RFC                                                                       |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Lighthouse       | `src/server/lib/audit/lighthouse.ts` | DataForSEO Lighthouse per sampled page: scores, LCP, CLS, INP, TTFB. Full JSON in R2. |
| Lighthouse table | `audit_lighthouse_results`           | Lab metrics per page and strategy.                                                    |
| Audit issue      | `slow-response`                      | Server response time.                                                                 |
| Publishing       | RFC-0005, RFC-0013 `jsx_attribute`   | Attribute edits by pull request.                                                      |

**New data source.** The CrUX API (`records:queryRecord`) returns the 75th percentile of LCP, INP and CLS for a URL or an origin, for phones or desktops, over 28 days. The CrUX History API (`records:queryHistoryRecord`) returns up to 25 weekly points. Both are free with a Google API key. Pages without enough Chrome users have no URL-level data.

## 3. Goals

1. Show real-user Core Web Vitals per page and per origin.
2. Find templates that fail on pages with organic traffic or conversions.
3. Name the likely cause from the stored Lighthouse report.
4. Fix four common causes in Next.js code by pull request.
5. Measure the result in lab data at once, and in field data over 4 weeks.

## 4. Non-goals

1. No build or bundler changes.
2. No CDN or hosting configuration changes.
3. No real-user monitoring script in phase 1.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                    |
| ----- | ------------------------------------------------------------------------------------------- |
| 1     | CrUX data, failing-template detection, cause mapping, tickets for every cause, measurement. |
| 2     | Pull request fixes for LCP image loading, unsized images and third-party script strategy.   |
| 3     | Optional real-user monitoring snippet for pages without CrUX data.                          |

### 5.2 Field data

1. Add the secret `CRUX_API_KEY`.
2. Add `cwv_snapshots`: `id`, `project_id` (FK cascade), `scope` (`url`, `origin`), `target`, `form_factor` (`phone`, `desktop`), `collection_end`, `lcp_p75_ms`, `inp_p75_ms`, `cls_p75`, `source` (`crux`, `crux_history`), `fetched_at`. Unique on (`project_id`, `scope`, `target`, `form_factor`, `collection_end`, `source`).
3. Refresh weekly through an RFC-0008 task for key pages, the 30 pages with the most organic clicks, and the origin. At most 70 requests per project per week, within the CrUX quota.
4. When a URL has no data, use the origin and say so.

**As built (part A).** `CRUX_API_KEY` is an optional secret; without it, the weekly job skips with "Chrome UX Report access is not configured." The client asks for the three metrics and treats a 404 as "too few users", not an error; a 429 maps to a rate limit. CrUX returns the CLS p75 as a string, so all three values are read as numbers. The targets are, in order, the origin of the Search Console property (`sc-domain:example.com` becomes `https://example.com`), the key pages, and the top 30 pages by organic clicks over 28 days. They are cut to 35, so that phones and desktops stay within 70 requests; requests run five at a time. A second refresh in the same CrUX week updates the stored row through the unique key, so a repeated run never duplicates data. The table lives with the other opportunity signals, which keeps it inside the tenancy test. The job `cwv_refresh` runs weekly at 05:00 UTC and is listed in the Automation tab as "Field data refresh". Only `crux` rows are written in part A; `crux_history` comes with measurement.

### 5.3 Detection

Thresholds at the 75th percentile: LCP good ≤ 2,500 ms, INP good ≤ 200 ms, CLS good ≤ 0.1.

1. Group URLs by route template (path shape).
2. A template fails when any metric is above "good" for its most-trafficked URL with data, or for the origin when no URL has data.
3. New type `performance_issue`, one per template and metric.
4. Priority: visibility = how far the metric is above "good" (capped at 2× the threshold); demand = organic clicks of the template's pages; commercial = key-page role or conversions (RFC-0012).
5. Evidence `opportunity_performance_evidence`: `id`, the three FKs, `metric`, `form_factor`, `p75_value`, `threshold`, `scope`, `collection_end`, `lab_value` (nullable), `cause_ids`.

**As built (part B).** Detection reads the newest `crux` row of each target from the last 35 days. Templates come from `detectUrlTemplate` over the pages with organic clicks in the current Search Console period and the key pages, so a page with neither is not grouped. A template is measured on its most-visited page with page-level data, on phones first and desktops when a page has only desktop data. Templates with no page-level data do not each take the origin's values: they share one item per failing metric, with the template `*`, so one slow origin gives at most three items. The identity is the template and the metric. Confidence is 0.6, difficulty 0.5 and effort 4 hours; commercial is the best key-page role or the GA4 key events of the template's pages. The evidence also stores the measured target and the template. The type filter gets a Performance group.

### 5.4 Cause mapping

Read the stored Lighthouse JSON for the template's sampled page. Map audit or insight ids to plain causes. The ids depend on the Lighthouse version that DataForSEO runs, so keep the mapping as one table in code with a test per id.

| Cause                              | Example Lighthouse ids                                                     | Phase 2 fix                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| LCP image loads lazily             | `lcp-lazy-loaded`, `lcp-discovery-insight`                                 | Remove `loading="lazy"` and add the priority hint for the installed Next.js version. |
| LCP image not prioritized          | `prioritize-lcp-image`, `lcp-discovery-insight`                            | Add the priority hint.                                                               |
| Images without size                | `unsized-images`, `cls-culprits-insight`                                   | Add `width` and `height` from the image file.                                        |
| Third-party scripts block the page | `third-party-summary`, `third-parties-insight`                             | Change `next/script` `strategy` to `lazyOnload` for known analytics and chat hosts.  |
| Render-blocking CSS or JS          | `render-blocking-resources`, `render-blocking-insight`                     | Ticket.                                                                              |
| Large or old-format images         | `uses-responsive-images`, `modern-image-formats`, `image-delivery-insight` | Ticket.                                                                              |
| Unused JavaScript                  | `unused-javascript`                                                        | Ticket.                                                                              |
| Slow server response               | `server-response-time`, `slow-response` issue                              | Ticket.                                                                              |

**As built (part B, causes).** The table is `PERFORMANCE_CAUSES` in `src/shared/performance.ts`, an array with one test per Lighthouse id. Relay reads the stored reports of the newest audit with Lighthouse results in the last 30 days, from R2, and maps the `auditKey` of each failing audit; a report that cannot be read names no cause. Each cause lists the metrics it affects, so an LCP item never names unsized images. The lab value is the measured page's own report first, then mobile reports. The `slow-response` audit issue is not read: `server-response-time` covers the same cause from Lighthouse. Every cause is a ticket in phase 1: the ticket lists the field data, the measured target, the lab value, and each cause with its change.

### 5.5 Fixes (phase 2)

All fixes use the RFC-0013 `jsx_attribute` change kind and its element matching rules.

1. **Priority hint.** Read the Next.js version from the app's `package.json`. Use the image priority prop that this version supports. Reject when the version is unknown.
2. **Image size.** Read the image file through the GitHub reader. Parse the width and height from the PNG, JPEG, WebP or AVIF header. Read at most 64 KB. For `fill` images, add a `sizes` value instead, from the rendered layout width in the Lighthouse report.
3. **Script strategy.** Only for script hosts on a reviewed list (analytics, chat, tag managers). The risk text says that tracking may start later.
4. Every proposal includes a lab verification plan and a field plan.

**As built (part D).** The item's **Fix in code** sheet lists only the fixes whose cause the evidence names, and only for a page-level item; a site-wide item has no single page to change. The element comes from the page's newest Lighthouse report, read again from R2 when the person prepares the fix: the image URL of `prioritize-lcp-image`, `lcp-lazy-loaded` or `lcp-discovery-insight` items (a `url`, or the `src` in the node snippet), and the image URLs of `unsized-images` items. The priority hint goes on `next/image` elements only: `priority` for Next.js 13 to 15 and `preload` from 16, read from `dependencies` or `devDependencies` in the root `package.json`, and refused when the version is unknown or older; `loading="lazy"` is removed in the same edit. Image sizes go on `<img>` elements whose `src` is a path in `public/`; `fill` images are refused, so the rendered-width `sizes` value is not built. The GitHub client reads the file as raw bytes and stops at 64 KB, whatever the file's size. The script fix searches the page file, the files it imports and the root layout for one `next/script` element whose literal `src` host is on the reviewed list and that is not already `lazyOnload`; a match in the root layout says in the risk text that the change applies to every page. All three fixes and the RFC-0013 fixes share one function that builds and saves the attribute proposal.

### 5.6 Measurement

1. **Lab, at deploy.** Run Lighthouse 3 times on the changed page before and after, with DataForSEO. Use the median. Show the cost first.
2. **Field, over 4 weeks.** Compare the 4 weekly CrUX History points before deployment with the 4 points that start 4 weeks after deployment, because CrUX uses a 28-day window.
3. **Labels:** "improved" when the p75 moves from poor or needs-improvement to good, or improves by 15% or more. "Worse" for the reverse. Otherwise "no clear change".
4. Show organic CTR, engagement and conversions for the same pages next to it (RFC-0006, RFC-0012), without a causal claim.

**As built (part C, field).** Phase 1 has no Relay change to track, so the field result belongs to the opportunity and starts on the day of its newest "implemented" decision. **Check the field result** asks the CrUX History API for the measured target and form factor once an hour at most (a lease per item), stores the weekly points as `crux_history` rows, and computes the result from stored rows; viewing the page makes no request. The comparison takes the 4 points that end before the change day and the first 4 points that end 28 days or more after it, and compares their medians. A missing week in either group gives "not enough data"; fewer than 4 later points gives "waiting" with the date of the 4th point, 49 days after the change. "Improved" and "worse" follow item 3, with Google's poor limits (LCP 4,000 ms, INP 500 ms, CLS 0.25) for the ratings. Lab runs at deploy (item 1) are phase 2, and item 4 is a follow-up: the item page does not yet show organic CTR, engagement and conversions next to the field result.

**As built (part E, lab).** A lab check is a person's action on a page-level item, not an automatic step at deploy: Relay does not know when a ticket ships, and each run costs credits. The button shows the estimate first (3 × the DataForSEO Lighthouse price, marked up on hosted plans). The audit worker runs the three mobile runs one after another through a new RPC method, `runLabChecks`, behind a marked seam in `src/audit-worker.ts`: the multi-MB payloads that once ran the app worker out of memory never leave it, and only LCP, CLS, Total Blocking Time and the score return. Each run is metered like any DataForSEO call; a refusal for credits or spending limits stops the remaining runs. `performance_lab_checks` stores the medians and the number of finished runs. The comparison takes the newest check with all three runs before the item's "implemented" decision and the newest one after it. Lighthouse has no lab INP, so an INP item compares Total Blocking Time, and the page says so.

### 5.7 Phase 3: monitoring snippet

For sites without CrUX data, an optional snippet uses the `web-vitals` library to send LCP, INP and CLS to the site's own GA4 as events. Relay reads them as an event report. No data goes to Relay directly.

**As built (phase 3).** The snippet is a Next.js client component that calls `useReportWebVitals` from `next/web-vitals` and sends `LCP`, `INP` and `CLS` events through the site's own `gtag`, with web-vitals' rating as the `metric_rating` parameter. The package needs nothing new. GA4 cannot return a percentile of an event value, so Relay reads event counts by page, event and the `customEvent:metric_rating` dimension over 28 days, and shows the share of loads rated good for the 20 busiest pages. A metric passes at 75% or more, which is the same test as a good 75th percentile. The owner registers the custom dimension in GA4; until then, or until events arrive, GA4 refuses the report and the card shows the setup steps. The report shows on the Opportunities page under the Performance filter. Detection does not use these events yet: it still reads CrUX only.

## 6. Security

1. The CrUX key is a server secret.
2. Image header reads are capped in size.
3. Script strategy changes apply only to listed hosts.

## 7. Cost

1. CrUX: free.
2. Lab runs: DataForSEO Lighthouse credits, shown before the run.

## 8. Alternatives considered

1. **Lab data only.** Lab tests miss real devices and networks. Google uses field data for Core Web Vitals.
2. **A Relay real-user monitoring service.** Rejected for now. It collects visitor data. GA4 and CrUX cover the need.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] `CRUX_API_KEY`, the CrUX clients and `cwv_snapshots` in D1 and Postgres.
- [x] Weekly refresh task with the 70-request cap.
- [x] Template grouping and `performance_issue` detection with threshold tests.
- [x] Cause mapping table with one test per Lighthouse id.
- [x] Tickets for every cause.
- [x] Field measurement with the 4-week offset and the labels.
- [x] `content/docs/performance.mdx` explains field and lab data and the delays.

### Phase 2

- [x] Priority hint by Next.js version (tests for each supported version and the unknown case).
- [x] Image size from file headers for 4 formats (tests with real files), with the 64 KB cap.
- [x] Script strategy change for listed hosts only (test that other hosts are refused).
- [x] Lab verification with 3 runs and the median.

### Phase 3

- [x] Monitoring snippet and the GA4 event report.

## 10. Real-site acceptance test

### Phase 1

**Sites:** S3 (Relay, known render-blocking CSS) and S1.

**Steps:**

1. Fetch CrUX data for both origins and their top pages.
2. Run detection.
3. Compare 3 CrUX values with PageSpeed Insights field data for the same URLs.

**Pass when:**

- CrUX values match PageSpeed Insights.
- S3 shows a performance issue whose cause names the render-blocking stylesheet.
- Pages without CrUX data say so, and use the origin.

### Phase 2

**Site:** S1, or S2 when S1 has no failing template.

**Steps:**

1. Prepare a fix for one cause. Merge and deploy it.
2. Run the lab verification.
3. Read the field result after 8 weeks.

**Pass when:**

- The pull request changes only the matched attribute.
- The lab median for the target metric improves by at least 10%.
- The field result appears with its label and its delay explained.

**Value check:** the owner learns which template is slow for real users, why, and gets a reviewed fix with proof.

## 11. Completion criteria

**Data**

- CrUX values match PageSpeed Insights field data for 5 URLs.
- Weekly refresh runs for 4 weeks with no missed week.

**Detection and causes**

- On 5 failing templates, a person confirms the named cause in the Lighthouse report for at least 4.
- 0 performance issues on templates that pass all three metrics.

**Fixes**

- Image dimensions are correct for 10 of 10 test images.
- Every fix passes the repository's own checks on its pull request.
- At least 1 fix improves the lab metric by 10% or more on a real site.

**Honesty**

- Every field result shows the 28-day window and the delay. No screen claims that a change caused a ranking change.

## 12. Follow-ups that do not block closing

Each follow-up names its trigger. Check it here when it passes.

- [ ] Field data in production. Trigger: the owner creates a Google API key with the Chrome UX Report API and adds it as `CRUX_API_KEY` to the production settings. Then the weekly job reads data; until then it skips with "Chrome UX Report access is not configured".
- [ ] Phase 1 acceptance (section 10) on S3 and S1: CrUX values against PageSpeed Insights for 3 URLs, a performance issue on S3 that names the render-blocking stylesheet, and pages without data that use the origin. Trigger: field data in production, and an S3 audit with Lighthouse.
- [ ] Phase 2 acceptance (section 10) on S1 or S2: one fix merged and deployed, a lab median that improves by 10% or more, and the field result after 8 weeks. Trigger: the GitHub App installed again on PlaybookMediaLLC, and credits for lab checks.
- [ ] Completion criteria (section 11): CrUX against PageSpeed Insights for 5 URLs, 4 weeks of weekly refreshes, named causes confirmed on 5 failing templates, 10 test images sized correctly, and a 10% lab gain on a real site. Trigger: the acceptance above.
- [ ] Organic CTR, engagement and conversions next to the field result (5.6 item 4). Trigger: the first performance item with a measured field result.
- [ ] `sizes` for `fill` images from the rendered layout width (5.5 item 2), and the priority hint on plain `<img>` elements (`fetchPriority`). Trigger: a real item whose LCP image or unsized image uses one of them.
- [ ] Detection from the snippet's GA4 events for pages without CrUX data. Trigger: a site with the snippet and its custom dimension, and a failing page that CrUX does not cover.
