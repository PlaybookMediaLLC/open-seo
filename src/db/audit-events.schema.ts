import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { AUDIT_ACTIONS } from "@/shared/auditActions";

// RFC-0009 5.6: one cross-feature index of approved and consequential
// actions. The per-feature tables stay the detailed record.

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    projectId: text("project_id"),
    actorType: text("actor_type", {
      enum: ["user", "system", "mcp"],
    }).notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("audit_events_organization_created_idx").on(
      t.organizationId,
      t.createdAt,
    ),
    index("audit_events_project_created_idx").on(t.projectId, t.createdAt),
  ],
);
