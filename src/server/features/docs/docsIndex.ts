import { eq, inArray } from "drizzle-orm";
import { chunk, sortBy } from "remeda";
import { db } from "@/db";
import { docsPageHeadings, docsPages, docsSettings } from "@/db/schema";
import { runBatch } from "@/db/runBatch";
import { connectedGithub } from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import { docOutline, docsUrlPath } from "./docsMarkdown";

// RFC-0017 5.2: at most 500 files and 10 MB. The GitHub reader reads files up
// to 32 KB; a bigger page keeps its path but no title or headings.
const MAX_FILES = 500;
const MAX_BYTES = 10 * 1024 * 1024;
const FILE_BYTES = 32 * 1024;
// ponytail: one run reads 200 changed files to stay inside the Worker's
// request limit; a first index of 500 files takes three days.
const READS_PER_RUN = 200;
// D1 allows about 100 bound parameters a statement; a heading row has 7.
const HEADING_ROWS = 14;

function outlineOf(source: string, path: string) {
  try {
    return docOutline(source, path.endsWith(".mdx"));
  } catch {
    return null;
  }
}

/** Reads changed docs files, stores their outlines and drops removed files. */
export async function indexDocs(projectId: string, now: Date) {
  const [settings] = await db
    .select()
    .from(docsSettings)
    .where(eq(docsSettings.projectId, projectId));
  if (!settings) return null;
  const connection = await PublishingRepository.getConnection(projectId);
  if (!connection)
    throw new AppError(
      "CONFLICT",
      "Connect the repository in Project settings → Integrations first.",
    );
  const client = await connectedGithub(
    connection,
    AbortSignal.timeout(120_000),
    { metadata: "read", contents: "read" },
    READS_PER_RUN + 60,
  );
  const ref = await client.getRef(connection.baseBranch);
  if (!ref)
    throw new AppError(
      "NOT_FOUND",
      `The branch ${connection.baseBranch} was not found.`,
    );
  const listed = await client.listFiles(settings.directory, ref.sha);
  const candidates = sortBy(
    listed.files.filter((file) => /\.mdx?$/i.test(file.path)),
    (file) => file.path,
  );
  const files: typeof candidates = [];
  let bytes = 0;
  for (const file of candidates) {
    if (files.length === MAX_FILES || bytes + file.size > MAX_BYTES) break;
    files.push(file);
    bytes += file.size;
  }

  const stored = new Map(
    (
      await db
        .select({
          id: docsPages.id,
          filePath: docsPages.filePath,
          blobSha: docsPages.blobSha,
        })
        .from(docsPages)
        .where(eq(docsPages.projectId, projectId))
    ).map((row) => [row.filePath, row]),
  );
  const changed = files.filter(
    (file) => stored.get(file.path)?.blobSha !== file.sha,
  );
  const toRead = changed.slice(0, READS_PER_RUN);
  let unreadable = 0;
  for (const file of toRead) {
    const source =
      file.size <= FILE_BYTES
        ? (await client.readFile(file.path, ref.sha)).source
        : null;
    const outline = source === null ? null : outlineOf(source, file.path);
    if (!outline) unreadable++;
    const id = stored.get(file.path)?.id ?? crypto.randomUUID();
    const page = {
      urlPath: docsUrlPath(file.path, settings.directory, settings.pathPrefix),
      title: outline?.title ?? null,
      wordCount: outline?.wordCount ?? 0,
      blobSha: file.sha,
      indexedAt: now.toISOString(),
    };
    const headings = (outline?.headings ?? []).map((heading, position) => ({
      id: crypto.randomUUID(),
      projectId,
      pageId: id,
      position,
      ...heading,
    }));
    await runBatch((tx) => [
      tx
        .insert(docsPages)
        .values({ id, projectId, filePath: file.path, ...page })
        .onConflictDoUpdate({
          target: [docsPages.projectId, docsPages.filePath],
          set: page,
        }),
      tx.delete(docsPageHeadings).where(eq(docsPageHeadings.pageId, id)),
      ...chunk(headings, HEADING_ROWS).map((rows) =>
        tx.insert(docsPageHeadings).values(rows),
      ),
    ]);
  }

  const kept = new Set(files.map((file) => file.path));
  const removed = [...stored.values()]
    .filter((row) => !kept.has(row.filePath))
    .map((row) => row.id);
  for (const ids of chunk(removed, 90))
    await runBatch((tx) => [
      tx.delete(docsPageHeadings).where(inArray(docsPageHeadings.pageId, ids)),
      tx.delete(docsPages).where(inArray(docsPages.id, ids)),
    ]);
  return {
    files: files.length,
    read: toRead.length,
    unreadable,
    remaining: changed.length - toRead.length,
    removed: removed.length,
    overCap: candidates.length - files.length,
    truncated: listed.truncated,
  };
}

export function indexSummary(
  result: NonNullable<Awaited<ReturnType<typeof indexDocs>>>,
) {
  return `Indexed ${result.files} docs files: read ${result.read} changed files and removed ${result.removed}.${result.unreadable ? ` ${result.unreadable} files were too large or not valid Markdown, so they have no headings.` : ""}${result.remaining ? ` ${result.remaining} changed files follow in the next run.` : ""}${result.overCap ? ` ${result.overCap} files are over the 500-file or 10 MB limit.` : ""}`;
}
