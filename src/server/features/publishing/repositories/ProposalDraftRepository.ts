import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  proposalDraftClaims,
  proposalDraftSources,
  proposalDrafts,
} from "@/db/schema";
import type { ProposalDraft } from "@/types/schemas/proposalDrafts";

type DraftRow = Omit<ProposalDraft, "sources" | "claims">;

/** Drafts made since a time, for the opportunity and for the project. */
async function countSince(
  projectId: string,
  opportunityId: string,
  since: string,
) {
  const rows = await db
    .select({
      opportunityId: proposalDrafts.opportunityId,
      total: count(),
    })
    .from(proposalDrafts)
    .where(
      and(
        eq(proposalDrafts.projectId, projectId),
        gte(proposalDrafts.createdAt, since),
      ),
    )
    .groupBy(proposalDrafts.opportunityId);
  return {
    opportunity: Number(
      rows.find((row) => row.opportunityId === opportunityId)?.total ?? 0,
    ),
    project: rows.reduce((sum, row) => sum + Number(row.total), 0),
  };
}

/** Saves a draft with its sources and claims in one batch. */
async function save(projectId: string, draft: ProposalDraft): Promise<void> {
  const { sources, claims, ...row } = draft;
  await runBatch((tx) => [
    tx.insert(proposalDrafts).values({ ...row, projectId }),
    ...sources.map((source) =>
      tx
        .insert(proposalDraftSources)
        .values({ ...source, projectId, draftId: draft.id }),
    ),
    ...claims.map((claim) =>
      tx
        .insert(proposalDraftClaims)
        .values({ ...claim, projectId, draftId: draft.id }),
    ),
  ]);
}

/** An opportunity's drafts, newest first, with their sources and claims. */
async function list(
  projectId: string,
  opportunityId: string,
): Promise<ProposalDraft[]> {
  const drafts: DraftRow[] = await db
    .select({
      id: proposalDrafts.id,
      opportunityId: proposalDrafts.opportunityId,
      opportunityVersion: proposalDrafts.opportunityVersion,
      evidenceRunId: proposalDrafts.evidenceRunId,
      kind: proposalDrafts.kind,
      status: proposalDrafts.status,
      targetUrl: proposalDrafts.targetUrl,
      filePath: proposalDrafts.filePath,
      valueBefore: proposalDrafts.valueBefore,
      valueAfter: proposalDrafts.valueAfter,
      rationale: proposalDrafts.rationale,
      validationSummary: proposalDrafts.validationSummary,
      model: proposalDrafts.model,
      promptVersion: proposalDrafts.promptVersion,
      inputDigest: proposalDrafts.inputDigest,
      costUsd: proposalDrafts.costUsd,
      createdBy: proposalDrafts.createdBy,
      createdAt: proposalDrafts.createdAt,
    })
    .from(proposalDrafts)
    .where(
      and(
        eq(proposalDrafts.projectId, projectId),
        eq(proposalDrafts.opportunityId, opportunityId),
      ),
    )
    .orderBy(desc(proposalDrafts.createdAt), desc(proposalDrafts.id))
    .limit(20);
  if (!drafts.length) return [];
  const ids = drafts.map((draft) => draft.id);
  const [sources, claims] = await Promise.all([
    db
      .select({
        id: proposalDraftSources.id,
        draftId: proposalDraftSources.draftId,
        kind: proposalDraftSources.kind,
        label: proposalDraftSources.label,
        excerpt: proposalDraftSources.excerpt,
      })
      .from(proposalDraftSources)
      .where(
        and(
          eq(proposalDraftSources.projectId, projectId),
          inArray(proposalDraftSources.draftId, ids),
        ),
      ),
    db
      .select({
        id: proposalDraftClaims.id,
        draftId: proposalDraftClaims.draftId,
        claimText: proposalDraftClaims.claimText,
        sourceId: proposalDraftClaims.sourceId,
        verified: proposalDraftClaims.verified,
      })
      .from(proposalDraftClaims)
      .where(
        and(
          eq(proposalDraftClaims.projectId, projectId),
          inArray(proposalDraftClaims.draftId, ids),
        ),
      ),
  ]);
  return drafts.map((draft) => ({
    ...draft,
    sources: sources
      .filter((source) => source.draftId === draft.id)
      .map(({ draftId: _draftId, ...source }) => source),
    claims: claims
      .filter((claim) => claim.draftId === draft.id)
      .map(({ draftId: _draftId, ...claim }) => claim),
  }));
}

/** Discards a generated draft. Used and rejected drafts stay as they are. */
async function discard(projectId: string, draftId: string): Promise<void> {
  await db
    .update(proposalDrafts)
    .set({ status: "discarded" })
    .where(
      and(
        eq(proposalDrafts.projectId, projectId),
        eq(proposalDrafts.id, draftId),
        eq(proposalDrafts.status, "generated"),
      ),
    );
}

export const ProposalDraftRepository = { countSince, save, list, discard };
