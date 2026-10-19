import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { auditPages, audits } from "./audit.schema";

// RFC-0013 5.2: axe-core results of one audit page, and its violations.
// Text fields are cut to 300 characters before they are stored.
export const auditAccessibilityResults = sqliteTable(
  "audit_accessibility_results",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    axeVersion: text("axe_version").notNull(),
    ranAt: text("ran_at").notNull(),
    violationCount: integer("violation_count").notNull(),
    error: text("error"),
  },
  (t) => [index("audit_accessibility_results_audit_idx").on(t.auditId)],
);

export const auditAccessibilityViolations = sqliteTable(
  "audit_accessibility_violations",
  {
    id: text("id").primaryKey(),
    resultId: text("result_id")
      .notNull()
      .references(() => auditAccessibilityResults.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    impact: text("impact", {
      enum: ["minor", "moderate", "serious", "critical"],
    }).notNull(),
    wcagTags: text("wcag_tags").notNull(),
    targetSelector: text("target_selector").notNull(),
    htmlSnippet: text("html_snippet").notNull(),
    failureSummary: text("failure_summary").notNull(),
    clusterKey: text("cluster_key").notNull(),
  },
  (t) => [
    index("audit_accessibility_violations_result_idx").on(t.resultId),
    index("audit_accessibility_violations_cluster_idx").on(t.clusterKey),
  ],
);

// RFC-0013 5.2: the 20 pages with the most organic clicks, saved when the
// audit starts. The audit worker holds no Google credentials, so the app
// worker reads Search Console and the accessibility step reads this list.
export const auditAccessibilityTargets = sqliteTable(
  "audit_accessibility_targets",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
  },
  (t) => [index("audit_accessibility_targets_audit_idx").on(t.auditId)],
);

// RFC-0013 5.4 phase 2: the headings of a page where heading-order fails,
// in page order, for the heading outline in a ticket. At most 40 headings.
export const auditAccessibilityHeadings = sqliteTable(
  "audit_accessibility_headings",
  {
    id: text("id").primaryKey(),
    resultId: text("result_id")
      .notNull()
      .references(() => auditAccessibilityResults.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    level: integer("level").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("audit_accessibility_headings_result_idx").on(t.resultId)],
);
