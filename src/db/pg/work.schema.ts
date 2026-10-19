import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  doublePrecision,
  pgTable as table,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { growthExperiments } from "./experiments.schema";
import { opportunities } from "./opportunities.schema";
import { opportunityProposals } from "./publishing.schema";
import { splitTests } from "./split-tests.schema";

// RFC-0018: the weekly cycle. Completed, Measuring, Next and Waiting on you,
// as a weekly snapshot of real records.
export const WORK_SECTIONS = [
  "completed",
  "measuring",
  "next",
  "waiting",
] as const;
export const WORK_APPROVALS = [
  "none",
  "review",
  "approve_change",
  "merge",
] as const;

export const workSettings = table("work_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** The lowest priority that Next shows, 20 to 80. */
  qualityBar: integer("quality_bar").notNull(),
  /** Relay pull requests open at the same time, 1 to 10. */
  openPrLimit: integer("open_pr_limit").notNull(),
  /** 1 is Monday and 7 is Sunday, in `timeZone`. */
  cycleDay: integer("cycle_day").notNull(),
  cycleHour: integer("cycle_hour").notNull(),
  timeZone: text("time_zone").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const workCycles = table(
  "work_cycles",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** The first day of the week, a date in the project's time zone. */
    weekStart: text("week_start").notNull(),
    status: text("status", { enum: ["open", "closed"] }).notNull(),
    generatedAt: text("generated_at").notNull(),
    closedAt: text("closed_at"),
    completedCount: integer("completed_count").notNull(),
    measuringCount: integer("measuring_count").notNull(),
    nextCount: integer("next_count").notNull(),
    waitingCount: integer("waiting_count").notNull(),
    emptyReasons: text("empty_reasons"),
  },
  (t) => [uniqueIndex("work_cycles_week_idx").on(t.projectId, t.weekStart)],
);

export const workCycleEntries = table(
  "work_cycle_entries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => workCycles.id, { onDelete: "cascade" }),
    section: text("section", { enum: WORK_SECTIONS }).notNull(),
    rank: integer("rank").notNull(),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    proposalId: text("proposal_id").references(() => opportunityProposals.id, {
      onDelete: "set null",
    }),
    experimentId: text("experiment_id").references(() => growthExperiments.id, {
      onDelete: "set null",
    }),
    splitTestId: text("split_test_id").references(() => splitTests.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    effortHours: doublePrecision("effort_hours"),
    approvalNeeded: text("approval_needed", { enum: WORK_APPROVALS }).notNull(),
  },
  (t) => [
    index("work_cycle_entries_cycle_idx").on(t.cycleId, t.section, t.rank),
    // Code writes exactly one link. A linked record's deletion clears it,
    // and the entry keeps its title as a snapshot.
    check(
      "work_cycle_entries_one_link",
      sql`(case when ${t.opportunityId} is null then 0 else 1 end + case when ${t.proposalId} is null then 0 else 1 end + case when ${t.experimentId} is null then 0 else 1 end + case when ${t.splitTestId} is null then 0 else 1 end) <= 1`,
    ),
  ],
);
