# RFC-0016: Revenue attribution from landing page to payment

- **Status:** In progress. Part A built: the first-touch snippet, the server helper and the channel rules. Part B built: the read-only Stripe connection. Part C built: the daily sync. Part D built: the reports. Phase 2 built: revenue in priority and in experiment results.
- **Date:** 2026-10-15
- **Area:** beyond SEO. Close the loop from search click to revenue.
- **Depends on:** RFC-0008 (scheduled sync), RFC-0009 (encryption key, audit log). Uses RFC-0002 scoring and RFC-0006 results.

## 1. Summary

Relay measures clicks, sessions and GA4 key events. It cannot say which landing pages and which changes produced paying customers. This RFC adds a small first-party attribution snippet, a read-only Stripe connection, and revenue by first-touch landing page and channel. Revenue then feeds opportunity priority and experiment results, with clear limits. Relay stores no customer names or emails.

## 2. What exists today

| Part                  | Location                                                      | Use in this RFC                                           |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| GA4 ecommerce         | `Ga4ReportDefinitions.ts` (`purchaseRevenue`, `transactions`) | Works only for sites with GA4 ecommerce tracking.         |
| Relay billing         | Autumn over Stripe                                            | Relay's own revenue. A dogfood source.                    |
| Scoring               | RFC-0002 commercial score                                     | Can use revenue per page.                                 |
| Results               | RFC-0006                                                      | Can show revenue next to search metrics.                  |
| Playbook growth tools | `PlaybookMediaLLC/monorepo` `apps/growth-attribution`         | Exists in an empty state. Check its scope before phase 3. |

## 3. Goals

1. Record the first-touch landing page and source for each new customer, with consent.
2. Read payments from Stripe read-only, and join them to the first touch.
3. Show revenue and new customers by landing page and channel, with a coverage figure.
4. Use revenue in opportunity priority and show it in experiment results.
5. Store no personal data: no names, emails or addresses.

## 4. Non-goals

1. No multi-touch or data-driven attribution models.
2. No payment writes, refunds or customer changes in Stripe.
3. No billing providers other than Stripe in phase 1.
4. No ad platform data.

## 5. Design

### 5.1 Phases

| Phase | Delivers                                                                                    |
| ----- | ------------------------------------------------------------------------------------------- |
| 1     | Snippet and server helper, Stripe connection, daily sync, revenue reports, coverage.        |
| 2     | Revenue in opportunity priority and in experiment results.                                  |
| 3     | Other billing sources (Paddle, Lemon Squeezy) and the link to the Playbook attribution app. |

### 5.2 Attribution snippet

A small open-source package `@relay/attribution`, at most 2 KB, plus a Next.js helper.

1. On the first page view, and only after analytics consent, it writes a first-party cookie `relay_ft` with: landing path, referrer host, `utm_source`, `utm_medium`, `utm_campaign` and the timestamp. It expires after 90 days.
2. It never overwrites an existing `relay_ft` cookie. It is first touch.
3. It exposes `grantConsent()`, so a consent tool can enable it. Without a call, it does nothing in regions that the owner marks as consent-required.
4. The server helper `relayAttributionMetadata(cookieHeader)` returns Stripe metadata keys: `relay_ft_path`, `relay_ft_source`, `relay_ft_medium`, `relay_ft_campaign`, `relay_ft_at`.
5. The site passes them into Stripe Checkout `metadata` and `subscription_data.metadata`, or into customer metadata at sign-up.
6. The docs show both placements with code.

**As built (part A).** The snippet, the server helper and the channel rules are one dependency-free file, `src/shared/attribution.ts`, in this public repository; the whole file is 1.7 KB minified and the browser part 642 bytes. Sites copy it, and the guide shows both Stripe placements. Publishing it as the npm package `@relay/attribution` needs the owner's npm organization, so it is a follow-up. The cookie value is URL-encoded JSON with short keys, written with `Max-Age` 90 days, `Path=/`, `SameSite=Lax` and `Secure`. A referrer on the site's own host is not stored. The helper adds a sixth key, `relay_ft_referrer`, because the channel rules must tell a referring host from a `utm_source`; `relay_ft_source` is the `utm_source`, or the referrer host without one. A UTM source without a referrer or a medium counts as referral, not direct. Search engines are matched by host pattern, so country domains such as `google.co.uk` count.

### 5.3 Stripe connection

1. The owner creates a Stripe restricted key with read access to Checkout Sessions, Invoices, Subscriptions and Customers, and nothing else.
2. Relay accepts only restricted keys (`rk_live_` or `rk_test_`) and refuses secret keys (`sk_`). Stripe has no API that lists a key's permissions, so Relay probes one write endpoint with an invalid request body and requires a permission error. The invalid body means nothing can be created. Confirm this behavior in Stripe test mode before release.
3. Store the key encrypted with the RFC-0009 key, in `revenue_connections`: `id`, `project_id` (FK cascade), `provider` (`stripe`), `encrypted_key`, `key_version`, `account_id_hash`, `livemode`, `created_by`, `created_at`, `last_synced_at`, `revoked_at`.
4. Disconnecting deletes the key and all revenue rows for the project.

