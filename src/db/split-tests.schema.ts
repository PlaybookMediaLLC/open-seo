import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { opportunities } from "./opportunities.schema";
import { opportunityProposals } from "./publishing.schema";

// RFC-0011: page-group split tests. A random half of one template's pages
// gets a change; the paired randomization test estimates its effect.
export const SPLIT_TEST_STATUSES = [
  "draft",
  "ineligible",
  "eligible",
  "awaiting_deploy",
  "verifying",
  "running",
  "stopped",
  "concluded",
] as const;
export const SPLIT_TEST_FIELDS = ["title", "description", "other"] as const;
export const SPLIT_TEST_LABELS = [
  "positive",
  "negative",
  "inconclusive",
] as const;

export const splitTests = sqliteTable(
  "split_tests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    hypothesis: text("hypothesis").notNull(),
    field: text("field", { enum: SPLIT_TEST_FIELDS }).notNull(),
    pagePattern: text("page_pattern").notNull(),
    // The scheme and host of the pages, from Search Console.
    origin: text("origin").notNull(),
    status: text("status", { enum: SPLIT_TEST_STATUSES }).notNull(),
    seed: integer("seed"),
    pairs: integer("pairs"),
    mdePct: real("mde_pct"),
    baselineStart: text("baseline_start"),
    baselineEnd: text("baseline_end"),
    deployedAt: text("deployed_at"),
    deploymentBasis: text("deployment_basis"),
    observationStart: text("observation_start"),
    observationEnd: text("observation_end"),
    // RFC-0011 5.4: the template the pages share, and the pull request
    // that adds the split files. The last check of its head is kept.
    templatePath: text("template_path"),
    // Set when the template is a metadata helper that separate pages share.
    templateHelper: text("template_helper"),
    branch: text("branch"),
    pullRequestNumber: integer("pull_request_number"),
    pullRequestUrl: text("pull_request_url"),
    checkedSha: text("checked_sha"),
    checkPassed: integer("check_passed", { mode: "boolean" }),
    checkProblems: text("check_problems"),
    // RFC-0011 5.6: a drift above 5% on day 7 or day 21.
    contaminated: integer("contaminated", { mode: "boolean" })
      .notNull()
      .default(false),
    // RFC-0011 5.7: the pull request that applies or removes the change.
    endAction: text("end_action", { enum: ["apply", "remove"] }),
    endPullRequestUrl: text("end_pull_request_url"),
    proposalId: text("proposal_id").references(() => opportunityProposals.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("split_tests_project_idx").on(t.projectId, t.createdAt)],
);

export const splitTestPages = sqliteTable(
  "split_test_pages",
  {
    id: text("id").primaryKey(),
    testId: text("test_id")
      .notNull()
      .references(() => splitTests.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    path: text("path").notNull(),
    pairIndex: integer("pair_index").notNull(),
    bucket: text("bucket", { enum: ["variant", "control"] }).notNull(),
    baselineClicks: integer("baseline_clicks").notNull(),
    baselineImpressions: integer("baseline_impressions").notNull(),
    originalTitle: text("original_title"),
    originalDescription: text("original_description"),
  },
  (t) => [uniqueIndex("split_test_pages_test_path_idx").on(t.testId, t.path)],
);

export const splitTestDays = sqliteTable(
  "split_test_days",
  {
    id: text("id").primaryKey(),
    testId: text("test_id")
      .notNull()
      .references(() => splitTests.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    path: text("path").notNull(),
    date: text("date").notNull(),
    clicks: integer("clicks").notNull(),
    impressions: integer("impressions").notNull(),
    position: real("position"),
  },
  (t) => [
    uniqueIndex("split_test_days_test_path_date_idx").on(
      t.testId,
      t.path,
      t.date,
    ),
  ],
);

export const splitTestVerifications = sqliteTable(
  "split_test_verifications",
  {
    id: text("id").primaryKey(),
    testId: text("test_id")
      .notNull()
      .references(() => splitTests.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    path: text("path").notNull(),
    checkedAt: text("checked_at").notNull(),
    expected: text("expected", { enum: ["changed", "unchanged"] }).notNull(),
    observedValue: text("observed_value"),
    passed: integer("passed", { mode: "boolean" }).notNull(),
  },
  (t) => [index("split_test_verifications_test_idx").on(t.testId, t.checkedAt)],
);

export const splitTestAnalyses = sqliteTable(
  "split_test_analyses",
  {
    id: text("id").primaryKey(),
    testId: text("test_id")
      .notNull()
      .references(() => splitTests.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    runAt: text("run_at").notNull(),
    observationDays: integer("observation_days").notNull(),
    estimatePct: real("estimate_pct"),
    ciLowPct: real("ci_low_pct"),
    ciHighPct: real("ci_high_pct"),
    pValue: real("p_value"),
    prePeriodPValue: real("pre_period_p_value"),
    label: text("label", { enum: SPLIT_TEST_LABELS }).notNull(),
    // Phase 3: GA4 secondary metrics, never part of the label.
    sessionsEstimatePct: real("sessions_estimate_pct"),
    sessionsCiLowPct: real("sessions_ci_low_pct"),
    sessionsCiHighPct: real("sessions_ci_high_pct"),
    keyEventsEstimatePct: real("key_events_estimate_pct"),
    keyEventsCiLowPct: real("key_events_ci_low_pct"),
    keyEventsCiHighPct: real("key_events_ci_high_pct"),
    notes: text("notes"),
  },
  (t) => [index("split_test_analyses_test_idx").on(t.testId, t.runAt)],
);
