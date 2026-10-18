import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";
import { SPEND_STATUSES } from "../spend.schema";

// RFC-0009: monthly credit limits per organization and project, and one
// ledger row per credit hold so that every charge can be reconciled.

export const spendLimits = pgTable(
  "spend_limits",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Null is the organization's own limit.
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    monthlyLimitCredits: integer("monthly_limit_credits").notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("spend_limits_organization_idx")
      .on(t.organizationId)
      .where(sql`${t.projectId} IS NULL`),
    uniqueIndex("spend_limits_project_idx")
      .on(t.organizationId, t.projectId)
      .where(sql`${t.projectId} IS NOT NULL`),
  ],
);

export const spendLedger = pgTable(
  "spend_ledger",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    projectId: text("project_id"),
    // A credit feature, `proposal_draft` or `content_gap`; known at settlement
    // for DataForSEO calls that name no feature.
    feature: text("feature"),
    provider: text("provider", {
      enum: ["dataforseo", "openrouter"],
    }).notNull(),
    actor: text("actor").notNull(),
    periodMonth: text("period_month").notNull(),
    estimatedCredits: integer("estimated_credits").notNull(),
    actualCredits: integer("actual_credits"),
    costUsd: doublePrecision("cost_usd"),
    holdLockId: text("hold_lock_id"),
    status: text("status", { enum: SPEND_STATUSES }).notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    settledAt: text("settled_at"),
  },
  (t) => [
    index("spend_ledger_organization_period_idx").on(
      t.organizationId,
      t.periodMonth,
    ),
    index("spend_ledger_project_period_idx").on(t.projectId, t.periodMonth),
    index("spend_ledger_hold_idx").on(t.holdLockId),
    index("spend_ledger_status_idx").on(t.status, t.createdAt),
  ],
);
