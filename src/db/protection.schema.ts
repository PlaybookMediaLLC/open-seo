import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  MONITORED_PAGE_REASONS,
  ORIGIN_VERIFICATION_METHODS,
  PROTECTION_STATUSES,
} from "@/shared/protection";
import { projects } from "./app.schema";

// RFC-0026 phase A (IRFC-0001): a project's protected site. `degraded` is
// never stored; it is derived from coverage once checks run.
export const protectionEnrollments = sqliteTable("protection_enrollments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** `https://host`, where host is the project's domain or its www host. */
  productionOrigin: text("production_origin").notNull(),
  status: text("status", { enum: PROTECTION_STATUSES })
    .notNull()
    .default("setup"),
  /** Bumped by every change to the origin or the page set. */
  scopeVersion: integer("scope_version").notNull().default(1),
  checkHourUtc: integer("check_hour_utc").notNull(),
  originVerifiedAt: text("origin_verified_at"),
  originVerifiedBy: text("origin_verified_by", {
    enum: ORIGIN_VERIFICATION_METHODS,
  }),
  reviewerUserId: text("reviewer_user_id"),
  // Cleared when the reviewer changes.
  alertTestedAt: text("alert_tested_at"),
  alertConfirmedAt: text("alert_confirmed_at"),
  // Merging always stays with the customer.
  allowRepairProposals: integer("allow_repair_proposals", { mode: "boolean" })
    .notNull()
    .default(false),
  allowPullRequests: integer("allow_pull_requests", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Response expectations and support contact. */
  notes: text("notes"),
  activatedAt: text("activated_at"),
  pausedAt: text("paused_at"),
  endedAt: text("ended_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// The agreed page set. An excluded page is listed but never checked; a
// removed one stays as history.
export const monitoredPages = sqliteTable(
  "monitored_pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => protectionEnrollments.id, { onDelete: "cascade" }),
    /** Pathname only: no query or fragment, no trailing slash except `/`. */
    path: text("path").notNull(),
    selectionReason: text("selection_reason", {
      enum: MONITORED_PAGE_REASONS,
    }).notNull(),
    excludedReason: text("excluded_reason"),
    /** The enrollment's scope version when the row was added. */
    scopeVersion: integer("scope_version").notNull(),
    addedBy: text("added_by").notNull(),
    addedAt: text("added_at").notNull(),
    removedBy: text("removed_by"),
    removedAt: text("removed_at"),
  },
  (t) => [
    uniqueIndex("monitored_pages_active_path_idx")
      .on(t.enrollmentId, t.path)
      .where(sql`${t.removedAt} IS NULL`),
  ],
);

// The write fence and scope history: every scope change inserts the next
// version first, so two changes from the same version collide here and the
// loser's whole batch rolls back.
export const protectionScopeChanges = sqliteTable(
  "protection_scope_changes",
  {
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => protectionEnrollments.id, { onDelete: "cascade" }),
    scopeVersion: integer("scope_version").notNull(),
    changedBy: text("changed_by").notNull(),
    changedAt: text("changed_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.enrollmentId, t.scopeVersion] })],
);
