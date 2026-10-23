# RFC-0027: Source-mapped repairs from confirmed regressions

- **Status:** Proposed; no incident-to-proposal path exists yet.
- **Date:** 2026-10-23
- **Delivery:** Stage 2, before preview integration and verification.
- **Depends on:** RFC-0019 phases 1a–1b (baseline and confirmed incident), RFC-0005 adapters and exact-change execution, RFC-0009 authorization/audit controls. Uses the scope agreed in RFC-0026 phase A. Preview and resolution consumers are RFC-0025 phase 1a and RFC-0028; they do not block preparing a read-only proposal.

## 1. Problem and outcome

`proposalEligibility.ts` and `MetadataExecutionService.ts` require a recent approved Search Console opportunity on the connected property. `opportunity_proposals` requires opportunity/run/version foreign keys. `RevertService` reverses a previous Relay proposal, not an arbitrary customer deployment.

A confirmed release incident needs its own evidence path. It must be possible to propose a supported repair on a newly protected or low-traffic page without fabricating a search run, relaxing the existing opportunity gate, or turning rendered HTML into an unproven source edit.

The result is a narrow proposal showing the baseline, confirmed failing observations, source mapping, exact diff, risk, and verification rule. A person authorizes repository writes; the customer merges and deploys.

## 2. First supported slice

Support title and description literals in the existing static Next.js App Router, approved helper-call, and supported Pages Router adapters. Enable each adapter only after its mapping and restore acceptance passes. An unsupported or ambiguous mapping yields a ticket with the same evidence.

Canonical and literal robots metadata are a later slice using the existing adapters. Headers, CDN configuration, dynamic routes, arbitrary helpers, rewrites, and shared layout edits are detection/ticket paths initially. Static `robots.txt` restores need their own narrow patch/check contract before activation. Do not roll back whole commits.

## 3. Link observed behavior to source

A known-good rendered value is evidence of behavior, not necessarily the literal to write. A source mapping must record:

- Project, monitored page, baseline snapshot, repository identity, root, adapter, and route.
- Verified production source commit when available; distinguish it from a merely observed deployment event or current branch head.
- Source file/blob, field and literal, helper file/blob where used, and relevant inherited title template or other supported transformation.
- Expected rendered value produced by the supported transformation and the matching baseline observation.

Add normalized `regression_source_mappings` and reference it from repair proposals. Capture a mapping at baseline when production provenance is available, or reconstruct it later from a provable historical commit. Never assign the current base-branch SHA to an old snapshot because it is convenient.

At proposal preparation, read current source again and prove that the observed bad value maps to that source and that restoring the previous literal is still applicable. A template change, computed value, ambiguous route, unknown production provenance, or unrelated source edit may invalidate the mapping. Fail closed with a specific reason and a ticket. A removed literal may be restored only if the adapter proves an unambiguous insertion site; otherwise refuse it.

For example, a source title `Pricing` may render as `Pricing | Acme`. Restore `Pricing` through the verified template; do not write the whole rendered string and produce `Pricing | Acme | Acme`.

## 4. Evidence and proposal model

Extend the existing proposal model with explicit relational evidence variants. Preserve the current opportunity path. The proposed regression variant carries `regression_id`, `source_mapping_id`, and an incident evidence version; the opportunity variant retains its opportunity ID, evidence run, and version. Enforce exactly one complete evidence variant with database constraints in SQLite and Postgres, plus boundary schemas. Do not hide the relation in a JSON/text field or synthesize an opportunity.

The shared proposal includes the source/base SHA, before/after blob hashes and snippets, adapter identity, target URL, change kind, and a fingerprint over the exact edit **and its evidence variant**. Referenced snapshots/mappings are immutable or versioned. Updated evidence or source produces a new proposal and invalidates old authorization.

Keep execution checkpoints, approval rows, deterministic branch identity, GitHub access checks, and auditing in the existing publishing path. Add a typed evidence validator for the regression variant rather than a second less-restricted publishing system. The regression must still be confirmed, open, in the active protected scope, and at the evidence version the reviewer saw.

Experiment registration currently requires an opportunity and GSC. A technical repair must not create a fake experiment just to be executable. RFC-0028 records its production verification independently; optional growth measurement can attach later when eligible.

## 5. Lifecycle and authority

1. Confirm the incident under RFC-0019 and load its immutable baseline/bad observations.
2. Resolve and verify the source mapping; return an actionable unsupported result when proof is absent.
3. Prepare the exact proposal with no repository write. Show the literal and rendered expectations, suspect cause confidence, changed files, and original verification rule.
4. Obtain explicit approval to create the branch and PR for this fingerprint. Recheck permissions, incident state, repository identity, base/blob/helper hashes, and evidence freshness at execution.
5. Use the customer's CI and RFC-0025 phase 1a preview to check the resulting PR head. Unknown or failed checks remain visible and block Relay's readiness recommendation.
6. The customer reviews, merges, deploys, and controls rollback. RFC-0028 verifies the original failure afterward.

An incident already fixed, accepted, dismissed, or superseded cannot produce another active repair. Enforce deduplication per incident/current proposal, recover interrupted writes through existing execution checkpoints, and revalidate permission revocation on retry. A stale proposal must be prepared and approved again. No standing approvals or automatic merge in this slice.

## 6. Phases and cost

**Phase A:** Schema/evidence extension, source mapping, read-only metadata repair proposals, and unsupported tickets. This can ship independently of previews.

**Phase B:** Reviewed execution through the existing publisher and integration with RFC-0025 phase 1a and RFC-0028. Complete RFC-0019 phase 1c only when the entire loop passes.

Use bounded GitHub reads and deterministic parsing first. Known-good restoration does not need model generation. Preserve request budgets and existing token handling; disclose any optional paid investigation. Source snippets and audit events must not contain credentials or unrelated private code.

## 7. Ready-for-other-users checklist

- [ ] The existing opportunity approval path remains behaviorally unchanged.
- [ ] A confirmed regression can prepare a proposal without GSC connection/history or a fabricated opportunity.
- [ ] Exact-one evidence constraints, project scoping, and evidence fingerprints pass on both database dialects.
- [ ] Static literals and helper/template transformations map correctly; computed, dynamic, ambiguous, or stale source is refused.
- [ ] A missing literal is either inserted through a proven adapter contract or becomes a ticket.
- [ ] Current incident/source/permission revalidation rejects stale approvals and revoked access before writes.
- [ ] Duplicate execution and retry after a partial GitHub write produce at most one recorded PR for the approved change.
- [ ] The UI links incident → source → proposal → preview/PR → verification without implying merge or deployment occurred.
- [ ] Customer documentation states supported adapters and ticket fallbacks.

## 8. Acceptance

Use an authorized Next.js staging repository with a literal description and a templated title. Capture a proven known-good baseline, deploy a controlled metadata regression, confirm it twice, and prepare the exact source restore. The title fixture must prove that the template suffix is not duplicated. Run a second case with no GSC history.

Between preparation and execution, separately change the helper, change the base source, resolve the incident, and revoke the connection. Each case must stop stale execution. Retry an interrupted valid execution and confirm it does not duplicate the PR. Exercise a dynamic route and a header regression: both remain useful tickets, with no source guess.

A customer reviewer must be able to trace the proposal back to the failing observation and understand the edit in under ten minutes. Production resolution is not claimed here; it requires RFC-0028.

## 9. Alternatives

Reusing opportunity rows with fake search evidence would corrupt provenance and measurement. Copying rendered HTML into source would break template/helper cases. A separate unrestricted publisher would drift from established controls. The chosen extension preserves the publishing guarantees and adds only the missing evidence source.
