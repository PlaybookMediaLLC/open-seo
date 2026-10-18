import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { CI_URL_REASONS } from "../seo-checks.schema";

// RFC-0010: SEO checks on pull requests. A project-scoped CI token starts a
// run that compares a preview deployment with production.

export const ciTokens = pgTable(
  "ci_tokens",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    displayPrefix: text("display_prefix").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("ci_tokens_project_idx").on(t.projectId)],
);

export const ciCheckRuns = pgTable(
  "ci_check_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tokenId: text("token_id"),
    repository: text("repository").notNull(),
    pullRequest: integer("pull_request"),
    headSha: text("head_sha").notNull(),
    previewOrigin: text("preview_origin").notNull(),
    baseOrigin: text("base_origin").notNull(),
    // The changed files the action sent, one path per line.
    changedFiles: text("changed_files").notNull(),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed"],
    }).notNull(),
    blockingCount: integer("blocking_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    urlCount: integer("url_count").notNull().default(0),
    overrideUsed: boolean("override_used").notNull().default(false),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
  },
  (t) => [
    uniqueIndex("ci_check_runs_head_idx").on(
      t.projectId,
      t.headSha,
      t.previewOrigin,
    ),
    index("ci_check_runs_project_created_idx").on(t.projectId, t.createdAt),
  ],
);

export const ciCheckUrls = pgTable(
  "ci_check_urls",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => ciCheckRuns.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    path: text("path").notNull(),
    reason: text("reason", { enum: CI_URL_REASONS }).notNull(),
    baseStatus: integer("base_status"),
    previewStatus: integer("preview_status"),
    clicks28d: integer("clicks_28d"),
    impressions28d: integer("impressions_28d"),
  },
  (t) => [index("ci_check_urls_run_idx").on(t.runId)],
);

export const ciCheckFindings = pgTable(
  "ci_check_findings",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => ciCheckRuns.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    path: text("path").notNull(),
    rule: text("rule").notNull(),
    severity: text("severity", { enum: ["blocking", "warning"] }).notNull(),
    beforeValue: text("before_value"),
    afterValue: text("after_value"),
    message: text("message").notNull(),
  },
  (t) => [index("ci_check_findings_run_idx").on(t.runId)],
);

export const ciCheckIgnores = pgTable(
  "ci_check_ignores",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rule: text("rule").notNull(),
    pathPattern: text("path_pattern").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("ci_check_ignores_project_idx").on(t.projectId)],
);

export const ciPreviewAccess = pgTable("ci_preview_access", {
  id: text("id").primaryKey(),
  // One access method per project.
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["header", "cf_access"] }).notNull(),
  headerName: text("header_name"),
  // The header value, or the Access client id and secret, encrypted with the
  // RFC-0009 publishing token key.
  encryptedValue: text("encrypted_value").notNull(),
  keyVersion: integer("key_version").notNull().default(0),
});

export const ciPreviewHosts = pgTable(
  "ci_preview_hosts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    host: text("host").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("ci_preview_hosts_project_host_idx").on(t.projectId, t.host),
  ],
);

// The two per-project switches of 5.5 and 5.7.
export const ciProjectSettings = pgTable("ci_project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  raiseOnHighTraffic: boolean("raise_on_high_traffic").notNull().default(true),
  checkPreviewRobotsHeader: boolean("check_preview_robots_header")
    .notNull()
    .default(false),
  updatedAt: text("updated_at").notNull(),
});
