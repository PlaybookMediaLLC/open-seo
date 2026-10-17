import {
  index,
  doublePrecision,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { growthExperiments, measurementRuns } from "./experiments.schema";

// RFC-0006: GA4 supporting metrics for an experiment. Missing dates stay
// missing; a date GA4 did not return is never stored as zero.
export const experimentKeyEvents = pgTable(
  "experiment_key_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => growthExperiments.id, { onDelete: "cascade" }),
    eventName: text("event_name").notNull(),
  },
  (t) => [
    uniqueIndex("experiment_key_events_experiment_event_idx").on(
      t.experimentId,
      t.eventName,
    ),
  ],
);

export const measurementGa4Days = pgTable(
  "measurement_ga4_days",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => measurementRuns.id, { onDelete: "cascade" }),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => growthExperiments.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    period: text("period", { enum: ["baseline", "observation"] }).notNull(),
    sessions: doublePrecision("sessions").notNull(),
    engagedSessions: doublePrecision("engaged_sessions").notNull(),
    keyEvents: doublePrecision("key_events").notNull(),
    revenue: doublePrecision("revenue"),
    currency: text("currency"),
  },
  (t) => [
    uniqueIndex("measurement_ga4_days_run_date_idx").on(t.runId, t.date),
    index("measurement_ga4_days_experiment_idx").on(
      t.projectId,
      t.experimentId,
    ),
  ],
);

export const measurementGa4EventTotals = pgTable(
  "measurement_ga4_event_totals",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => measurementRuns.id, { onDelete: "cascade" }),
    period: text("period", { enum: ["baseline", "observation"] }).notNull(),
    eventName: text("event_name").notNull(),
    keyEvents: doublePrecision("key_events").notNull(),
  },
  (t) => [
    uniqueIndex("measurement_ga4_event_totals_run_period_event_idx").on(
      t.runId,
      t.period,
      t.eventName,
    ),
  ],
);