**As built (part B).** The connect form is a card in **Project settings > Conversion**, next to the chosen conversion, so no new settings tab is needed. Relay refuses `sk_` keys, requires the `rk_live_` or `rk_test_` pattern, reads one invoice to confirm read access, then probes `POST /v1/customers` with the unknown field `relay_read_only_probe`: a 403 is read-only, anything else is refused. The account id comes from the 403 message and is stored as a salted hash. The key is encrypted with the RFC-0009 publishing key helpers. A connection is one row per project with a random hash salt and the sync cursor; `revoked_at` is not built, because disconnecting deletes the row, and a new key also deletes the old rows, which the new salt could not match. Connecting and disconnecting write the RFC-0009 audit events `integration.stripe_connected` and `integration.stripe_disconnected`. The probe's behavior is unit-tested against Stripe's documented answers; confirming it with a real test-mode key is a follow-up.

### 5.4 Daily sync

1. An RFC-0008 task `revenue-sync` runs daily.
2. It lists paid invoices created since the last cursor, with pagination, at most 5,000 per run.
3. For each invoice, it reads the attribution metadata from the subscription, the checkout session or the customer, in that order.
4. It drops every personal field in memory. It never writes names, emails, addresses or payment details.
5. It stores one row per payment in `revenue_events`:

   | Column                                             | Type                                                                         |
   | -------------------------------------------------- | ---------------------------------------------------------------------------- |
   | `id`                                               | text primary key                                                             |
   | `project_id`                                       | text, FK cascade                                                             |
   | `external_id_hash`                                 | text, SHA-256 of the Stripe id with a per-project salt                       |
   | `customer_hash`                                    | text, the same for the customer id                                           |
   | `kind`                                             | text enum `first_payment`, `renewal`, `one_time`, `refund`                   |
   | `amount_minor`                                     | integer (negative for refunds)                                               |
   | `currency`                                         | text                                                                         |
   | `occurred_at`                                      | text                                                                         |
   | `ft_path`, `ft_source`, `ft_medium`, `ft_campaign` | text, nullable                                                               |
   | `ft_channel`                                       | text enum `organic_search`, `paid`, `email`, `referral`, `direct`, `unknown` |

   Unique on (`project_id`, `external_id_hash`).

6. Refunds are separate rows with negative amounts.

**As built (part C).** The job `revenue_sync` runs daily at 04:00 UTC. Stripe lists newest first and cannot sort oldest first, so the sync walks 7-day windows forward from the cursor, pages each window whole and stops at the first window boundary after 5,000 invoices: a window is never half-synced, and the cursor moves to the end of the last full window. Each run starts one window before the cursor, so an invoice paid after it was created is still found; the unique hash keeps one row per payment. The first sync reads 365 days. `billing_reason` gives the kind: `subscription_create` is a first payment, other `subscription_*` reasons are renewals, anything else is one-time. Metadata comes from the invoice's subscription details (both API shapes), then the newest Checkout session of the customer with a `relay_ft_at` key, then the customer; customer lookups are cached for the run. Refunds come from `/v1/refunds` with the charge expanded, which needs read access to Refunds and Charges; without it the sync skips refunds and says so. A refund takes the first touch of the invoice it refunds, from the same run or the stored row. Ids are hashed with the connection's salt, and Zod reads only the listed fields, so the fixtures' names, emails and addresses never reach the database (tested). A key under the previous RFC-0009 key version is re-encrypted on the next sync.

### 5.5 Channel rules

| Channel          | Rule                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `paid`           | `utm_medium` is `cpc`, `ppc`, `paid` or `paidsearch`.                                                                                |
| `email`          | `utm_medium` is `email`.                                                                                                             |
| `organic_search` | The referrer host is a known search engine (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave), and `utm_medium` is empty or `organic`. |
| `referral`       | Another referrer host.                                                                                                               |
| `direct`         | No referrer and no UTM values.                                                                                                       |
| `unknown`        | No attribution metadata.                                                                                                             |

The search engine list is one constant with tests.

### 5.6 Reports

1. Revenue, new customers and average first payment by first-touch landing page and by channel, for a chosen period and currency.
2. **Coverage:** the share of new customers with attribution metadata. When coverage is under 80%, show it first: "Only 54% of new customers have attribution data. Check the snippet."
3. Show amounts in each currency. Do not convert currencies in phase 1.

