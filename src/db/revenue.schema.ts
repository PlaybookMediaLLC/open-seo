import {
  index,
  integer,
  sqliteTable as table,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";

// RFC-0016: revenue attribution. A read-only Stripe key, encrypted with the
// RFC-0009 key, and one row per payment with its first touch. No names,
// emails, addresses or payment details are stored.
export const REVENUE_KINDS = [
  "first_payment",
  "renewal",
  "one_time",
  "refund",
] as const;
export const REVENUE_CHANNELS = [
  "organic_search",
  "paid",
  "email",
  "referral",
  "direct",
  "unknown",
] as const;

export const revenueConnections = table("revenue_connections", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["stripe"] }).notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keyVersion: integer("key_version").notNull(),
  /** Salts the hashes of Stripe ids, so they cannot be joined across projects. */
  hashSalt: text("hash_salt").notNull(),
  accountIdHash: text("account_id_hash"),
  livemode: integer("livemode", { mode: "boolean" }).notNull(),
  /** The creation time of the newest synced invoice, in Unix seconds. */
  syncCursor: integer("sync_cursor"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  lastSyncedAt: text("last_synced_at"),
});

export const revenueEvents = table(
  "revenue_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    externalIdHash: text("external_id_hash").notNull(),
    customerHash: text("customer_hash").notNull(),
    kind: text("kind", { enum: REVENUE_KINDS }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    occurredAt: text("occurred_at").notNull(),
    ftPath: text("ft_path"),
    ftSource: text("ft_source"),
    ftMedium: text("ft_medium"),
    ftCampaign: text("ft_campaign"),
    ftChannel: text("ft_channel", { enum: REVENUE_CHANNELS }).notNull(),
  },
  (t) => [
    uniqueIndex("revenue_events_external_idx").on(
      t.projectId,
      t.externalIdHash,
    ),
    index("revenue_events_project_time_idx").on(t.projectId, t.occurredAt),
  ],
);
