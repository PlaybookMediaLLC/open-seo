import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { opportunities } from "./opportunities.schema";

// RFC-0004 phase 3: a content brief built from keyword evidence and project
// context. It exports as Markdown and is never published.
export const contentBriefs = pgTable(
  "content_briefs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["generated", "rejected_by_validation"],
    }).notNull(),
    title: text("title").notNull(),
    audience: text("audience").notNull(),
    searchIntent: text("search_intent").notNull(),
    outlineMarkdown: text("outline_markdown").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    costUsd: doublePrecision("cost_usd").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("content_briefs_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
      t.createdAt,
    ),
  ],
);

export const contentBriefKeywords = pgTable(
  "content_brief_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    briefId: text("brief_id")
      .notNull()
      .references(() => contentBriefs.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    // Null for a Search Console query, which has impressions, not volume.
    searchVolume: integer("search_volume"),
    role: text("role", { enum: ["primary", "secondary"] }).notNull(),
  },
  (t) => [index("content_brief_keywords_brief_idx").on(t.briefId)],
);
