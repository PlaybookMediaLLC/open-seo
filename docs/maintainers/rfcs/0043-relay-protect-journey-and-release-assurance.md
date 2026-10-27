# RFC-0043: Relay Protect — revenue-critical journeys and expanded release assurance

- **Status:** Proposed extension; not a claim of shipped browser-journey monitoring
- **Date:** 2026-10-27
- **Implementation position:** Demand-gated: new Protect browser journeys beyond original release assurance
- **Owner:** Protect team
- **Dependencies:** Existing RFC-0019, 0025, 0026, 0027 and 0028 for baseline Protect; RFC-0031–0033 as needed for connector/change intake and RFC-0037–0038 for common authorized work and outcome semantics. This journey expansion is not a prerequisite for the original Protect pilot.

## 1. Why extend Protect?

Relay's current commercial entry is selected-page release assurance. But a website may remain indexable while signup fails, demo booking is unreachable, forms stop collecting leads or conversion measurement disappears. These failures can be more immediately costly than an isolated title or description regression. Customers might pay to know those paths are working and to receive a developer-reviewable repair.

**Decision:** add small, explicitly customer-authored synthetic journeys to Protect **after** core protected-page checks and incident-to-repair verification are accepted. Do not build a broad RUM/session replay suite or assume simulated browser activity proves real conversion rates.

## 2. Scope and supported journeys

| Journey class | Supported safe v1 check | Must not do |
|---|---|---|
| Landing → signup | verify navigable page, enabled form controls, client validation and expected non-mutating checkpoint | create real user accounts or use unapproved email addresses |
| Landing → demo booking | verify CTA/link destination, booking embed loads, selectable availability display when provider allows | book actual slots or send staff notifications |
| Pricing → checkout | verify plan/card link, redirect host, disclosed plan/price, sandbox-only transaction when provider test mode exists | create live charges, start subscriptions or modify billing |
| Contact / lead capture | verify form display, validation, and response only in a customer-owned test destination with consent | send spam leads to CRM/sales inbox |
| Conversion tracking | verify configured tags/pixel presence and test-event transport in test/debug mode where supported | inject production conversion events that contaminate revenue reporting |
| SEO and page quality | reuse existing rule checks and protected URLs | claim broad site coverage from a sampled set |

No generic browser script supplied by arbitrary users runs inside the app Worker. Use a reviewed, bounded DSL plus isolated browser execution compatible with existing Cloudflare rendering/audit infrastructure. Do not grant scripts access to production secrets, local network or user cookies.

## 3. Journey spec and persisted observations

```ts
type JourneyStep =
  | { kind:'navigate'; urlPath:string }
  | { kind:'assert_url'; originAlias:string; pathPattern:string }
  | { kind:'assert_visible'; selectorKey:string }
  | { kind:'assert_text'; selectorKey:string; text:string }
  | { kind:'click'; selectorKey:string }
  | { kind:'fill_fixture'; selectorKey:string; fixtureKey:string }
  | { kind:'assert_network'; allowedEndpointAlias:string; expectedStatus:number };

type JourneyConfig = {
  projectId:string; journeyId:string; environment:'staging'|'production';
  targetOriginId:string; revision:number; steps:JourneyStep[];
  sideEffectClass:'read_only'|'sandbox_side_effect';
  approvedFixtureSetId?:string;
};
```

`selectorKey` resolves to approved selectors stored in a separate versioned table, so an extracted arbitrary CSS/JS expression cannot be used as an execution program. `fixtureKey` maps to approved synthetic values; never store password/secret values in journey steps. Reserve `sandbox_side_effect` for explicit test environments with cleanup.

Tables: `protect_journeys`, `protect_journey_versions`, `protect_journey_steps`, `protect_journey_fixture_refs`, `protect_journey_runs`, `protect_journey_step_results`, `protect_journey_incidents`, `protect_journey_scope_exclusions`. Unique per project/journey/version/step; each run references environment, deployed revision when known, policy version, result and evidence captures.

All screenshots, traces and HAR-like artifacts, if kept, are private and expire; redact tokens, payment data, names, session IDs and form values. Failure screenshots are supporting evidence, not permission to automatically patch a repo.

