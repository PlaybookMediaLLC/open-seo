import { sort } from "remeda";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import {
  get,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { queryCruxHistory } from "@/server/lib/crux";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { fieldResult, type FieldResult } from "@/shared/performance";
import { fieldHistory, storeFieldHistory } from "./fieldData";

// RFC-0014 5.6: the field result of a performance item, measured from the
// day a person marked it implemented. One CrUX History request an hour.
const REFRESH_EVERY_MS = 3_600_000;

type PerformanceResult =
  | { status: "not_implemented" | "not_configured" }
  | (FieldResult & { changedOn: string });

async function result(
  context: OpportunityContext,
  input: { projectId: string; opportunityId: string },
  refresh: boolean,
): Promise<PerformanceResult> {
  const detail = await get(context, input.projectId, input.opportunityId);
  const evidence = detail.performanceEvidence.find(
    (row) => row.runId === detail.opportunity.evidenceRunId,
  );
  if (!evidence)
    throw new AppError(
      "VALIDATION_ERROR",
      "Only performance issues have a field result.",
    );
  const [changed] = sort(
    detail.decisions.filter((decision) => decision.toStatus === "implemented"),
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
  if (!changed) return { status: "not_implemented" };
  const target = {
    scope: evidence.scope,
    target: evidence.target,
    formFactor: evidence.formFactor,
  };
  if (refresh) {
    const apiKey = await getOptionalEnvValue("CRUX_API_KEY");
    if (!apiKey) return { status: "not_configured" };
    const key = `cwv-history:${detail.opportunity.id}`;
    const token = await DataRefreshClaimRepository.claim(
      key,
      context.organizationId,
    );
    // Within the hour, the stored points answer.
    if (token)
      try {
        const points = await queryCruxHistory(
          apiKey,
          { scope: target.scope, value: target.target },
          target.formFactor,
        );
        if (points)
          await storeFieldHistory(input.projectId, target, points, new Date());
      } finally {
        await DataRefreshClaimRepository.finish(key, token, REFRESH_EVERY_MS);
      }
  }
  const points = await fieldHistory(input.projectId, target);
  const value = (point: (typeof points)[number]) =>
    evidence.metric === "lcp"
      ? point.lcpP75Ms
      : evidence.metric === "inp"
        ? point.inpP75Ms
        : point.clsP75;
  return {
    changedOn: changed.createdAt.slice(0, 10),
    ...fieldResult(
      points.map((point) => ({
        collectionEnd: point.collectionEnd,
        value: value(point),
      })),
      changed.createdAt,
      evidence.metric,
    ),
  };
}

export const PerformanceResultService = {
  get: (
    context: OpportunityContext,
    input: { projectId: string; opportunityId: string },
  ) => result(context, input, false),
  refresh: (
    context: OpportunityContext,
    input: { projectId: string; opportunityId: string },
  ) => result(context, input, true),
};
