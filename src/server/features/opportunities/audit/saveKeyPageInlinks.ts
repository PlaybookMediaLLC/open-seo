import type { WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { auditPageInlinks, auditPages } from "@/db/schema";
import { getAuditScratchpad } from "@/server/features/audit/AuditScratchpad";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { DB_STEP } from "@/server/workflows/auditStepConfigs";
import { pgStep } from "@/server/workflows/pgStep";
import { urlJoinKey } from "../services/detectors/shared";

const TARGET_LIMIT = 100;
// Five bound values per row, under D1's 100 per statement.
const ROWS_PER_STATEMENT = 19;
const STATEMENTS_PER_BATCH = 100;

/**
 * RFC-0002 internal links: before finalize destroys the scratchpad, save the
 * pages that link to each money or hub key page. Inlinks only help detection,
 * so a failure is logged and never fails the audit.
 */
export async function saveKeyPageInlinks(input: {
  auditId: string;
  projectId: string;
}): Promise<{ saved: number }> {
  try {
    const keys = new Set(
      (await ProjectContextRepository.listKeyPages(input.projectId))
        .filter((page) => page.role === "money" || page.role === "hub")
        .map((page) => urlJoinKey(page.url)),
    );
    const pages = await db
      .select({ id: auditPages.id, url: auditPages.url })
      .from(auditPages)
      .where(eq(auditPages.auditId, input.auditId));
    const pageIds = new Map(pages.map((page) => [page.url, page.id]));
    const targets = pages
      .filter((page) => keys.has(urlJoinKey(page.url)))
      .slice(0, TARGET_LIMIT)
      .map((page) => page.url);
    if (!targets.length) return { saved: 0 };
    const inlinks = await getAuditScratchpad(input.auditId).listInlinks(
      targets,
    );
    // Both ends must be saved audit pages, or a foreign key fails.
    const rows = inlinks.flatMap((row) => {
      const targetPageId = pageIds.get(row.target_url);
      const sourcePageId = pageIds.get(row.source_url);
      return targetPageId && sourcePageId
        ? [
            {
              id: crypto.randomUUID(),
              projectId: input.projectId,
              auditId: input.auditId,
              targetPageId,
              sourcePageId,
            },
          ]
        : [];
    });
    const chunks: (typeof rows)[] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT)
      chunks.push(rows.slice(i, i + ROWS_PER_STATEMENT));
    for (let i = 0; i < chunks.length; i += STATEMENTS_PER_BATCH) {
      // A retried step writes the same rows again; the unique index keeps one.
      await runBatch((tx) =>
        chunks
          .slice(i, i + STATEMENTS_PER_BATCH)
          .map((chunk) =>
            tx.insert(auditPageInlinks).values(chunk).onConflictDoNothing(),
          ),
      );
    }
    return { saved: rows.length };
  } catch (error) {
    console.error("Key page inlinks were not saved", {
      auditId: input.auditId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { saved: 0 };
  }
}

/** The audit workflow step, run after the link checks and before finalize. */
export function saveKeyPageInlinksStep(
  step: WorkflowStep,
  auditId: string,
  projectId: string,
) {
  return pgStep(step, "key-page-inlinks", DB_STEP, () =>
    saveKeyPageInlinks({ auditId, projectId }),
  );
}
