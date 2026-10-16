import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";

// RFC-0002 phase 3: paid competitor data, AI citations and live SERP checks.

/** One paid ranked-keywords fetch for a competitor, reused for 30 days. */
export const competitorKeywordSnapshots = sqliteTable(
  "competitor_keyword_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    rowCount: integer("row_count").notNull(),
    // The credits reserved before the call. The settled charge is the
    // provider's real cost, which is never higher.
    estimatedCredits: integer("estimated_credits").notNull(),
  },
  (t) => [
    uniqueIndex("competitor_keyword_snapshots_project_domain_market_idx").on(
      t.projectId,
      t.domain,
      t.locationCode,
      t.languageCode,
      t.fetchedAt,
    ),
  ],
);

export const competitorKeywordRows = sqliteTable(
  "competitor_keyword_rows",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => competitorKeywordSnapshots.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    position: integer("position").notNull(),
    url: text("url"),
    searchVolume: integer("search_volume").notNull(),
    keywordDifficulty: integer("keyword_difficulty"),
    intent: text("intent"),
  },
  (t) => [index("competitor_keyword_rows_snapshot_idx").on(t.snapshotId)],
);

export const opportunityKeywordEvidence = sqliteTable(
  "opportunity_keyword_evidence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    searchVolume: integer("search_volume").notNull(),
    keywordDifficulty: integer("keyword_difficulty"),
    intent: text("intent"),
    competitorDomain: text("competitor_domain").notNull(),
    competitorUrl: text("competitor_url"),
    competitorPosition: integer("competitor_position").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_keyword_evidence_run_keyword_competitor_idx").on(
      t.opportunityId,
      t.runId,
      t.keyword,
      t.competitorDomain,
    ),
    index("opportunity_keyword_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityAiEvidence = sqliteTable(
  "opportunity_ai_evidence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    trackerId: text("tracker_id").notNull(),
    citations: integer("citations").notNull(),
    answers: integer("answers").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_ai_evidence_opportunity_run_tracker_idx").on(
      t.opportunityId,
      t.runId,
      t.trackerId,
    ),
    index("opportunity_ai_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

/** A paid live results check for a low click-through page, valid 24 hours. */
export const opportunitySerpChecks = sqliteTable(
  "opportunity_serp_checks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    pagePosition: integer("page_position"),
    hasAds: integer("has_ads", { mode: "boolean" }).notNull(),
    hasAiOverview: integer("has_ai_overview", { mode: "boolean" }).notNull(),
    hasFeaturedSnippet: integer("has_featured_snippet", {
      mode: "boolean",
    }).notNull(),
    confidenceDelta: real("confidence_delta").notNull(),
    estimatedCredits: integer("estimated_credits").notNull(),
    checkedAt: text("checked_at").notNull(),
  },
  (t) => [
    index("opportunity_serp_checks_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
      t.checkedAt,
    ),
  ],
);
