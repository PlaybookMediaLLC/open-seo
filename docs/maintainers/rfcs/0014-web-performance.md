# RFC-0014: Web performance fixes and field measurement

- **Status:** Draft
- **Date:** 2026-10-15
- **Area:** beyond SEO. Speed affects rankings, engagement and conversion.
- **Depends on:** RFC-0005 (publishing), RFC-0013 (`jsx_attribute` change kind), RFC-0008 (scheduled refresh).

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

### 5.3 Detection

Thresholds at the 75th percentile: LCP good ≤ 2,500 ms, INP good ≤ 200 ms, CLS good ≤ 0.1.

1. Group URLs by route template (path shape).
2. A template fails when any metric is above "good" for its most-trafficked URL with data, or for the origin when no URL has data.
3. New type `performance_issue`, one per template and metric.
4. Priority: visibility = how far the metric is above "good" (capped at 2× the threshold); demand = organic clicks of the template's pages; commercial = key-page role or conversions (RFC-0012).
5. Evidence `opportunity_performance_evidence`: `id`, the three FKs, `metric`, `form_factor`, `p75_value`, `threshold`, `scope`, `collection_end`, `lab_value` (nullable), `cause_ids`.

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

### 5.5 Fixes (phase 2)

All fixes use the RFC-0013 `jsx_attribute` change kind and its element matching rules.

1. **Priority hint.** Read the Next.js version from the app's `package.json`. Use the image priority prop that this version supports. Reject when the version is unknown.
2. **Image size.** Read the image file through the GitHub reader. Parse the width and height from the PNG, JPEG, WebP or AVIF header. Read at most 64 KB. For `fill` images, add a `sizes` value instead, from the rendered layout width in the Lighthouse report.
3. **Script strategy.** Only for script hosts on a reviewed list (analytics, chat, tag managers). The risk text says that tracking may start later.
4. Every proposal includes a lab verification plan and a field plan.

### 5.6 Measurement

1. **Lab, at deploy.** Run Lighthouse 3 times on the changed page before and after, with DataForSEO. Use the median. Show the cost first.
2. **Field, over 4 weeks.** Compare the 4 weekly CrUX History points before deployment with the 4 points that start 4 weeks after deployment, because CrUX uses a 28-day window.
3. **Labels:** "improved" when the p75 moves from poor or needs-improvement to good, or improves by 15% or more. "Worse" for the reverse. Otherwise "no clear change".
4. Show organic CTR, engagement and conversions for the same pages next to it (RFC-0006, RFC-0012), without a causal claim.

### 5.7 Phase 3: monitoring snippet

For sites without CrUX data, an optional snippet uses the `web-vitals` library to send LCP, INP and CLS to the site's own GA4 as events. Relay reads them as an event report. No data goes to Relay directly.

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

- [ ] `CRUX_API_KEY`, the CrUX clients and `cwv_snapshots` in D1 and Postgres.
- [ ] Weekly refresh task with the 70-request cap.
- [ ] Template grouping and `performance_issue` detection with threshold tests.
- [ ] Cause mapping table with one test per Lighthouse id.
- [ ] Tickets for every cause.
- [ ] Field measurement with the 4-week offset and the labels.
- [ ] `content/docs/performance.mdx` explains field and lab data and the delays.

### Phase 2

- [ ] Priority hint by Next.js version (tests for each supported version and the unknown case).
- [ ] Image size from file headers for 4 formats (tests with real files), with the 64 KB cap.
- [ ] Script strategy change for listed hosts only (test that other hosts are refused).
- [ ] Lab verification with 3 runs and the median.

### Phase 3

- [ ] Monitoring snippet and the GA4 event report.

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
