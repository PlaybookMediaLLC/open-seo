import { and, eq, exists, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { runBatch } from "@/db/runBatch";
import { growthExperiments, opportunities } from "@/db/schema";
import {
  claimExists,
  lockClaim,
} from "../../publishing/repositories/publishingSql";
import {
  currentProperty,
  experimentAccepted,
  experimentScope,
  lockProperty,
  type ExperimentScope,
} from "./experimentSql";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

export async function confirmDeployment(
  input: ExperimentScope & {
    deployedAt: string;
    confirmedBy: string;
    note: string;
    confirmedAt: string;
    otherChanges: boolean;
    seasonalRisk: boolean;
    basis: "human" | "verified";
    audit?: AuditInput;
    baselineStart: string;
    baselineEnd: string;
    observationStart: string;
    observationEnd: string;
  },
): Promise<boolean> {
  const deployedTime = Date.parse(input.deployedAt);
  if (!Number.isFinite(deployedTime) || deployedTime > Date.now()) return false;
  const deployedAt = new Date(deployedTime).toISOString();
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  await runBatch((tx) => {
    const accepted = exists(
      tx
        .select({ id: growthExperiments.id })
        .from(growthExperiments)
        .where(
          and(
            experimentScope(input.projectId, input.experimentId),
            eq(growthExperiments.lastEventId, eventId),
            eq(growthExperiments.opportunityId, opportunities.id),
          ),
        ),
    );
    return [
      lockClaim(tx, input),
      lockProperty(tx, input),
      tx
        .update(growthExperiments)
        .set({
          deployedAt,
          deploymentConfirmedBy: input.confirmedBy,
          deploymentNote: input.note,
          deploymentConfirmedAt: input.confirmedAt,
          deploymentBasis: input.basis,
          otherChanges: input.otherChanges,
          seasonalRisk: input.seasonalRisk,
          baselineStart: input.baselineStart,
          baselineEnd: input.baselineEnd,
          observationStart: input.observationStart,
          observationEnd: input.observationEnd,
          lastEventId: eventId,
        })
        .where(
          and(
            experimentScope(input.projectId, input.experimentId),
            isNull(growthExperiments.deployedAt),
            isNull(growthExperiments.deploymentConfirmedAt),
            claimExists(tx, input),
            currentProperty(tx, input.projectId),
            eq(growthExperiments.pullRequestState, "merged"),
            isNotNull(growthExperiments.mergeCommitSha),
            gte(
              growthExperiments.pullRequestCheckedAt,
              new Date(Date.now() - 300_000).toISOString(),
            ),
            lte(growthExperiments.pullRequestCheckedAt, now),
            lte(growthExperiments.mergedAt, deployedAt),
            exists(
              tx
                .select({ id: opportunities.id })
                .from(opportunities)
                .where(
                  and(
                    eq(opportunities.projectId, input.projectId),
                    eq(opportunities.id, growthExperiments.opportunityId),
                    eq(opportunities.siteUrl, growthExperiments.siteUrl),
                  ),
                ),
            ),
          ),
        ),
      tx
        .update(opportunities)
        .set({
          status: "implemented",
          version: sql`${opportunities.version} + 1`,
        })
        .where(
          and(
            eq(opportunities.projectId, input.projectId),
            // Never overwrite a later human decision such as rejection.
            eq(opportunities.status, "in_progress"),
            accepted,
          ),
        ),
      // RFC-0009: services pass the event; it lands only with the change.
      ...(input.audit
        ? [
            auditInsert(
              tx,
              input.audit,
              exists(
                tx
                  .select({ id: growthExperiments.id })
                  .from(growthExperiments)
                  .where(
                    and(
                      experimentScope(input.projectId, input.experimentId),
                      eq(growthExperiments.lastEventId, eventId),
                    ),
                  ),
              ),
            ),
          ]
        : []),
    ];
  });
  return experimentAccepted(input.projectId, input.experimentId, eventId);
}
