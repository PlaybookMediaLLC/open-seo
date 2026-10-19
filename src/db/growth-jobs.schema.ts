import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";

// RFC-0008: scheduled growth jobs, their runs and logs, and in-app
// notifications. Trigger.dev only schedules and retries; the Worker does
// all data work and keeps the customer-visible history here.
export const GROWTH_JOB_KINDS = [
  "opportunity_refresh",
  "measurement_refresh",
  "deployment_check",
  "traffic_watch",
  "recommendation_recheck",
  // RFC-0014 5.2: weekly Chrome UX Report field data.
  "cwv_refresh",
  // RFC-0016 5.4: daily Stripe revenue sync.
  "revenue_sync",
  // RFC-0017 5.2: daily docs index.
  "docs_index",
  // RFC-0017 5.4: daily support topics from GitHub Issues.
  "support_topics",
] as const;

export const growthSchedules = sqliteTable(
  "growth_schedules",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: GROWTH_JOB_KINDS }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    interval: text("interval", { enum: ["daily", "weekly"] }).notNull(),
    hourUtc: integer("hour_utc").notNull(),
    nextRunAt: text("next_run_at").notNull(),
    // The member whose current permissions the job uses.
    ownerUserId: text("owner_user_id").notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("growth_schedules_project_kind_idx").on(t.projectId, t.kind),
    index("growth_schedules_due_idx").on(t.enabled, t.nextRunAt),
  ],
);

export const growthJobRuns = sqliteTable(
  "growth_job_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scheduleId: text("schedule_id").references(() => growthSchedules.id, {
      onDelete: "set null",
    }),
    kind: text("kind", {
      enum: [...GROWTH_JOB_KINDS, "audit_followup"],
    }).notNull(),
    windowKey: text("window_key").notNull(),
    attempt: integer("attempt").notNull(),
    triggerRunId: text("trigger_run_id"),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "skipped"],
    }).notNull(),
    skipReason: text("skip_reason"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
    summary: text("summary"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("growth_job_runs_window_attempt_idx").on(
      t.projectId,
      t.kind,
      t.windowKey,
      t.attempt,
    ),
    uniqueIndex("growth_job_runs_trigger_run_idx").on(t.triggerRunId),
    index("growth_job_runs_project_created_idx").on(t.projectId, t.createdAt),
  ],
);

export const growthJobLogs = sqliteTable(
  "growth_job_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => growthJobRuns.id, { onDelete: "cascade" }),
    at: text("at").notNull(),
    level: text("level", { enum: ["info", "warn", "error"] }).notNull(),
    message: text("message").notNull(),
  },
  (t) => [index("growth_job_logs_run_idx").on(t.runId)],
);

export const growthNotifications = sqliteTable(
  "growth_notifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "new_opportunities",
        "traffic_drop",
        "result_ready",
        "deployment_detected",
        "stale_recommendations",
        "new_technical_issues",
        "job_failed",
        "spend_warning",
      ],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    linkPath: text("link_path").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("growth_notifications_dedupe_idx").on(
      t.projectId,
      t.kind,
      t.dedupeKey,
    ),
    index("growth_notifications_org_created_idx").on(
      t.organizationId,
      t.createdAt,
    ),
  ],
);

export const growthNotificationReads = sqliteTable(
  "growth_notification_reads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    notificationId: text("notification_id")
      .notNull()
      .references(() => growthNotifications.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    readAt: text("read_at").notNull(),
  },
  (t) => [
    uniqueIndex("growth_notification_reads_user_idx").on(
      t.notificationId,
      t.userId,
    ),
  ],
);

// RFC-0008 5.11: each member's opt-in email digest of unread notifications,
// per organization. Off unless the member turns it on.
export const growthEmailPreferences = sqliteTable(
  "growth_email_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    digest: text("digest", { enum: ["off", "daily", "weekly"] }).notNull(),
    lastSentAt: text("last_sent_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("growth_email_preferences_user_org_idx").on(
      t.userId,
      t.organizationId,
    ),
  ],
);
