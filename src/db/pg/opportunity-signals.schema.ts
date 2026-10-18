import {
  index,
  integer,
  doublePrecision,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { auditIssues, auditPages, audits } from "./audit.schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";

// RFC-0002 phase 2: audit and link signals. Each evidence kind has its own
// table; every table carries project_id for tenancy checks.

/** Pages that link to a project key page, saved when an audit finalizes. */
export const auditPageInlinks = pgTable(
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

export const opportunityAuditEvidence = pgTable(
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

export const opportunityInspectionEvidence = pgTable(
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

export const opportunityLinkEvidence = pgTable(
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
    sourceImpressions: doublePrecision("source_impressions").notNull(),
    sourcePosition: doublePrecision("source_position").notNull(),
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

export const opportunityRankEvidence = pgTable(
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
export const opportunityAccessibilityEvidence = pgTable(
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