**As built (part D).** The upstream Results page belongs to upstream, so the report is a "Revenue by first touch" section on the fork's own **Experiments & Results** page, shown only when Stripe is connected. One period select (30, 90 or 365 days) replaces a currency select: each currency gets its own channel and landing-page tables (top 20 by revenue). Coverage is new customers whose first payment has a channel other than unknown; under 80% the warning replaces the coverage line. Revenue nets refunds that fall in the period.

### 5.7 Phase 2: priority and results

1. **Priority.** When a project has revenue data with at least 80% coverage, the RFC-0002 commercial score for a page = `min(1, first-touch revenue in 90 days / the 90th percentile across pages)`, and at least the role score.
2. **Results.** Experiments show new customers and first-touch revenue from the changed page for the baseline and observation windows. Show them only when each window has at least 10 new customers. Always state that payments can come weeks after the first visit.

**As built (phase 2).** Opportunity detection loads the revenue scores with its other first-party signals; they are null under 80% coverage, and then the GA4 rule applies as before. The 90th percentile is per currency, and a page takes its highest score across currencies, so amounts are never converted. Landing paths match page URLs without a trailing slash. Content gaps get no revenue score, because their pages do not exist yet. Experiment revenue is read when the experiment is read, not stored: events whose first-touch path is the experiment's page, by payment date inside each window. The windows are Search Console dates and the payment times are UTC, so a payment near midnight can fall into the next day. Below 10 new customers in either window, the page states the minimum and shows no numbers.

### 5.8 Phase 3

1. Paddle and Lemon Squeezy connections with the same rules.
2. Check the scope of the Playbook `growth-attribution` app. Decide whether Relay sends its revenue events there or reads from it.

## 6. Privacy and security

1. No personal data is stored. Hashes use a per-project salt.
2. The cookie is first-party, set only after consent where required, and holds no personal data.
3. Restricted read-only Stripe keys only. Write-capable keys are refused.
4. Update the privacy policy and offer a data processing agreement before launch.
5. Every connection change writes an RFC-0009 audit event.

## 7. Cost

Stripe API reads are free. Sync runs on Trigger.dev compute.

## 8. Alternatives considered

1. **GA4 ecommerce only.** Many SaaS businesses do not send purchases to GA4, and it misses renewals.
2. **Join by email between GA4 and Stripe.** Rejected. It needs personal data.
3. **Stripe OAuth (Connect).** Better consent flow, but needs a Stripe platform account and review. Restricted keys come first.

## 9. Ready-for-other-users checklist

### Phase 1

- [ ] `@relay/attribution` package with consent hook, first-touch rule and the 90-day cookie (tests).
- [ ] Next.js helper and Stripe metadata docs for Checkout and sign-up.
- [ ] Restricted-key check: refuses `sk_` keys, and refuses a restricted key with write access (probe tested in Stripe test mode).
- [x] `revenue_connections` and `revenue_events` in D1 and Postgres.
- [x] Daily sync with cursor, pagination, refunds and the 5,000 cap (tests with Stripe fixtures).
- [x] Test: no personal field reaches the database.
- [x] Channel rules with one test per channel.
- [x] Reports with coverage first, and amounts per currency.
- [x] Disconnect deletes the key and all revenue rows (test).
- [ ] Privacy policy and data processing agreement updated.
- [x] `content/docs/revenue-attribution.mdx`.

### Phase 2

- [x] Revenue-based commercial score with the coverage rule.
- [x] Revenue in experiment results with the 10-customer rule.

### Phase 3

- [ ] Paddle and Lemon Squeezy.
- [ ] Decision on the Playbook attribution app.

## 10. Real-site acceptance test

**Site:** S3 (Relay), first in Stripe test mode, then in live mode. Relay bills through Autumn on Stripe. Check that Autumn passes checkout metadata to Stripe. If it does not, attach the metadata to the customer at sign-up.

**Steps:**

1. Install the snippet on `relay.playbookmedia.io` behind consent.
2. In test mode, visit from a Google search result, a UTM email link and directly. Buy a plan from each visit.
3. Run the sync. Compare the report with the Stripe dashboard.
4. In live mode, run for 30 days.

**Pass when:**

- The three test purchases appear with the channels `organic_search`, `email` and `direct`.
- Revenue totals equal the Stripe dashboard for the same period.
- The database holds no email, name or address (schema and data check).
- After 30 days, coverage is at least 80% of new customers.

**Value check:** the owner sees which landing pages bring paying customers, not only visitors.

## 11. Completion criteria

**Accuracy**

- Revenue, refunds and customer counts equal Stripe exactly for 3 test periods.
- 100% of paid invoices in the period are synced once. Re-running the sync adds no rows.

**Privacy**

- A schema review and a data scan find no personal data.
- Disconnecting removes every revenue row within 1 minute.

**Coverage**

- At least 80% of new customers have attribution data after 30 days on S3.

**Usefulness**

- The owner names at least one landing page decision made from the report within the test month.
