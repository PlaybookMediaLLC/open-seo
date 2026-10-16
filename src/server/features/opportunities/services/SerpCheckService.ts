import { sort } from "remeda";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { dataforseoPricing } from "@/server/lib/dataforseo/pricing";
import { SERP_ANALYSIS_DEPTH } from "@/server/lib/dataforseo/serp";
import { AppError } from "@/server/lib/errors";
import { creditsForProviderUsd } from "@/shared/billing";
import type { SerpCheck } from "@/types/schemas/opportunities";
import {
  ContentGapRepository,
  serpReason,
} from "../repositories/contentGapRepository";
import { OpportunityRepository } from "../repositories/OpportunityRepository";
import {
  priorityFor,
  serpCheckDelta,
  serpCheckedConfidence,
} from "./detectors/scoreCandidate";
import { urlJoinKey } from "./detectors/shared";

type Context = Pick<
  EnsuredUserContext,
  "organizationId" | "userId" | "userEmail" | "role"
>;
const CACHE_MS = 86_400_000;
const FEATURES_ABOVE = new Set(["paid", "ai_overview", "featured_snippet"]);
const LIVE_RESULTS = " Live results: ";

/** The low click-through opportunity, its top query and a fresh check. */
async function plan(
  context: Context,
  projectId: string,
  opportunityId: string,
) {
  const project = await ProjectRepository.getProjectForOrganization(
    projectId,
    context.organizationId,
  );
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  const detail = await OpportunityRepository.getDetail(
    projectId,
    opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND", "Opportunity not found.");
  if (detail.opportunity.type !== "low_ctr")
    throw new AppError(
      "VALIDATION_ERROR",
      "A live results check is for low click-through opportunities.",
    );
  const [top] = sort(
    detail.evidence.filter(
      (row) =>
        row.runId === detail.opportunity.evidenceRunId && row.query !== "",
    ),
    (a, b) => b.impressions - a.impressions,
  );
  if (!top)
    throw new AppError(
      "VALIDATION_ERROR",
      "This opportunity has no query to check.",
    );
  const market = {
    locationCode: project.locationCode,
    languageCode: project.languageCode,
  };
  const [latest] = detail.serpChecks;
  const cached =
    latest && Date.now() - Date.parse(latest.checkedAt) < CACHE_MS
      ? latest
      : null;
  const credits = cached
    ? 0
    : creditsForProviderUsd(
        dataforseoPricing.serp.live({
          keyword: top.query,
          ...market,
          depth: SERP_ANALYSIS_DEPTH,
        }),
      );
  return { detail, keyword: top.query, market, cached, credits };
}

/** Shows the cost first. It makes no provider call. */
async function estimate(
  context: Context,
  projectId: string,
  opportunityId: string,
) {
  const { keyword, cached, credits } = await plan(
    context,
    projectId,
    opportunityId,
  );
  return { keyword, credits, cached };
}

/**
 * One paid live results check, reused for 24 hours. Ads, an AI overview or a
 * featured snippet above the page lower confidence by 0.15; none raise it by
 * 0.10 (RFC-0002 5.3).
 */
async function check(
  context: Context,
  input: { projectId: string; opportunityId: string; confirmedCredits: number },
): Promise<SerpCheck> {
  const { detail, keyword, market, cached, credits } = await plan(
    context,
    input.projectId,
    input.opportunityId,
  );
  if (cached) return cached;
  if (credits > input.confirmedCredits)
    throw new AppError(
      "CONFLICT",
      `The estimate is now ${credits} credits. Review it and confirm again. Nothing was bought.`,
    );
  const items = await createDataforseoClient({
    ...context,
    projectId: input.projectId,
  }).serp.live({ keyword, ...market, depth: SERP_ANALYSIS_DEPTH });
  const opportunity = detail.opportunity;
  const pageKey = urlJoinKey(opportunity.url);
  const page = items.find(
    (item) =>
      item.type === "organic" &&
      item.url != null &&
      urlJoinKey(item.url) === pageKey,
  );
  const pagePosition = page?.rank_absolute ?? null;
  // Without the page in the results, every feature counts as above it.
  const above = items.filter(
    (item) =>
      FEATURES_ABOVE.has(item.type) &&
      (pagePosition === null || (item.rank_absolute ?? 0) < pagePosition),
  );
  const found = {
    hasAds: above.some((item) => item.type === "paid"),
    hasAiOverview: above.some((item) => item.type === "ai_overview"),
    hasFeaturedSnippet: above.some((item) => item.type === "featured_snippet"),
  };
  const delta = serpCheckDelta(Object.values(found).some(Boolean));
  const result: SerpCheck = {
    id: crypto.randomUUID(),
    opportunityId: opportunity.id,
    keyword,
    pagePosition,
    ...found,
    confidenceDelta: delta,
    estimatedCredits: credits,
    checkedAt: new Date().toISOString(),
  };
  const run = (await OpportunityRepository.listRuns(input.projectId)).find(
    (item) => item.id === opportunity.evidenceRunId,
  );
  const confidence = serpCheckedConfidence(run?.truncated ?? false, delta);
  const priority = priorityFor(confidence, opportunity);
  await ContentGapRepository.saveSerpCheck(input.projectId, result, {
    confidence,
    priority,
    scoreExplanation: `${opportunity.scoreExplanation.split(LIVE_RESULTS)[0]}${LIVE_RESULTS}${serpReason(result)}, so confidence is now ${confidence} and priority ${priority}.`,
  });
  return result;
}

export const SerpCheckService = { estimate, check };
