# RFC-0035: Customer-facing asset inventory, snapshots, and claim provenance

- **Status:** Proposed
- **Date:** 2026-10-27
- **Implementation position:** Slice 2: selected Git-backed asset and cited claim
- **Depends on:** RFC-0030, RFC-0031, RFC-0033 and RFC-0034; reuse existing RFC-0017 docs index and RFC-0019 production snapshots only when implemented.
- **Commercial consumer:** Relay Sync

## 1. Problem and initial scope

The existing docs index records paths, titles, headings, counts and blob SHAs. It does not identify individual statements that say what a feature costs, who can access it or how to activate it. Relay also lacks a cross-surface inventory linking public marketing pages, docs, knowledge-base articles, pricing references and approved sales materials to the source revisions that actually contain those claims.

Build a bounded, consent-based asset registry and source-backed claim occurrences. Initial assets: repository-managed `.md`/`.mdx` documentation, structured plan tables, and supported Next.js static marketing pages, plus their corresponding public URL observations. Do not promise extraction from arbitrary client-rendered web apps, private help centers or uploaded slide decks in phase 1.

## 2. Asset identity, observations, and mapping

Asset identity is not identical to URL identity: one GitHub file may render multiple routes; one public route may be served by dynamic code; a locale variant may have distinct claims. Model separately:

| Table | Role / important constraints |
|---|---|
| `reality_assets` | `(project_id,kind,canonical_key)` stable identity, title, owner, audience scope, status; unique active key |
| `reality_asset_locations` | source kind, repo/branch/path or normalized public URL, locale, environment, validity interval; explicit many-to-one mappings |
| `reality_asset_snapshots` | immutable asset version, source revision SHA, observed URL/HTTP state, normalized hash, collection time, extraction version, coverage status |
| `reality_claims` | canonical claim about subject/predicate/scope; may remain `unresolved` without an accepted fact |
| `reality_claim_occurrences` | snapshot ID, claim ID, bounded exact quote, byte/AST span or selector, extracted typed value, scope interpretation, state, confidence, parser version |
| `reality_claim_evidence` | claim occurrence to fact version, source observation or owner note; explanation and reviewer decision |
| `reality_asset_ownership` | linked human or team ID, notification preference, role and effective interval |

Every relationship must include project scoping. Hashes alone are not asset IDs; canonical keys must survive an ordinary source edit. A rename/move emits an alias link with provenance instead of silently duplicating ownership. Dynamic routes without provable mapping remain read-only observations.

## 3. Snapshot and text-extraction strategy

1. Connect the selected repository and declare allowed directories, file extensions, page categories and URL origins.
2. Read tree metadata incrementally; use existing RFC-0017 parser for docs to avoid reparsing unchanged blobs. Preserve the current 500-file / 10 MB / 200 changed-file per run ceilings until measured demand justifies a separate product-specific entitlement.
3. Extract candidate claims with deterministic frontmatter/Markdown AST and configured pricing/feature schemas first. For text claims, a bounded model may suggest `subject`, `predicate`, `value`, `scope` and an exact citation span, but never write or mark it accepted.
4. Store normalized snippets and span hashes. Verify the quoted span exists in the exact captured blob before using it as evidence. Do not retain all page text in relational tables.
5. Observe public URL separately using safe origin-bound fetch/CI preview infrastructure. Compare source-to-production only when route and deployed SHA are sufficiently proven; otherwise show mapping unknown.
6. Incrementally re-extract when blob hash or extractor version changes. A changed parser version should not rewrite old claim evidence; append a new extraction run.

**Critical distinction:** source snapshot says what a repo file contained; rendered snapshot says what the visitor saw; a product fact says what the product actually supports. They are separate assertions.

## 4. Claims and matching rules

Three types of claim candidate:

- **Exact structured:** prices, units, limits, visible feature availability parsed from a known schema or approved field. High value, deterministic comparison where scope agrees.
- **Bounded textual:** “Only Business customers can use SSO” mapped to `feature:sso.available_on_plan`. Requires exact textual evidence and human validation if ambiguous.
- **Visual/interaction-dependent:** a screenshot demonstrates a UI step. Do not infer accessibility or product truth from image similarity alone; later adapters may compare captions, route names and screenshot freshness metadata.

A claim occurrence enters states `extracted`, `mapped`, `ambiguous`, `reviewed`, `stale`, `dismissed` and `superseded`. `stale` requires compatible accepted fact evidence; no accepted fact means `needs_validation`, not `false`.

A text span's scope comes from explicit page targeting, product edition, locale tags or reviewer input; it must not be silently assumed global. Keep precise quote offsets relative to the immutable blob and reject patches when offsets/source SHA drift.

## 5. Retrieval API and indexing

```ts
listAssets({ projectId, kind?, status?, cursor?, limit? })
getAsset({ projectId, assetId, snapshotId? })
listClaims({ projectId, assetId?, subjectKey?, state?, cursor? })
recordClaimReview({ projectId, occurrenceId, expectedGeneration, decision, reason })
findOccurrencesForFacts({ projectId, factVersionIds, maxMatches })
```

Use normalized relational indexes for subject/predicate/asset joins and project scope. Optional full-text/embedding retrieval is **candidate discovery only** and must be anchored to real asset snapshots with exact spans. Do not store or search across customer projects in shared indexes without hard tenant isolation and deletion support.

## 6. Operations and abuse budgets

- Default first pilot scope proposal: at most 100 declared marketing/docs assets per project and at most 500 claim candidates per run; tune after customer measurements, not based on unbounded crawls.
- Per-file parsing limits, model token ceilings, domain verification and total daily cost admission are mandatory.
- Do not crawl private customer data or authenticate as an end user merely because an asset URL is discoverable.
- Sanitize markdown/HTML previews and preserve safe, non-executable text in the review UI.
- Reject DNS rebinding/redirect-to-private-network; use current crawler URL policy plus egress restrictions where possible.
- Removal/revocation must remove snapshots and search indexes according to project retention policy; do not leave orphaned model embeddings.

## 7. Phases and concrete acceptance

**A — Inventory:** GitHub docs and configured static marketing pages, with explicit origin/path mapping; list unsupported paths and last healthy scan. Test symlink/submodule, duplicate names, locale renames and file limits.

**B — Claim occurrences:** three predicate families (price, plan availability, integration availability), exact quote + SHA + scope, review UI. Test unsupported prose does not become a confident claim.

**C — Source/public correlation:** public URL capture and proven mapping for supported static routes, rendering-aware verification only when needed. Test built page that differs from source; state remains unknown until mapped.

**D — Incremental re-index:** rate, spend and stale-coverage reporting. Acceptance: no duplicate claim occurrences for the same extraction version and blob, obsolete version remains audit-addressable, and customer data erases cleanly.

Required scenario: a feature page says “Available on Business in the US,” and a general FAQ says “Available everywhere.” The detector reports the second claim only after establishing that the FAQ actually targets the affected region and plan. Another scenario with valid grandfathered cohorts must not yield a false contradiction.

## 8. Alternatives and responsibilities

Do not replace customer CMS or rehost a help center. Do not use the live website as unquestioned product truth. Keep existing RFC-0017 docs jobs and schemas intact until adapter compatibility is proven. Marketing/Docs owner may accept intentional variations; every dismissal stores scope, reason and expiry so it can be revisited after a relevant change.
