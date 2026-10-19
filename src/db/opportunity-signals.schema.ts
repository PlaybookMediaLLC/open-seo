import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { auditIssues, auditPages, audits } from "./audit.schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";

// RFC-0002 phase 2: audit and link signals. Each evidence kind has its own
// table; every table carries project_id for tenancy checks.

/** Pages that link to a project key page, saved when an audit finalizes. */
export const auditPageInlinks = sqliteTable(
  "audit_page_inlinks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    targetPageId: text("target_page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    sourcePageId: text("source_page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("audit_page_inlinks_audit_target_source_idx").on(
      t.auditId,
      t.targetPageId,
      t.sourcePageId,
    ),
    index("audit_page_inlinks_project_audit_idx").on(t.projectId, t.auditId),
  ],
);

export const opportunityAuditEvidence = sqliteTable(
  "opportunity_audit_evidence",
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
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    auditIssueId: text("audit_issue_id").references(() => auditIssues.id, {
      onDelete: "set null",
    }),
    issueType: text("issue_type").notNull(),
    severity: text("severity", {
      enum: ["critical", "warning", "info"],
    }).notNull(),
    pageUrl: text("page_url").notNull(),
    auditCompletedAt: text("audit_completed_at").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_audit_evidence_opportunity_run_idx").on(
      t.opportunityId,
      t.runId,
    ),
    index("opportunity_audit_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityInspectionEvidence = sqliteTable(
  "opportunity_inspection_evidence",
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
    url: text("url").notNull(),
    verdict: text("verdict"),
    coverageState: text("coverage_state"),
    indexingState: text("indexing_state"),
    robotsTxtState: text("robots_txt_state"),
    pageFetchState: text("page_fetch_state"),
    googleCanonical: text("google_canonical"),
    userCanonical: text("user_canonical"),
    lastCrawlTime: text("last_crawl_time"),
    inspectedAt: text("inspected_at").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_inspection_evidence_opportunity_run_idx").on(
      t.opportunityId,
      t.runId,
    ),
    index("opportunity_inspection_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityLinkEvidence = sqliteTable(
  "opportunity_link_evidence",
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
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    targetUrl: text("target_url").notNull(),
    sharedQuery: text("shared_query").notNull(),
    sourceImpressions: real("source_impressions").notNull(),
    sourcePosition: real("source_position").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_link_evidence_opportunity_run_idx").on(
      t.opportunityId,
      t.runId,
    ),
    index("opportunity_link_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityRankEvidence = sqliteTable(
  "opportunity_rank_evidence",
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
    // No FK: rank snapshots outlive a removed tracked keyword.
    trackingKeywordId: text("tracking_keyword_id").notNull(),
    device: text("device", { enum: ["desktop", "mobile"] }).notNull(),
    firstPosition: integer("first_position"),
    lastPosition: integer("last_position"),
    firstCheckedAt: text("first_checked_at").notNull(),
    lastCheckedAt: text("last_checked_at").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_rank_evidence_opportunity_run_device_idx").on(
      t.opportunityId,
      t.runId,
      t.device,
    ),
    index("opportunity_rank_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

// RFC-0013 5.3: one accessibility cluster of the latest audit.
export const opportunityAccessibilityEvidence = sqliteTable(
  "opportunity_accessibility_evidence",
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
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    clusterKey: text("cluster_key").notNull(),
    ruleId: text("rule_id").notNull(),
    impact: text("impact", {
      enum: ["minor", "moderate", "serious", "critical"],
    }).notNull(),
    wcagTags: text("wcag_tags").notNull(),
    pagesAffected: integer("pages_affected").notNull(),
    exampleUrl: text("example_url").notNull(),
    exampleSelector: text("example_selector").notNull(),
    exampleSnippet: text("example_snippet").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_accessibility_evidence_opportunity_run_idx").on(
      t.opportunityId,
      t.runId,
    ),
  ],
);

// RFC-0014 5.2: real-user Core Web Vitals from the Chrome UX Report, the
// 75th percentile over the 28 days that end on `collection_end`.
export const cwvSnapshots = sqliteTable(
  "cwv_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scope: text("scope", { enum: ["url", "origin"] }).notNull(),
    target: text("target").notNull(),
    formFactor: text("form_factor", { enum: ["phone", "desktop"] }).notNull(),
    collectionEnd: text("collection_end").notNull(),
    lcpP75Ms: real("lcp_p75_ms"),
    inpP75Ms: real("inp_p75_ms"),
    clsP75: real("cls_p75"),
    source: text("source", { enum: ["crux", "crux_history"] }).notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [
    uniqueIndex("cwv_snapshots_target_idx").on(
      t.projectId,
      t.scope,
      t.target,
      t.formFactor,
      t.collectionEnd,
      t.source,
    ),
  ],
);

// RFC-0014 5.3: the field data behind one performance issue.
export const opportunityPerformanceEvidence = sqliteTable(
  "opportunity_performance_evidence",
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
    template: text("template").notNull(),
    metric: text("metric", { enum: ["lcp", "inp", "cls"] }).notNull(),
    formFactor: text("form_factor", { enum: ["phone", "desktop"] }).notNull(),
    p75Value: real("p75_value").notNull(),
    threshold: real("threshold").notNull(),
    scope: text("scope", { enum: ["url", "origin"] }).notNull(),
    target: text("target").notNull(),
    collectionEnd: text("collection_end").notNull(),
    labValue: real("lab_value"),
    causeIds: text("cause_ids").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_performance_evidence_opportunity_run_idx").on(
      t.opportunityId,
      t.runId,
    ),
  ],
);
