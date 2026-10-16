import { and, eq, exists, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  gscConnections,
  opportunities,
  opportunityDecisions,
} from "@/db/schema";
import type {
  OpportunityDecisionKind,
  OpportunityStatus,
} from "@/types/schemas/opportunities";

export async function review(input: {
  projectId: string;
  opportunityId: string;
  expectedVersion: number;
  actorUserId: string;
  decision: Exclude<OpportunityDecisionKind, "reverted">;
  /** The new owner of an "assigned" decision. Null unassigns. */
  ownerUserId?: string | null;
  note: string;
  fromStatus: OpportunityStatus;
  toStatus: OpportunityStatus;
  deferredUntil: string | null;
}): Promise<boolean> {
  const decisionId = crypto.randomUUID();
  const scope = and(
    eq(opportunities.projectId, input.projectId),
    eq(opportunities.id, input.opportunityId),
  );
  await runBatch((tx) => [
    // Approval must serialize with disconnect/repoint on Postgres. A service
    // precheck alone leaves a race because changing GSC does not bump version.
    ...(input.decision === "approved"
      ? [
          tx
            .update(gscConnections)
            .set({ siteUrl: sql`${gscConnections.siteUrl}` })
            .where(
              and(
                eq(gscConnections.projectId, input.projectId),
                exists(
                  tx
                    .select({ id: opportunities.id })
                    .from(opportunities)
                    .where(
                      and(
                        scope,
                        eq(opportunities.siteUrl, gscConnections.siteUrl),
                      ),
                    ),
                ),
              ),
            ),
        ]
      : []),
    tx
      .update(opportunities)
      .set({
        status: input.toStatus,
        ownerUserId:
          input.decision === "approved"
            ? input.actorUserId
            : input.decision === "assigned"
              ? (input.ownerUserId ?? null)
              : sql`${opportunities.ownerUserId}`,
        // An assignment keeps a deferral; every other decision sets it.
        deferredUntil:
          input.decision === "assigned"
            ? sql`${opportunities.deferredUntil}`
            : input.deferredUntil,
        version: sql`${opportunities.version} + 1`,
        lastDecisionId: decisionId,
      })
      .where(
        and(
          scope,
          eq(opportunities.version, input.expectedVersion),
          eq(opportunities.status, input.fromStatus),
          input.decision === "approved"
            ? exists(
                tx
                  .select({ id: gscConnections.id })
                  .from(gscConnections)
                  .where(
                    and(
                      eq(gscConnections.projectId, input.projectId),
                      eq(gscConnections.siteUrl, opportunities.siteUrl),
                    ),
                  ),
              )
            : undefined,
        ),
      ),
    // The unique decision fence can only be installed by the winning CAS.
    // Read the evidence pointer in the same transaction, never from the client.
    tx.insert(opportunityDecisions).select(
      tx
        .select({
          id: sql<string>`${decisionId}`.as("id"),
          projectId: opportunities.projectId,
          opportunityId: opportunities.id,
          evidenceRunId: opportunities.evidenceRunId,
          actorUserId: sql<string>`${input.actorUserId}`.as("actor_user_id"),
          decision: sql<OpportunityDecisionKind>`${input.decision}`.as(
            "decision",
          ),
          fromStatus: sql<OpportunityStatus>`${input.fromStatus}`.as(
            "from_status",
          ),
          toStatus: sql<OpportunityStatus>`${input.toStatus}`.as("to_status"),
          note: sql<string>`${input.note}`.as("note"),
          createdAt: sql<string>`${new Date().toISOString()}`.as("created_at"),
        })
        .from(opportunities)
        .where(and(scope, eq(opportunities.lastDecisionId, decisionId))),
    ),
  ]);
  const [decision] = await db
    .select({ id: opportunityDecisions.id })
    .from(opportunityDecisions)
    .where(
      and(
        eq(opportunityDecisions.projectId, input.projectId),
        eq(opportunityDecisions.id, decisionId),
      ),
    );
  return Boolean(decision);
}
