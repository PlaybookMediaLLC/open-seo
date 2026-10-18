# RFC-0013: Accessibility fixes in code

- **Status:** In progress. Part A built: axe-core in audits, the result tables and the cluster keys.
- **Date:** 2026-10-15
- **Area:** beyond SEO. Accessibility and legal risk.
- **Depends on:** RFC-0004 (drafting), RFC-0005 (publishing), RFC-0012 (file reading rules). Phase 3 joins RFC-0015.

## 1. Summary

The EU European Accessibility Act applies to many websites since June 2025, and US ADA lawsuits continue. Most tools either report issues or install an overlay script that claims to fix them. In 2025 the US FTC fined the overlay vendor accessiBe $1 million over misleading claims that its overlay made sites compliant. This RFC finds automatically detectable accessibility issues on the pages that matter, groups them by component, fixes the common ones in code by pull request, and verifies the fix on the live site. Relay never claims compliance.

## 2. What exists today

| Part                 | Location                                                                                                     | Use in this RFC                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit issues         | `src/server/lib/audit/issues/`                                                                               | `images-missing-alt`, `heading-order-skip`, `missing-h1`, `multiple-h1`.                                                                                          |
| Lighthouse           | `src/server/lib/audit/lighthouse.ts`                                                                         | DataForSEO Lighthouse. Accessibility score per sampled page. The full JSON report is stored in R2 at `site-audit/{projectId}/{auditId}/{pageId}-{strategy}.json`. |
| Headless browser     | `BROWSER` binding on the audit worker (`deploy/alchemy/alchemy.run.ts`), used by `siteAuditWorkflowCrawl.ts` | Run axe-core on rendered pages.                                                                                                                                   |
| Rendering accounting | `RenderUsage` in `src/shared/audit-rendering.ts`                                                             | Count browser use per audit.                                                                                                                                      |
| Publishing           | RFC-0005, RFC-0012                                                                                           | Exact-change approval, file reading rules, text edits.                                                                                                            |

The WebAIM Million report finds every year that six error types cause most detected errors: low-contrast text, missing image alt text, missing form labels, empty links, empty buttons and missing document language.

## 3. Goals

1. Run axe-core on key pages, top-traffic pages and one page per template, during each audit.
2. Group violations by component, so one fix resolves many pages.
3. Fix image alt text, document language, and names for links, buttons and form fields in code.
4. Verify fixes on the live site.
5. State the limits plainly. Automated checks find only part of WCAG issues, and Relay never says "compliant".

## 4. Non-goals

1. No legal advice or certification.
2. No overlays or runtime scripts.
3. No replacement for manual testing with assistive technology.
4. No PDF or document checks.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------- |
| 1     | axe-core in audits, issue clusters, opportunities, fixes for alt text and document language, live verification.      |
| 2     | Fixes for link, button and field names. Alt-text drafts with a vision model. Tickets for contrast and heading order. |
| 3     | Accessibility statement draft. New-violation checks on pull requests (RFC-0015).                                     |

### 5.2 Detection

1. Add an accessibility step to the audit workflow, after Lighthouse. Use the `BROWSER` binding.
2. Pages: all key pages, the 20 pages with the most organic clicks, and one representative per route template (grouped by path shape). At most 50 pages per audit.
3. Inject a pinned axe-core version. Run the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags.
4. Count browser time in `RenderUsage`. Respect the audit's existing render limits.
5. Store results:

   | Table                            | Columns                                                                                                                                                                                                                     |
   | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `audit_accessibility_results`    | `id`, `audit_id` (FK cascade), `page_id` (FK cascade), `axe_version`, `ran_at`, `violation_count`, `error`                                                                                                                  |
   | `audit_accessibility_violations` | `id`, `result_id` (FK cascade), `rule_id`, `impact` (`minor`, `moderate`, `serious`, `critical`), `wcag_tags`, `target_selector`, `html_snippet`, `failure_summary` (each text field at most 300 characters), `cluster_key` |

