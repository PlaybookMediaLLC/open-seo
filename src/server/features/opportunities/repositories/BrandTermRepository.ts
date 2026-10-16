import { and, asc, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { projectBrandTerms, projects } from "@/db/schema";
import type { BRAND_TERM_AUTHORS } from "@/types/schemas/opportunities";

async function list(
  projectId: string,
): Promise<{ terms: string[]; domain: string | null }> {
  const [project] = await db
    .select({ domain: projects.domain })
    .from(projects)
    .where(eq(projects.id, projectId));
  const rows = await db
    .select({ term: projectBrandTerms.term })
    .from(projectBrandTerms)
    .where(eq(projectBrandTerms.projectId, projectId))
    .orderBy(asc(projectBrandTerms.term));
  return {
    terms: rows.map((row) => row.term),
    domain: project?.domain ?? null,
  };
}

/** Keeps the saved rows of terms that stay, so their author does not change. */
async function replace(
  projectId: string,
  terms: string[],
  createdBy: (typeof BRAND_TERM_AUTHORS)[number],
): Promise<void> {
  const createdAt = new Date().toISOString();
  await runBatch((tx) => [
    tx
      .delete(projectBrandTerms)
      .where(
        and(
          eq(projectBrandTerms.projectId, projectId),
          terms.length ? notInArray(projectBrandTerms.term, terms) : undefined,
        ),
      ),
    ...terms.map((term) =>
      tx
        .insert(projectBrandTerms)
        .values({
          id: crypto.randomUUID(),
          projectId,
          term,
          createdBy,
          createdAt,
        })
        .onConflictDoNothing(),
    ),
  ]);
}

export const BrandTermRepository = { list, replace };
