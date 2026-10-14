import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { opportunities } from "./opportunities.schema";
import { opportunityProposals, proposalExecutions } from "./publishing.schema";

export const growthExperiments = sqliteTable(
  "growth_experiments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => opportunityProposals.id, { onDelete: "cascade" }),
    executionId: text("execution_id")
      .notNull()
      .references(() => proposalExecutions.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    targetUrl: text("target_url").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    pullRequestState: text("pull_request_state", {
      enum: ["unknown", "open", "closed", "merged"],
    }).notNull(),
    pullRequestCheckedAt: text("pull_request_checked_at"),
    mergedAt: text("merged_at"),
    mergeCommitSha: text("merge_commit_sha"),
    deployedAt: text("deployed_at"),
    deploymentConfirmedBy: text("deployment_confirmed_by"),
    deploymentNote: text("deployment_note"),
    deploymentConfirmedAt: text("deployment_confirmed_at"),
    otherChanges: integer("other_changes", { mode: "boolean" }).notNull(),
    seasonalRisk: integer("seasonal_risk", { mode: "boolean" }).notNull(),
    baselineStart: text("baseline_start"),
    baselineEnd: text("baseline_end"),
    observationStart: text("observation_start"),
    observationEnd: text("observation_end"),
    baselineRunId: text("baseline_run_id").references(
      (): AnySQLiteColumn => measurementRuns.id,
      { onDelete: "set null" },
    ),
    lastEventId: text("last_event_id"),
  },
  (t) => [
    uniqueIndex("growth_experiments_execution_idx").on(t.executionId),
    index("growth_experiments_project_created_idx").on(
      t.projectId,
      t.createdAt,
    ),
  ],
);

export const measurementRuns = sqliteTable(
  "measurement_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => growthExperiments.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["running", "completed", "failed"],
    }).notNull(),
    requestedBy: text("requested_by").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    requestCount: integer("request_count").notNull(),
    includesBaseline: integer("includes_baseline", {
      mode: "boolean",
    }).notNull(),
    observationThrough: text("observation_through"),
    outcome: text("outcome", {
      enum: ["encouraging", "inconclusive", "negative"],
    }).notNull(),
    explanation: text("explanation").notNull(),
    overlappingChanges: integer("overlapping_changes", {
      mode: "boolean",
    }).notNull(),
    windowComplete: integer("window_complete", { mode: "boolean" }).notNull(),
    error: text("error"),
    claimToken: text("claim_token").notNull(),
    completionToken: text("completion_token"),
  },
  (t) => [
    index("measurement_runs_project_started_idx").on(t.projectId, t.startedAt),
    index("measurement_runs_experiment_started_idx").on(
      t.projectId,
      t.experimentId,
      t.startedAt,
    ),
  ],
);

export const measurementDays = sqliteTable(
  "measurement_days",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => growthExperiments.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => measurementRuns.id, { onDelete: "cascade" }),
    period: text("period", { enum: ["baseline", "observation"] }).notNull(),
    date: text("date").notNull(),
    clicks: real("clicks").notNull(),
    impressions: real("impressions").notNull(),
    ctr: real("ctr").notNull(),
    position: real("position").notNull(),
  },
  (t) => [
    uniqueIndex("measurement_days_run_period_date_idx").on(
      t.runId,
      t.period,
      t.date,
    ),
    index("measurement_days_project_experiment_idx").on(
      t.projectId,
      t.experimentId,
    ),
  ],
);