6. `cluster_key` = SHA-256 of the rule id, the selector with indexes removed, and the snippet with attribute values for `src`, `href` and `id` removed. The same broken component on 40 pages gives one cluster.

**As built (part A).** The step runs after Lighthouse in the audit workflow, on the audit worker's browser. The audit worker holds no Google credentials by design, so the app worker saves the 20 pages with the most organic clicks in `audit_accessibility_targets` when the audit starts. The step adds the project's key pages first, then those pages, then the shortest page of each route template, up to 50. It loads axe-core 4.13.0 from jsDelivr's copy of the npm file and checks its SHA-256 before use: bundling the 570 KB source as a string exhausted the build's memory. The browser's "content" action injects axe-core and a script that writes the compact result into a `<template>`, and Relay reads it back from the page's HTML. A rule keeps at most 20 nodes. The `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags run, and `srcset` values are also removed from cluster keys. Browser time has its own hold and settlement, like the RFC-0010 rendered mode: without room in the spend limits or the credits, the step checks nothing. A page whose security policy blocks injected scripts stores the reason instead of violations. A failure never fails the audit.

### 5.3 Opportunities

1. New type `accessibility_issue`, one per cluster.
2. Priority uses the RFC-0002 formula with these inputs:
   - Visibility = impact weight (critical 1.0, serious 0.75, moderate 0.4, minor 0.15).
   - Demand = `min(1, log10(1 + total organic sessions or clicks of affected pages) / 5)`.
   - Commercial = the highest key-page role score among affected pages.
3. Evidence table `opportunity_accessibility_evidence`: `id`, the three FKs, `audit_id`, `rule_id`, `impact`, `pages_affected`, `example_url`, `example_selector`, `example_snippet`.
4. Explanation in plain words, with the WCAG criterion and why it matters to people who use assistive technology.

### 5.4 Fixes in code

This adds the change kind `jsx_attribute`. RFC-0014 reuses it.

**Locating the element.**

1. Start from the page file and follow imports with the RFC-0012 limits. Include components imported from the app's own directories.
2. For images, match by the `src` value: a string literal path, or an identifier imported from an image file with the same file name.
3. For links and buttons, match by `href` literal, or by a unique class or test id from the selector.
4. Require exactly one JSX element match. Reject elements whose props are spread after the target attribute, because the spread can override it.

**Fix rules.**

| Rule                               | Phase | Fix                                                                                                              |
| ---------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `image-alt`                        | 1     | Add `alt`. The user picks "describe" (draft text) or "decorative" (`alt=""`).                                    |
| `html-has-lang`, `html-lang-valid` | 1     | Add or correct `lang` on `<html>` in the root layout. The user picks the language.                               |
| `link-name`, `button-name`         | 2     | Add `aria-label` drafted from the target page's title or the button's action.                                    |
| `label`                            | 2     | Add `aria-label` from the visible placeholder or nearby text, or link an existing label with `htmlFor` and `id`. |
| `color-contrast`                   | 2     | Ticket with the measured ratio, the two colors and the required ratio.                                           |
| `heading-order`                    | 2     | Ticket with the heading outline.                                                                                 |

**Alt text drafts.** Phase 1 drafts from the file name, the surrounding text and the page topic, with the RFC-0004 checks. Phase 2 adds an optional vision model that sees the image. Every alt text needs a person's approval. Alt text never contains "image of" or keyword lists.

### 5.5 Verification and tracking

1. After the deployment is confirmed, run axe-core again on the affected pages in the cluster (at most 10).
2. The fix passes when the cluster's rule no longer fails on those pages.
3. Show a trend per project: serious and critical violations per audit, and clusters fixed.

### 5.6 Wording rules

1. Always show: "Automated checks find only some accessibility issues. Manual testing with assistive technology is still needed."
2. Never show "compliant", "ADA compliant", "WCAG compliant" or a compliance score.
3. Show "violations found by automated checks" instead.

### 5.7 Phase 3

1. **Accessibility statement draft.** From stored facts only: the date of the last audit, the target standard, open clusters as known limitations, and the contact address. The owner edits and publishes it.
2. **Pull request checks.** RFC-0015 compares axe-core results on the preview and production, and blocks new serious or critical violations.

## 6. Security

1. axe-core runs in the isolated audit worker that already parses untrusted HTML.
2. Stored snippets are at most 300 characters.
3. Vision-model input is the public image URL only.

## 7. Cost

1. Browser time per audit, capped at 50 pages. Show it in the audit's cost estimate.
2. Alt-text drafts cost model credits. Vision drafts cost more. Show the estimate first.

## 8. Alternatives considered

1. **Overlay scripts.** Rejected. They do not change the code, and regulators have acted against misleading overlay claims.
2. **Use only the Lighthouse accessibility category.** It runs a subset of axe-core on few pages. Running axe-core directly gives full results and clusters.
3. **Automatic contrast fixes.** Rejected for now. Color changes affect the brand and the design system. A ticket with exact values is safer.

## 9. Ready-for-other-users checklist

### Phase 1

- [x] Accessibility step in the audit with the page selection and the 50-page cap.
- [x] Pinned axe-core version and the WCAG tag set.
- [ ] Two result tables and the evidence table, in D1 and Postgres, with the parity test.
- [x] Cluster keys with tests: the same component on different pages gives one key, different components give different keys.
- [ ] `accessibility_issue` opportunities with the priority inputs.
- [ ] `jsx_attribute` change kind with element matching tests (literal `src`, imported image, spread rejection, multiple matches).
- [ ] Alt text and `lang` fixes, including the decorative choice.
- [ ] Live verification after deploy.
- [ ] Wording rules enforced (test that no UI string contains "compliant").
- [ ] `content/docs/accessibility.mdx` with the limits stated first.

### Phase 2

- [ ] Link, button and field name fixes.
- [ ] Vision alt-text drafts behind a cost confirmation.
- [ ] Contrast and heading-order tickets.

### Phase 3

- [ ] Statement draft from stored facts only.
- [ ] Pull request checks through RFC-0015.

## 10. Real-site acceptance test

### Phase 1

**Sites:** S4 (the largest), S1, and S3. Use a staging page on S1 seeded with known violations.

**Steps:**

1. Seed an S1 staging page with: 2 images without `alt`, a missing `lang` (on a staging copy of the layout), an icon-only link, an unlabeled input, and low-contrast text.
2. Run an audit on S1 staging, S1 production, S3 and S4.
3. A person checks 20 random violations by hand in the browser.
4. Fix one `image-alt` cluster and the `lang` issue on S1 by pull request. Merge and deploy.
5. Run verification.

**Pass when:**

- All 5 seeded violations are found on staging.
- At least 19 of 20 checked violations are real.
- S4 shows clusters that cover several pages each.
- The pull request edits only the matched elements.
- Verification shows the fixed rules no longer fail on the affected pages.
- No screen uses the word "compliant".

**Value check:** a team fixes a whole class of accessibility errors in one reviewed pull request, instead of reading a page-by-page list.

## 11. Completion criteria

**Detection**

- At least 95% of checked violations are real.
- 100% of seeded violations are found.
- Clustering reduces the issue count by at least 50% on S4, compared with page-by-page counts.

**Fixes**

- The element locator finds the right element for at least 8 of 10 real violations on S1 and S4, and never edits a wrong element.
- Fixed clusters pass verification on 100% of re-checked pages.

**Alt text**

- At least 8 of 10 drafted alt texts are accepted with small edits or none. None contains a keyword list or "image of".

**Cost and time**

- The accessibility step adds under 3 minutes to a 50-page audit.
- Browser time stays within the audit's estimate.

**Honesty**

- Every accessibility screen shows the limits text.
