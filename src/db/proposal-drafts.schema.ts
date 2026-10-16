import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";
import {
  DRAFT_KINDS,
  DRAFT_SOURCE_KINDS,
  DRAFT_STATUSES,
} from "@/types/schemas/proposalDrafts";

// RFC-0004 phase 1: model-written drafts that a person may use in a proposal.
// A draft never reaches a repository without the exact-change approval.
export const proposalDrafts = sqliteTable(
  "proposal_drafts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    opportunityVersion: integer("opportunity_version").notNull(),
    evidenceRunId: text("evidence_run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DRAFT_KINDS }).notNull(),
    status: text("status", { enum: DRAFT_STATUSES }).notNull(),
    targetUrl: text("target_url").notNull(),
    filePath: text("file_path"),
    valueBefore: text("value_before"),
    valueAfter: text("value_after").notNull(),
    rationale: text("rationale").notNull(),
    validationSummary: text("validation_summary").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputDigest: text("input_digest").notNull(),
    costUsd: real("cost_usd").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("proposal_drafts_project_opportunity_created_idx").on(
      t.projectId,
      t.opportunityId,
      t.createdAt,
    ),
  ],
);

export const proposalDraftSources = sqliteTable(
  "proposal_draft_sources",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    draftId: text("draft_id")
      .notNull()
      .references(() => proposalDrafts.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DRAFT_SOURCE_KINDS }).notNull(),
    label: text("label").notNull(),
    excerpt: text("excerpt").notNull(),
  },
  (t) => [index("proposal_draft_sources_draft_idx").on(t.draftId)],
);

export const proposalDraftClaims = sqliteTable(
  "proposal_draft_claims",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    draftId: text("draft_id")
      .notNull()
      .references(() => proposalDrafts.id, { onDelete: "cascade" }),
    claimText: text("claim_text").notNull(),
    sourceId: text("source_id").references(() => proposalDraftSources.id, {
      onDelete: "cascade",
    }),
    verified: integer("verified", { mode: "boolean" }).notNull(),
  },
  (t) => [index("proposal_draft_claims_draft_idx").on(t.draftId)],
);
