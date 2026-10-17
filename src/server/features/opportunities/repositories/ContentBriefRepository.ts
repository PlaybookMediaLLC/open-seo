import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { contentBriefKeywords, contentBriefs } from "@/db/schema";
import type { ContentBrief } from "@/types/schemas/contentBriefs";

const LIST_LIMIT = 5;

/** Briefs the project made since a time. */
async function countSince(projectId: string, since: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(contentBriefs)
    .where(
      and(
        eq(contentBriefs.projectId, projectId),
        gte(contentBriefs.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

async function save(projectId: string, brief: ContentBrief): Promise<void> {
  const { keywords, ...row } = brief;
  await runBatch((tx) => [
    tx.insert(contentBriefs).values({ ...row, projectId }),
    ...keywords.map((keyword) =>
      tx.insert(contentBriefKeywords).values({
        ...keyword,
        id: crypto.randomUUID(),
        projectId,
        briefId: brief.id,
      }),
    ),
  ]);
}

/** An opportunity's newest briefs, with their keywords. */
async function list(
  projectId: string,
  opportunityId: string,
): Promise<ContentBrief[]> {
  const briefs = await db
    .select({
      id: contentBriefs.id,
      opportunityId: contentBriefs.opportunityId,
      status: contentBriefs.status,
      title: contentBriefs.title,
      audience: contentBriefs.audience,
      searchIntent: contentBriefs.searchIntent,
      outlineMarkdown: contentBriefs.outlineMarkdown,
      model: contentBriefs.model,
      promptVersion: contentBriefs.promptVersion,
      costUsd: contentBriefs.costUsd,
      createdBy: contentBriefs.createdBy,
      createdAt: contentBriefs.createdAt,
    })
    .from(contentBriefs)
    .where(
      and(
        eq(contentBriefs.projectId, projectId),
        eq(contentBriefs.opportunityId, opportunityId),
      ),
    )
    .orderBy(desc(contentBriefs.createdAt), desc(contentBriefs.id))
    .limit(LIST_LIMIT);
  if (!briefs.length) return [];
  const keywords = await db
    .select({
      briefId: contentBriefKeywords.briefId,
      keyword: contentBriefKeywords.keyword,
      searchVolume: contentBriefKeywords.searchVolume,
      role: contentBriefKeywords.role,
    })
    .from(contentBriefKeywords)
    .where(
      and(
        eq(contentBriefKeywords.projectId, projectId),
        inArray(
          contentBriefKeywords.briefId,
          briefs.map((brief) => brief.id),
        ),
      ),
    )
    // "primary" sorts before "secondary".
    .orderBy(contentBriefKeywords.role, contentBriefKeywords.keyword);
  return briefs.map((brief) => ({
    ...brief,
    keywords: keywords
      .filter((keyword) => keyword.briefId === brief.id)
      .map(({ briefId: _id, ...keyword }) => keyword),
  }));
}

export const ContentBriefRepository = { countSince, save, list };
