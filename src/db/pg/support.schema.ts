import {
  index,
  integer,
  pgTable as table,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { docsPages } from "./docs.schema";

// RFC-0017 5.4: support topics from GitHub Issues. Only counts, labels and
// up to 3 redacted excerpts of 200 characters per topic are stored. Ticket
// text is processed in memory and never stored.
export const supportSources = table(
  "support_sources",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["github_issues"] }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    lastProcessedAt: text("last_processed_at"),
  },
  (t) => [
    uniqueIndex("support_sources_project_idx").on(t.projectId, t.provider),
  ],
);

export const supportTopics = table(
  "support_topics",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    ticketCount28d: integer("ticket_count_28d").notNull(),
    ticketCountPrev28d: integer("ticket_count_prev_28d").notNull(),
    docsPageId: text("docs_page_id").references(() => docsPages.id, {
      onDelete: "set null",
    }),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("support_topics_project_idx").on(t.projectId)],
);

export const supportTopicExcerpts = table(
  "support_topic_excerpts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => supportTopics.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("support_topic_excerpts_topic_idx").on(t.topicId)],
);