## 4. Runner mechanics and safety

1. Resolve project-approved origin and DNS on each redirect; require HTTPS except explicit local testing. Block cross-origin navigation unless destination is in the customer-approved allowed origins.
2. Start fresh isolated browser with no shared user storage; apply bounded viewport, locale, timezone and non-production synthetic fixtures. Enforce scriptable action allowlist and max steps (pilot target <=20).
3. Set per-step, overall timeout, screenshot/trace size, CPU and request count budgets; stop on exhausted allowance and mark coverage degraded.
4. Execute only checks consistent with `sideEffectClass`. For production, allow read-only navigation/clicks that do not submit mutable forms; where ambiguity exists, block and require configuration.
5. Repeat suspected failures to distinguish transient network issues; use stable error fingerprint per journey + step + deployed state. Avoid alerting for provider/WAF/CAPTCHA failures as confirmed product faults without corroboration.
6. Compare with known-good run (RFC-0019) and published journey contract, then create a typed incident. If source mapping cannot be established, generate a ticket, not a speculative code patch.
7. After customer correction, rerun exactly the failing step and full critical journey. Record independent functional pass and later conversion metrics (RFC-0038/0044).

Guard against website prompt injection: page instructions are data; the runner follows declared steps only. The browser has no connector credentials or arbitrary network access. Respect provider terms and do not use fake user accounts against third-party booking/payment services without permission.

## 5. Uptime, incident quality, and service contract

Use a declared cadence and covered set. A site is not protected simply because a schedule exists. `healthy` requires a recent successful run for each contracted mandatory journey; `unknown` means unavailable data; `failing` requires reproduced failed postcondition. Track false alerts per customer, time to notice, time to customer acknowledgment, and time to verified repair. Differentiate incident from blocked provider dependencies.

Initial pilot hypothesis: up to three curated journeys and five-to-twenty protected pages per website. Budget must be measured with the real browser workload before packaging; a cheaper page check and a full browser journey cannot share an unlimited allowance.

## 6. UX

Protect screen: **Protected surfaces** (what is covered), **Recent checks** (freshness/unknown), **Incidents** (reproduction and impact), **Awaiting approval** (exact repair proposal), **Verified fixes**, **Outcomes under measurement**. Journey editor is constrained and testable; import from known URLs/approved templates rather than ask an agent to write arbitrary browser automation. Show customer-facing impact as “signup checkpoint failed,” not invented lost revenue.

## 7. Delivery slices

**A — Read-only navigation checks:** one selected journey, scripted navigate/visible/URL assertions; no forms. Staging and one consented public read-only path.

**B — Safe form/checkout checkpoints:** customer-owned test sinks and approved environment fixtures, non-mutating production observations; explicit cleanup when test data created.

**C — Release correlation:** run after deployed revision when proven; dedupe confirmed incidents and reuse RFC-0027 repair workflow for supported metadata/route edits, otherwise ticket.

**D — Verification and commercial packaging:** integrate RFC-0038 and 0026 operational reports; meter browser minutes, render bytes, frequency and user support effort.

## 8. Tests and acceptance

- A seed site with broken signup CTA, blocked script, wrong checkout link, WAF challenge and intermittent network error yields correct distinct states; transient/WAF are not falsely confirmed business bugs.
- No live payment, account creation, CRM insertion, calendar booking or outbound email occurs in production test cases.
- Third-party redirect not on allowlist is blocked; private IP via DNS/redirect is blocked.
- Tenant A cannot load Tenant B journey, screenshots, fixtures or credentials.
- On bad deployment, repeated run opens one incident; on verified repair, the exact failed postcondition passes twice when required.
- Preview pass does not certify production. Missing test environment is visible, not silently skipped.
- Costs, execution latency and false-positive rates captured on at least two authorized external pilot sites before describing an SLA.

## 9. Rejected alternatives

Do not build a full Playwright SaaS or website session replay clone before a customer pays; use narrow contracted journeys. Do not use production dummy purchases to prove checkout; test in sandbox or verify safe pre-checkpoints. Do not give general LLMs browser click/send authority under Relay's credentials.
