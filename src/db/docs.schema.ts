import {
  index,
  integer,
  sqliteTable as table,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";

// RFC-0017: the docs index. Titles and headings only; Relay stores no full
// text, because the repository is the source of truth.
export const docsSettings = table("docs_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  /** The URL path of the docs, such as "/docs/". */
  pathPrefix: text("path_prefix").notNull(),
  /** The docs directory in the repository, such as "content/docs". */
  directory: text("directory").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const docsPages = table(
  "docs_pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    urlPath: text("url_path").notNull(),
    title: text("title"),
    wordCount: integer("word_count").notNull(),
    blobSha: text("blob_sha").notNull(),
    indexedAt: text("indexed_at").notNull(),
  },
  (t) => [uniqueIndex("docs_pages_file_idx").on(t.projectId, t.filePath)],
);

export const docsPageHeadings = table(
  "docs_page_headings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => docsPages.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    level: integer("level").notNull(),
    text: text("text").notNull(),
    anchor: text("anchor").notNull(),
  },
  (t) => [index("docs_page_headings_page_idx").on(t.pageId)],
);
