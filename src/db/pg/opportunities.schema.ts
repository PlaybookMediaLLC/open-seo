import {
  boolean,
  index,
  integer,
  doublePrecision,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
} from "@/types/schemas/opportunities";

export const opportunityRuns = pgTable(
  "opportunity_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    status: text("status", {
      enum: ["running", "completed", "failed"],
    }).notNull(),
    requestedBy: text("requested_by").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    previousStartDate: text("previous_start_date").notNull(),
    previousEndDate: text("previous_end_date").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    queryRows: integer("query_rows").notNull().default(0),
    currentPageRows: integer("current_page_rows").notNull().default(0),
    previousPageRows: integer("previous_page_rows").notNull().default(0),
    requestCount: integer("request_count").notNull().default(0),
    opportunityCount: integer("opportunity_count").notNull().default(0),
    truncated: boolean("truncated").notNull().default(false),
    error: text("error"),
    completionToken: text("completion_token"),
  },
  (t) => [
    index("opportunity_runs_project_started_idx").on(t.projectId, t.startedAt),
  ],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    identityKey: text("identity_key").notNull(),
    type: text("type", { enum: OPPORTUNITY_TYPES }).notNull(),
    url: text("url").notNull(),
    query: text("query"),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    searchIntent: text("search_intent").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    effortHours: doublePrecision("effort_hours").notNull(),
    priority: integer("priority").notNull(),
    commercialScore: doublePrecision("commercial_score").notNull(),
    demandScore: doublePrecision("demand_score").notNull(),
    visibilityScore: doublePrecision("visibility_score").notNull(),
    difficultyScore: doublePrecision("difficulty_score").notNull(),
    effortScore: doublePrecision("effort_score").notNull(),
    scoreExplanation: text("score_explanation").notNull(),
    uncertainty: text("uncertainty").notNull(),
    status: text("status", { enum: OPPORTUNITY_STATUSES })
      .notNull()
      .default("discovered"),
    ownerUserId: text("owner_user_id"),
    evidenceRunId: text("evidence_run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    firstDetectedAt: text("first_detected_at").notNull(),
    lastDetectedAt: text("last_detected_at").notNull(),
    deferredUntil: text("deferred_until"),
    version: integer("version").notNull().default(1),
    lastDecisionId: text("last_decision_id"),
  },
  (t) => [
    uniqueIndex("opportunities_project_identity_idx").on(
      t.projectId,
      t.identityKey,
    ),
    index("opportunities_project_status_priority_idx").on(
      t.projectId,
      t.status,
      t.priority,
    ),
  ],
);

export const opportunityEvidence = pgTable(
  "opportunity_evidence",
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
    source: text("source", { enum: ["google_search_console"] }).notNull(),
    period: text("period", { enum: ["current", "previous"] }).notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    clicks: doublePrecision("clicks").notNull(),
    impressions: doublePrecision("impressions").notNull(),
    ctr: doublePrecision("ctr").notNull(),
    position: doublePrecision("position").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_evidence_opportunity_run_period_idx").on(
      t.opportunityId,
      t.runId,
      t.period,
    ),
    index("opportunity_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityDecisions = pgTable(
  "opportunity_decisions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    evidenceRunId: text("evidence_run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    decision: text("decision", {
      enum: ["reviewed", "approved", "rejected", "deferred", "reverted"],
    }).notNull(),
    fromStatus: text("from_status", { enum: OPPORTUNITY_STATUSES }).notNull(),
    toStatus: text("to_status", { enum: OPPORTUNITY_STATUSES }).notNull(),
    note: text("note").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("opportunity_decisions_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);
