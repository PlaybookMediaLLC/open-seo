import { count, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { docsPageHeadings, docsPages, docsSettings } from "@/db/schema";
import { runBatch } from "@/db/runBatch";
import { hasOrgPermission } from "@/lib/org-permissions";
import { ensureDefaultSchedules } from "@/server/features/growth/AutomationService";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { validateGithubPath } from "@/server/features/publishing/githubRead";
import { AppError } from "@/server/lib/errors";
import { indexDocs, indexSummary } from "./docsIndex";

// RFC-0017 5.2: the docs paths, the index size and a manual index run.
async function get(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const [[settings], [index]] = await Promise.all([
    db
      .select({
        pathPrefix: docsSettings.pathPrefix,
        directory: docsSettings.directory,
      })
      .from(docsSettings)
      .where(eq(docsSettings.projectId, projectId)),
    db
      .select({ count: count(), lastIndexedAt: max(docsPages.indexedAt) })
      .from(docsPages)
      .where(eq(docsPages.projectId, projectId)),
  ]);
  return {
    settings: settings ?? null,
    pages: index?.count ?? 0,
    lastIndexedAt: index?.lastIndexedAt ?? null,
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
  };
}

async function save(
  context: PublishingContext,
  input: { projectId: string; pathPrefix: string; directory: string },
) {
  await authorizePublishing(context, input.projectId, true);
  validateGithubPath(input.directory);
  const [current] = await db
    .select()
    .from(docsSettings)
    .where(eq(docsSettings.projectId, input.projectId));
  const values = {
    pathPrefix: input.pathPrefix,
    directory: input.directory,
    updatedBy: context.userId,
    updatedAt: new Date().toISOString(),
  };
  const moved =
    current &&
    (current.pathPrefix !== input.pathPrefix ||
      current.directory !== input.directory);
  await runBatch((tx) => [
    tx
      .insert(docsSettings)
      .values({ projectId: input.projectId, ...values })
      .onConflictDoUpdate({ target: docsSettings.projectId, set: values }),
    // New paths make every stored URL wrong, so the index starts again.
    ...(moved
      ? [
          tx
            .delete(docsPageHeadings)
            .where(eq(docsPageHeadings.projectId, input.projectId)),
          tx.delete(docsPages).where(eq(docsPages.projectId, input.projectId)),
        ]
      : []),
  ]);
  await ensureDefaultSchedules(input.projectId, context.userId, ["docs_index"]);
}

/** The indexed pages and their headings, to choose where an edit goes. */
async function pages(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const [rows, headings] = await Promise.all([
    db
      .select({
        id: docsPages.id,
        filePath: docsPages.filePath,
        urlPath: docsPages.urlPath,
        title: docsPages.title,
      })
      .from(docsPages)
      .where(eq(docsPages.projectId, projectId))
      .orderBy(docsPages.filePath),
    db
      .select({
        pageId: docsPageHeadings.pageId,
        level: docsPageHeadings.level,
        text: docsPageHeadings.text,
      })
      .from(docsPageHeadings)
      .where(eq(docsPageHeadings.projectId, projectId))
      .orderBy(docsPageHeadings.position),
  ]);
  return rows.map(({ id, ...page }) => ({
    ...page,
    headings: headings
      .filter((heading) => heading.pageId === id)
      .map(({ level, text }) => ({ level, text })),
  }));
}

async function indexNow(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId, true);
  const result = await indexDocs(projectId, new Date());
  if (!result)
    throw new AppError(
      "VALIDATION_ERROR",
      "Set the docs path and directory first.",
    );
  return { summary: indexSummary(result) };
}

export const DocsSettingsService = { get, save, pages, indexNow };
