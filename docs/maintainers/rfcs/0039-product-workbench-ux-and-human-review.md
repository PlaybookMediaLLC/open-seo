# RFC-0039: Relay Workbench — change timeline, evidence review, and accountable actions

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slices 1–4: progressively richer reviewer UI; do not defer the first read-only screen
- **Dependencies:** RFC-0030–0038 for the complete workbench; a read-only Changes view may ship earlier using RFC-0033 alone. Reuse existing project shell, Opportunities, This Week, publishing proposal and Activity.

## 1. User problem

A broad operations product can become an unmanageable wall of SEO metrics, release notes, fact conflicts, alerts and AI suggestions. Relay's primary screen must tell an operator **what changed, what is actually wrong, which decision is needed, and whether the work was verified**. A beautiful agent chat cannot substitute for inspectable evidence and exact-change approval.

**Decision:** make the **Change Workbench** the organizing object, with direct navigation to Protect, Sync and Launch. Reuse current `/p/$projectId` navigation patterns, existing opportunity/review and work-report components, and the activity log. Do not replace existing SEO research screens or force customers to run their project from chat.

## 2. Navigation model

- **Today / Work:** Completed, measuring, action needed, protection coverage, degraded sources. Extend current RFC-0018 `This week` view rather than create another independent queue.
- **Changes:** chronological stream of sourced releases/config changes with `proposed / observed / live verified` distinctions.
- **Protect:** declared pages and journeys, monitoring health, incidents, proposals, verified fixes.
- **Sync:** fact authority, asset coverage, stale/ambiguous claims, approved corrections.
- **Launch:** release packets, dependencies, owner readiness, approved materials, publication receipts.
- **Sources & access:** connector scopes, health, latest successful observations, revocation and coverage.
- **Research:** existing SEO, audits, rank, backlinks, AI visibility and reports remain available, but not the top-level explanation of Relay's mission.

The top-level navigation can initially show only Protect and Changes; Sync and Launch appear behind customer-scoped feature flags. Don't advertise a module as working when only its RFC exists.

## 3. Change detail page anatomy

Header: change title, state, observed/effective/deployed timestamps, provider revision and environment. This page never displays an unproven “deployed” badge.

1. **Evidence:** exact source links, hashes, typed fact changes, scope and any conflicts; expandable original statements.
2. **Affected:** grouped affected assets/claims/journeys and confidence state; verified contradictions distinct from potential matches.
3. **Plan:** typed actions, owners, dependencies, pending approvals and reason for each action. Read-only actions are visibly separate from external writes.
4. **Review:** before/after exact diff, source/fact version, expiration, impact and rollback, plus explicit approval action. No one-click blanket authorization.
5. **Execution:** external PR/receipt and status; current target revision, conflicts and recovery.
6. **Verification:** per-postcondition pass/fail/unknown attempts, snapshots and later metric windows.
7. **History:** approvals, denials, overrides, external customer fixes, operator comments and source-health changes.

On every tab, show what is **not covered** and why, including unsupported dynamic routes, missing provider permissions and insufficient analytics. Use ordinary labels rather than a misleading single “AI confidence” score.

## 4. Interaction rules

- A finding is actionable from the list only when there is an authorized next step; otherwise display `Investigate`, `Assign` or `Reconnect source`.
- Clicking approval presents exact target account/repository, action fingerprint, source revision, required checks, scope and consequences. Approval can't be satisfied by a browser navigation or previously checked default box.
- Show clear copy when a provider outage or rate limit means Relay did not check a surface. A quiet week is healthy only with recent successful checks.
- Group same change impacting ten pages under one change, but allow each page's distinct owner, source and resolution state.
- Reviewer can dismiss a misleading match with reason and expiry; a newer material fact version may reopen it with explanation.
- For a source conflict, compare evidence side by side and require a fact owner to choose the applicable scope; do not silently edit customer pages.
- Screen-reader interaction, keyboard traversal, consistent focus order and accessible diff markup are release requirements for an operations workbench.

## 5. Empty, partial, and failure states

| State | User-facing result |
|---|---|
| No source connected | “Connect GitHub or enter a verified change to begin,” with exact scopes requested |
| Connected, no accepted facts | Evidence intake active; cannot yet verify public claims |
| No actionable issues, healthy scans | “No confirmed issues in the monitored scope,” with last successful check/coverage |
| Data source stale | “Last checked X; protection is degraded,” reconnect/retry action |
| Candidate impact without scope | “Needs an owner to confirm plan/region,” not “outdated content” |
| PR merged, prod unverified | “Merged; awaiting production verification,” with check details |
| Verification inconclusive | Show provider/state reason and next scheduled attempt |
| Spend budget exhausted | No paid checks, honest paused coverage, visible remediation |
| Customer fixed it | Mark external resolution with evidence, not Relay-attributed repair |

## 6. API and state model

Server functions use validated `{projectId,changeId,expectedGeneration}` or child record IDs; every response includes `coverage`, `evidenceFreshness`, and `requiredPermission` if relevant. Paginate event history and asset lists; don't serialize hundreds of claim occurrences into initial route data. Use TanStack Query for read cache invalidation keyed by project and generation. Long-running checks return a job ID and current state, not an artificial successful result.

For UI code, follow `src/client` existing Base UI/shadcn conventions; `AGENTS.md` specifies `render` props rather than Radix `asChild`. Keep edits on existing page components where possible; add a compact `Changes` route for the new domain. Status badges must not imply more authority than actual evidence.

## 7. Success measures and tests

Measure time from change detection to a reviewer understanding why it matters; approval completion, false-confirmed-drift reports, overlooked blocked tasks, time to verified resolution, weekly active protected paying sites, and whether customers use the weekly report. Product metrics must exclude agent-suggested but unreviewed items from “completed.”

**A:** Change list + source/evidence detail; keyboard and empty state acceptance.

**B:** Impact list and reviewed facts/claims; no external write.

**C:** Approvals linked to existing publisher, execution receipts, verification timeline and work report.

**D:** Flagged Sync/Launch screens when those services ship, plus later API/MCP entry links.

Test large timeline pagination, concurrent reviewers, stale approvals, account switching, cross-tenant deep links, 429 failure state, long evidence quotes, unavailable external link, mixed-success work plan, mobile viewport/keyboard/screen reader, and stale provider cache. A UX review must include at least two actual target-role operators before claiming readiness.

## 8. Alternatives

Reject making agent chat the only UI, a single green/red organization status, a second queue duplicating This Week, and launching all modules in navigation before their underlying services are accepted.
