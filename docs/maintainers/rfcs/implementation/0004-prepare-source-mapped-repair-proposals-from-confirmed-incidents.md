# IRFC-0004: Prepare source-mapped repair proposals from confirmed incidents

**Status:** Ready to build; specified against `develop` on 2026-10-28  
**Priority:** Required to reach the next core milestone  
**Prerequisites:** IRFC-0003  
**Canonical technical specification:** [RFC-0027](../0027-source-mapped-regression-repairs.md) phase A  
**Implementation order:** 0004 of 0032

## Implement this slice

From a confirmed title or description incident, prove which literal in the customer's Next.js source produces the bad production value. Then prepare an immutable, read-only proposal that restores the known-good literal. Refuse dynamic routes, ambiguous mappings, removed literals and source that does not produce the observed value, and turn each refusal into a useful ticket. Make no repository write and need no Search Console data.

Read RFC-0027 in full. Inspect `develop` before writing code: reuse what is listed here, and update this file if the code has moved.

## What exists to reuse

| Need              | Existing code                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL → file        | `locateMetadataFile(request, connection, url)` in `publishing/fileLocator.ts`: App Router only; returns `found`, `not_found`, `ambiguous` or `unsupported`, and names a dynamic segment                                                           |
| Path ↔ URL proof  | `validateTarget` via `validateMetadataTarget` (`nextMetadata.ts`) and `validatePagesTarget` (`pagesRouterHead.ts`)                                                                                                                                |
| Literal change    | `prepareChangeAt(client, connection, { filePath, url, sha, newTitle?, newDescription?, restore: true })` (`publishingTarget.ts`). It needs an existing string literal and never inserts one; `restore` skips the 10–60 character rule             |
| Title template    | `readTitleTemplate(client, sha, pagePath, rootDirectory)` (`layoutTitle.ts`): nearest layout, at most 3 files, requires `%s`                                                                                                                      |
| Restore precedent | `RevertService.prepare` (`experiments/RevertService.ts`), which reads the branch head and calls `prepareChangeAt(…, restore: true)`                                                                                                               |
| Proposal records  | `opportunity_proposals` and `proposal_text_edits`; `proposalFingerprint` (versions 2–6); `PublishingRepository.saveProposal`, gated by `claimExists`, `activeConnection` and `approvalEligible`; `withPublishingClaim`; audit `proposal.prepared` |
| GitHub reads      | `connectedGithub(connection, signal, { metadata: "read", contents: "read" })`, `getRepository`, `getRef(baseBranch)`, `readFile` (32 KiB cap, blob SHA check)                                                                                     |
| Tickets           | the regression ticket variant from IRFC-0003                                                                                                                                                                                                      |

Opportunity proposals stay exactly as they are. `proposableOpportunity`, the GSC site check and the 14-day window apply only to the opportunity variant. RFC-0027 forbids faking an opportunity.

## Data model

Generate both migrations. The SQLite migration for `opportunity_proposals` must be hand-written, because the generated one would delete data (see **The `opportunity_proposals` migration** below).

**`regression_source_mappings`** (in the protection schema): immutable, insert only.

