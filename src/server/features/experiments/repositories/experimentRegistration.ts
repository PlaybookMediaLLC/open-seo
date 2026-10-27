import { and, eq, exists, isNull, or, sql } from "drizzle-orm";
import { runBatch } from "@/db/runBatch";
import {
  gscConnections,
  growthExperiments,
  opportunities,
  opportunityProposals,
  proposalExecutions,
  publishingConnections,
} from "@/db/schema";
import type { GrowthExperiment } from "@/types/schemas/experiments";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";
import {
  claimExists,
  lockClaim,
  selectedValues,
} from "../../publishing/repositories/publishingSql";
import {
  currentProperty,
  experimentAccepted,
  experimentScope,
  lockProperty,
  type ExperimentScope,
} from "./experimentSql";

export async function register(input: {
  experiment: GrowthExperiment;
  claimToken: string;
  organizationId: string;
  audit: AuditInput;
}): Promise<boolean> {
  const { experiment } = input;
  const scope = { ...input, projectId: experiment.projectId };
  const eventId = crypto.randomUUID();
  await runBatch((tx) => {
    const property = and(
      eq(gscConnections.projectId, experiment.projectId),
      eq(gscConnections.siteUrl, experiment.siteUrl),
    );
    return [
      lockClaim(tx, scope),
      tx
        .update(gscConnections)
        .set({ siteUrl: sql`${gscConnections.siteUrl}` })
        .where(and(property, claimExists(tx, scope))),
      tx
        .insert(growthExperiments)
        .select(
          selectedValues(
            growthExperiments,
            {
              ...experiment,
              pullRequestState: "unknown",
              pullRequestCheckedAt: null,
              mergedAt: null,
              mergeCommitSha: null,
              deployedAt: null,
              deploymentConfirmedBy: null,
              deploymentNote: null,
              deploymentConfirmedAt: null,
              otherChanges: false,
              seasonalRisk: false,
              baselineStart: null,
              baselineEnd: null,
              observationStart: null,
              observationEnd: null,
              baselineRunId: null,
              lastEventId: eventId,
            },
            // oxlint-disable-next-line typescript/no-non-null-assertion -- and() is undefined only when every condition is, and claimExists() always returns SQL
            and(
              claimExists(tx, scope),
              exists(
                tx
                  .select({ id: gscConnections.id })
                  .from(gscConnections)
                  .where(property),
              ),
              exists(
                tx
                  .select({ id: proposalExecutions.id })
                  .from(proposalExecutions)
                  .innerJoin(
                    opportunityProposals,
                    and(
                      eq(
                        opportunityProposals.id,
                        proposalExecutions.proposalId,
                      ),
                      eq(
                        opportunityProposals.projectId,
                        proposalExecutions.projectId,
                      ),
                    ),
                  )
                  .innerJoin(
                    opportunities,
                    and(
                      eq(opportunities.id, opportunityProposals.opportunityId),
                      eq(
                        opportunities.projectId,
                        opportunityProposals.projectId,
                      ),
                    ),
                  )
                  .where(
                    and(
                      eq(proposalExecutions.projectId, experiment.projectId),
                      eq(proposalExecutions.id, experiment.executionId),
                      eq(proposalExecutions.status, "succeeded"),
                      eq(opportunityProposals.id, experiment.proposalId),
                      eq(opportunities.id, experiment.opportunityId),
                      eq(opportunities.siteUrl, experiment.siteUrl),
                      eq(opportunityProposals.targetUrl, experiment.targetUrl),
                    ),
                  ),
              ),
            )!,
          ),
        )
        .onConflictDoNothing(),
      auditInsert(
        tx,
        input.audit,
        exists(
          tx
            .select({ id: growthExperiments.id })
            .from(growthExperiments)
            .where(
              and(
                eq(growthExperiments.projectId, experiment.projectId),
                eq(growthExperiments.id, experiment.id),
                eq(growthExperiments.lastEventId, eventId),
              ),
            ),
        ),
      ),
    ];
  });
  return experimentAccepted(experiment.projectId, experiment.id, eventId);
}

export async function recordPullStatus(
  input: ExperimentScope & {
    connectionId: string;
    state: GrowthExperiment["pullRequestState"];
    checkedAt: string;
    mergedAt: string | null;
    mergeCommitSha: string | null;
  },
): Promise<boolean> {
  if (input.state === "merged" && (!input.mergedAt || !input.mergeCommitSha))
    return false;
  const eventId = crypto.randomUUID();
  await runBatch((tx) => [
    lockClaim(tx, input),
    lockProperty(tx, input),
    tx
      .update(growthExperiments)
      .set({
        pullRequestState: input.state,
        pullRequestCheckedAt: input.checkedAt,
        mergedAt: input.state === "merged" ? input.mergedAt : null,
        mergeCommitSha: input.state === "merged" ? input.mergeCommitSha : null,
        lastEventId: eventId,
      })
      .where(
        and(
          experimentScope(input.projectId, input.experimentId),
          claimExists(tx, input),
          currentProperty(tx, input.projectId),
          or(
            isNull(growthExperiments.mergedAt),
            and(
              eq(growthExperiments.pullRequestState, input.state),
              eq(growthExperiments.mergedAt, input.mergedAt ?? ""),
              eq(growthExperiments.mergeCommitSha, input.mergeCommitSha ?? ""),
            ),
          ),
          exists(
            tx
              .select({ id: publishingConnections.id })
              .from(publishingConnections)
              .where(
                and(
                  eq(publishingConnections.projectId, input.projectId),
                  eq(publishingConnections.id, input.connectionId),
                  isNull(publishingConnections.revokedAt),
                  sql`exists (select 1 from ${opportunityProposals} proposal join ${publishingConnections} historical on historical.id = proposal.connection_id and historical.project_id = proposal.project_id where proposal.id = ${growthExperiments.proposalId} and proposal.project_id = ${input.projectId} and historical.repository_id = ${publishingConnections.repositoryId} and historical.base_branch = ${publishingConnections.baseBranch})`,
                ),
              ),
          ),
        ),
      ),
  ]);
  return experimentAccepted(input.projectId, input.experimentId, eventId);
}
