import { index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";

// RFC-0004 phase 3: deterministic checks on a declining page, and an optional
// model summary written from the stored findings only.
export const opportunityInvestigations = sqliteTable(
  "opportunity_investigations",
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
    status: text("status", { enum: ["completed"] }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    summary: text("summary"),
    summaryModel: text("summary_model"),
    summaryCostUsd: real("summary_cost_usd"),
    summarizedAt: text("summarized_at"),
  },
  (t) => [
    index("opportunity_investigations_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
      t.createdAt,
    ),
  ],
);

export const opportunityInvestigationFindings = sqliteTable(
  "opportunity_investigation_findings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    investigationId: text("investigation_id")
      .notNull()
      .references(() => opportunityInvestigations.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "query_loss",
        "index_state",
        "audit_issue",
        "rank_change",
        "check_unavailable",
      ],
    }).notNull(),
    severity: text("severity", {
      enum: ["high", "medium", "low", "info"],
    }).notNull(),
    summary: text("summary").notNull(),
    metricBefore: real("metric_before"),
    metricAfter: real("metric_after"),
  },
  (t) => [
    index("opportunity_investigation_findings_investigation_idx").on(
      t.investigationId,
    ),
  ],
);