| Column                                                         | Type and rule                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`, `project_id` (FK cascade), `regression_id` (FK cascade)  | text                                                                                                        |
| `evidence_version`                                             | integer: the incident version mapped                                                                        |
| `connection_id`                                                | FK `publishing_connections`                                                                                 |
| `repository_id`, `root_directory`                              | copied from the connection at mapping time                                                                  |
| `adapter_id`                                                   | the existing adapter enum (`app_router_metadata`, `pages_router_head`)                                      |
| `file_path`, `file_blob_sha`, `helper_path`, `helper_blob_sha` | the source that was read                                                                                    |
| `field`                                                        | `title` or `description`                                                                                    |
| `base_sha`                                                     | the base-branch head that was read                                                                          |
| `production_sha`                                               | nullable: the latest observed production deployment SHA, recorded beside `base_sha` and never assumed equal |
| `title_template`                                               | nullable                                                                                                    |
| `current_literal`, `restore_literal`                           | the source literal now, and the literal to write                                                            |
| `observed_value`, `expected_value`                             | the production value now, and the baseline value                                                            |
| `created_by`, `created_at`                                     | text                                                                                                        |

**`opportunity_proposals` gets an evidence variant**

- Make `opportunity_id`, `evidence_run_id` and `opportunity_version` nullable.
- Add three nullable columns: `regression_id` (FK `site_regressions`), `regression_evidence_version` and `source_mapping_id` (FK `regression_source_mappings`).
- Add a named check, `opportunity_proposals_evidence_check`. It requires either all three opportunity columns set and all three regression columns null, or the reverse. Name it identically in both dialects so `schema-parity.test.ts` compares it.
- Every existing opportunity query selects `opportunity_id is not null` in SQL, never filtering afterwards.
- The proposal readers, `MetadataExecutionService`, `RevertService`, experiment registration and the proposal UI get the nullable type. TypeScript lists every caller to update.

**The `opportunity_proposals` migration (the riskiest step in IRFC-0001–0005)**

On Postgres, this is `ALTER COLUMN … DROP NOT NULL`, three `ADD COLUMN`s and `ADD CONSTRAINT … CHECK`. Nothing is rebuilt.

SQLite cannot drop a `NOT NULL` without rebuilding the table, and the rebuild Drizzle generates would delete data on D1:

- It runs create new table, copy, `DROP TABLE opportunity_proposals`, rename (as in `drizzle/sqlite/0005_low_red_hulk.sql`).
- D1 ignores `PRAGMA foreign_keys=OFF` inside a migration, and dropping a table runs its children's `ON DELETE` actions.
- No migration since 0005 has rebuilt a table.

Today the drop would affect these tables:

| Effect of dropping `opportunity_proposals`          | Tables                                                                                                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rows cascade-deleted                                | `proposal_text_edits`, `proposal_approvals`, `proposal_executions` and their `proposal_execution_events`                                                                                                       |
| Rows cascade-deleted, along with experiment history | `growth_experiments`, and through it `experiment_deployment_signals`, `measurement_runs`, `measurement_days`, `accessibility_fix_checks` (and their children), `experiment_key_events`, `measurement_ga4_days` |
| References nulled                                   | `work_cycle_entries.proposal_id`, `work_cycle_entries.experiment_id`, `split_tests.proposal_id`                                                                                                                |

The libsql test database applies migrations outside a transaction, where the pragma does work, so tests will not catch this.

Write the SQLite migration by hand:

1. Start with `PRAGMA defer_foreign_keys = on`.
2. Copy every table in the closure into a backup table (`CREATE TABLE __bk_x AS SELECT * FROM x`). Recompute the closure from the schema when building, because it grows.
3. Rebuild `opportunity_proposals`.
4. Restore the deleted rows parent first, and restore the nulled references by ID.
5. Drop the backups. Deferred keys are checked at commit, when every reference is valid again.

Before merging:

- Rehearse on a copy of a real D1 database: export it, apply the migration with `wrangler d1 migrations apply --local`, and compare the row counts of every table before and after.
- Note a D1 Time Travel restore point before the production migration.

If the rehearsal loses or changes a single row, stop and bring it to the maintainer instead of shipping. The fallback design is separate regression proposal, approval and execution tables reusing `prepareChangeAt` and `publishProposal`. That avoids the rebuild but duplicates the execution state machine, which RFC-0027 argues against.

**Fingerprint version 7**

- `proposalFingerprint` appends `regressionId`, `regressionEvidenceVersion` and `sourceMappingId` for regression proposals.
- Versions 2–6 are unchanged, so stored opportunity fingerprints still verify.

## Service

`RegressionRepairService.prepare(context, { projectId, regressionId, expectedEvidenceVersion, filePath? })` in `src/server/features/protection/RegressionRepairService.ts`:

1. **Authorize.** Call `authorizePublishing(context, projectId, true)`, and require the enrollment to be `active` with `allow_repair_proposals`. Run the rest inside `withPublishingClaim`.
2. **Check eligibility before any GitHub call.**
   - The incident is `open` at `expectedEvidenceVersion`.
   - Its page is active and has a baseline.
   - Its rule is `title-changed` or `description-changed`.
   - `title-removed` and `description-removed` return `unsupported` ("the literal was removed, and this adapter cannot insert one"). Every other rule returns `unsupported` ("no supported source repair for this rule").
3. **Read the repository.** Get the active connection, call `connectedGithub`, check that `getRepository` returns the same repository ID and that it is not archived, then read `baseSha` with `getRef(baseBranch)`.
4. **Locate the file.**
   - `locateMetadataFile` must return `found`.
   - Otherwise, when the reviewer supplied a `filePath`, use it; `validateTarget` proves it serves the URL, which covers the Pages Router too.
   - Otherwise, return the locator's status and message.
5. **Read and prove.**
   - Read the file and any helper at `baseSha`, and the title template for titles.
   - Let `render(literal)` be `template.replace("%s", literal)` when there is a template, else the literal itself. Compare whitespace-squashed, as `comparePage` does.
   - `render(current literal)` must equal the incident's observed production value. Otherwise refuse with `source_mismatch`: "The repository's current source does not produce the production value. The cause may be in a layout, middleware or CMS, or the source change is not deployed yet."
6. **Derive the restore literal.**
   - For a description, it is the baseline value.
   - For a title with a template, the baseline must equal the template's prefix + X + suffix, and X is the literal. Otherwise refuse with `template_mismatch`.
   - For a title without a template, it is the baseline.
   - If the restore literal equals the current literal, refuse with `nothing_to_change`.
   - Example: source `Pricing` renders `Pricing | Acme` and must be restored as `Pricing`, never as `Pricing | Acme`.
7. **Prepare the change.** Call `prepareChangeAt(…, { filePath, url, sha: baseSha, newTitle | newDescription: restore, restore: true })`. Then check that `render(after)` equals the baseline value.
8. **Save.** Write the mapping and the proposal in one `runBatch` through a regression variant of `saveProposal`.
   - The variant is gated by `claimExists`, `activeConnection` and a new `regressionEligible`. That check requires the incident `open` at the same evidence version and the enrollment `active` with repairs allowed.
   - Proposal fields:
     - `change_kind`: `metadata`.
     - `reason`: "Restore the known-good {field} on {path}".
     - `expected_effect`: "Production serves the known-good value again."
     - `verification_plan`: "After the customer deploys, Relay re-runs the original rule on production (IRFC-0006)."
     - `fingerprint_version`: 7.
   - Audit with the existing `proposal.prepared` action.
9. **Deduplicate.** Return an existing proposal for the same incident, evidence version and `baseSha` instead of creating another.

A proposal is **stale** when any of these holds:

- the incident is no longer `open`;
- its `evidence_version` changed;
- a newer proposal exists for the incident;
- the base branch head moved past `baseSha` (checked when the page loads).

A stale proposal shows **Prepare again** and can never be approved.

Server functions in `src/serverFunctions/protection.ts`: `prepareRegressionRepair` (POST), and `getRegressionRepair` (GET), which returns the proposal, mapping, stale state and reasons.

## Interface

- **Prepare repair** on the incident page appears when the enrollment allows repairs and a publishing connection exists.
- The result shows:
  - the file, field and title template;
  - the current and restore literals, and the observed and expected rendered values;
  - the diff snippets, reusing the proposal diff pieces from `src/client/features/publishing/PublishingProposal.tsx`;
  - the risk and the verification rule;
  - **Read-only; nothing was written to your repository.**
- A refusal shows its reason, offers a file-path field when the locator could not decide, and offers **Create ticket** with the reason included.

## Tests

- `RegressionRepairService.test.ts`, with a fake GitHub client as in `MetadataProposalService.test.ts`:
  - a literal description is restored;
  - a templated title restores `Pricing` from `Pricing | Acme` without duplicating the suffix;
  - a dynamic route is refused before any file read;
  - an ambiguous location is refused with the locator's reason;
  - a removed literal is unsupported;
  - a source that renders another value is a `source_mismatch`;
  - no GSC connection is needed;
  - a stale `expectedEvidenceVersion`, a resolved incident and an enrollment without repairs are each refused before any GitHub call;
  - preparing twice at one `baseSha` returns one proposal.
- Real SQLite and Postgres through the protection and publishing test databases:
  - the evidence check rejects a row with both variants and a row with neither;
  - `saveProposal`'s regression variant refuses a closed incident;
  - the existing `PublishingRepository` and `publishingExecution` tests pass unchanged.
- **Migration test (SQLite).** Seed a proposal with text edits, an approval, an execution and its events, an experiment with deployment signals and measurement days, and a This Week entry and a split test that reference it. Apply the migration inside one transaction with foreign keys on, as D1 does. Every row and reference must survive.
  - The test database's usual migration path will not reproduce D1, so this test must set that up itself.
  - It does not replace the rehearsal on a real D1 copy.
- `proposalFingerprint.test.ts`: version 7 changes when any evidence field changes, and versions up to 6 produce the same hashes as before.

## Acceptance gate

Use an authorized Next.js staging repository with a literal description and a templated title, both with accepted baselines.

1. Deploy a regression of each and let IRFC-0003 confirm them.
2. Prepare both repairs. Each must be read-only, show the exact diff and restore the known-good rendered value. The title must not duplicate its template suffix.
3. Run the same flow with no Search Console connection.
4. Trigger a regression on a dynamic route and a header-only regression. Each must give a refusal with a ticket and no source guess.
5. Change the incident evidence after preparing. The old proposal must show stale.

## Explicit boundary

No write, PR, merge, or automatic source regeneration. No literal insertion, canonical/robots repairs, or rendered-HTML-to-source guesses.

## Engineering verification

- Preserve the existing authenticated project boundary, user permissions and source/approval authority. Run behavior tests for all new invariants and applicable real-SQL, schema parity, type-check, lint and focused E2E checks.
- State what was tested with fixtures and what was tested on a live authorized site. Never treat a test fixture or an unmerged PR as a production result.
- Record a short, evidence-backed completion note with links to implementation PRs and tests. If this item is already satisfied, mark **verified existing**. Do not block later unrelated work.

**Next:** [IRFC-0005](0005-authorize-exact-pr-writes-and-check-customer-owned-previews.md)
