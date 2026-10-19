import { z } from "zod";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { previousPeriod } from "@/server/features/gsc/searchPerformanceReport";
import { GscService } from "@/server/features/gsc/services/GscService";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { createDataforseoClient } from "@/server/lib/dataforseo/client";
import { dataforseoPricing } from "@/server/lib/dataforseo/pricing";
import { AppError } from "@/server/lib/errors";
import { creditsForProviderUsd } from "@/shared/billing";
import type {
  OpportunityDetectionResult,
  OpportunityRun,
} from "@/types/schemas/opportunities";
import { ContentGapRepository } from "../repositories/contentGapRepository";
import { OpportunityRepository } from "../repositories/OpportunityRepository";
import { OpportunitySignalRepository } from "../repositories/opportunitySignals";
import { withAiCitations } from "./detectOpportunities";
import { contentGaps } from "./detectors/contentGap";
import { scoringContext } from "./detectors/scoreCandidate";
import { siteRoot, usableRow } from "./detectors/shared";
import { fetchGa4LandingPages } from "./opportunityGa4";
import { withIdentityKeys } from "./opportunityIdentity";

type Context = Pick<
  EnsuredUserContext,
  "organizationId" | "userId" | "userEmail" | "role"
>;
const DAY_MS = 86_400_000;
const ROW_LIMIT = 1000;
const QUERY_ROW_LIMIT = 5000;
const SNAPSHOT_DAYS = 30;
const AI_CITATION_DAYS = 30;
const MAX_COMPETITORS = 3;
// The gap rule keeps only top-10 rows with 50+ monthly searches, so the paid
// request asks DataForSEO for those rows only.
const COMPETITOR_FILTERS = [
  ["ranked_serp_element.serp_item.rank_group", "<=", 10],
  "and",
  ["keyword_data.keyword_info.search_volume", ">=", 50],
];
const rankedRow = z
  .object({
    keyword_data: z
      .object({
        keyword: z.string().min(1),
        keyword_info: z
          .object({ search_volume: z.number().nullable().optional() })
          .passthrough()
          .nullable()
          .optional(),
        keyword_properties: z
          .object({ keyword_difficulty: z.number().nullable().optional() })
          .passthrough()
          .nullable()
          .optional(),
        search_intent_info: z
          .object({ main_intent: z.string().nullable().optional() })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough(),
    ranked_serp_element: z
      .object({
        serp_item: z
          .object({
            rank_group: z.number().nullable().optional(),
            url: z.string().nullable().optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS).toISOString();

/** The upper bound reserved for one competitor's paid fetch. */
function fetchCredits() {
  return creditsForProviderUsd(
    dataforseoPricing.domain.rankedKeywords({
      target: "",
      locationCode: 0,
      languageCode: "",
      limit: ROW_LIMIT,
    }),
  );
}

async function scope(context: Context, projectId: string, domains: string[]) {
  const project = await ProjectRepository.getProjectForOrganization(
    projectId,
    context.organizationId,
  );
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  const saved = new Set(
    (await ProjectContextRepository.listCompetitors(projectId)).map(
      (competitor) => competitor.domain,
    ),
  );
  const picked = [...new Set(domains)];
  if (
    !picked.length ||
    picked.length > MAX_COMPETITORS ||
    picked.some((domain) => !saved.has(domain))
  )
    throw new AppError(
      "VALIDATION_ERROR",
      `Pick 1 to ${MAX_COMPETITORS} competitors from the project context.`,
    );
  const market = {
    locationCode: project.locationCode,
    languageCode: project.languageCode,
  };
  const fresh = await ContentGapRepository.freshSnapshots(
    projectId,
    picked,
    market,
    daysAgo(SNAPSHOT_DAYS),
  );
  const domainEstimates = picked.map((domain) => ({
    domain,
    cached: fresh.has(domain),
    credits: fresh.has(domain) ? 0 : fetchCredits(),
  }));
  return {
    project,
    market,
    fresh,
    domains: domainEstimates,
    totalCredits: domainEstimates.reduce((sum, item) => sum + item.credits, 0),
  };
}

/** Shows the cost before any paid request. It makes no provider call. */
async function estimate(
  context: Context,
  projectId: string,
  domains: string[],
) {
  const { domains: perDomain, totalCredits } = await scope(
    context,
    projectId,
    domains,
  );
  return { domains: perDomain, totalCredits };
}

async function detect(
  context: Context,
  input: { projectId: string; domains: string[]; confirmedCredits: number },
): Promise<OpportunityDetectionResult> {
  const { projectId } = input;
  const plan = await scope(context, projectId, input.domains);
  if (plan.totalCredits > input.confirmedCredits)
    throw new AppError(
      "CONFLICT",
      `The estimate is now ${plan.totalCredits} credits. Review it and confirm again. Nothing was bought.`,
    );
  const connection = await GscService.getConnection(projectId);
  if (!connection)
    return {
      outcome: "not_connected",
      run: null,
      message:
        "Connect this project's Search Console property first. Content gaps compare competitor keywords with your own search data.",
    };
  const claimKey = `opportunities:content-gap:${projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    claimKey,
    context.organizationId,
  );
  if (!token)
    return {
      outcome: "busy",
      run: await OpportunityRepository.latestRun(
        projectId,
        undefined,
        "content_gap",
      ),
      message:
        "Content gaps already ran in the last 24 hours, or a run is in progress. Saved results remain available.",
    };
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), "America/Los_Angeles"),
    -3,
  );
  const startDate = shiftGa4Date(endDate, -27);
  const previous = previousPeriod(startDate, endDate);
  const purchases = plan.domains.filter((item) => !item.cached);
  const run: OpportunityRun = {
    id: token,
    projectId,
    siteUrl: connection.siteUrl,
    kind: "content_gap",
    status: "running",
    requestedBy: context.userId,
    startDate,
    endDate,
    previousStartDate: previous.startDate,
    previousEndDate: previous.endDate,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    queryRows: 0,
    currentPageRows: 0,
    previousPageRows: 0,
    yearAgoPageRows: 0,
    ga4PropertyId: null,
    auditId: null,
    inspectionRequests: 0,
    // Paid fetches, one free Search Console report, and GA4 when connected.
    requestCount: purchases.length + 1,
    opportunityCount: 0,
    truncated: false,
    error: null,
  };
  await OpportunityRepository.startRun(run);
  try {
    const snapshotIds = [...plan.fresh.values()];
    const dataforseo = createDataforseoClient({ ...context, projectId });
    // One paid fetch at a time: each one is saved before the next starts, so
    // a later refusal keeps what was already bought.
    for (const { domain, credits } of purchases) {
      const fetched = await dataforseo.domain.rankedKeywords({
        target: domain,
        ...plan.market,
        limit: ROW_LIMIT,
        filters: COMPETITOR_FILTERS,
        orderBy: ["keyword_data.keyword_info.search_volume,desc"],
        itemTypes: ["organic"],
        creditFeature: "domain_overview",
      });
      const rows = fetched.items.flatMap((item) => {
        const parsed = rankedRow.safeParse(item);
        const position =
          parsed.data?.ranked_serp_element?.serp_item?.rank_group;
        const volume = parsed.data?.keyword_data.keyword_info?.search_volume;
        if (!parsed.success || position == null || volume == null) return [];
        const data = parsed.data.keyword_data;
        return [
          {
            keyword: data.keyword,
            position,
            url: parsed.data.ranked_serp_element?.serp_item?.url ?? null,
            searchVolume: volume,
            keywordDifficulty:
              data.keyword_properties?.keyword_difficulty ?? null,
            intent: data.search_intent_info?.main_intent ?? null,
          },
        ];
      });
      snapshotIds.push(
        await ContentGapRepository.saveSnapshot({
          projectId,
          domain,
          market: plan.market,
          fetchedAt: new Date().toISOString(),
          estimatedCredits: credits,
          rows,
        }),
      );
    }
    const ga4Connection =
      await Ga4ConnectionRepository.getByProjectId(projectId);
    run.requestCount += ga4Connection ? 1 : 0;
    const [competitorKeywords, keyPages, ranks, ai, search, ga4Rows] =
      await Promise.all([
        ContentGapRepository.snapshotKeywords(projectId, snapshotIds),
        ProjectContextRepository.listKeyPages(projectId),
        OpportunitySignalRepository.rankHistory(projectId, daysAgo(30)),
        ContentGapRepository.aiCitations(projectId, daysAgo(AI_CITATION_DAYS)),
        GscService.getPerformance({
          projectId,
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: QUERY_ROW_LIMIT,
          type: "web",
          dataState: "final",
        }),
        ga4Connection
          ? fetchGa4LandingPages(
              ga4Connection,
              { startDate, endDate },
              previous,
            ).catch(() => null)
          : null,
      ]);
    if (search.siteUrl !== run.siteUrl)
      throw new AppError(
        "CONFLICT",
        "Search Console property changed during analysis.",
      );
    const queryPages = search.rows.filter((row) => usableRow(row, 1));
    run.queryRows = queryPages.length;
    run.truncated = search.rows.length >= QUERY_ROW_LIMIT;
    run.ga4PropertyId = ga4Rows ? (ga4Connection?.propertyId ?? null) : null;
    const trackedPositions = new Map<string, number | null>();
    for (const [keyword, history] of ranks)
      trackedPositions.set(
        keyword,
        Math.min(...history.map((item) => item.lastPosition ?? Infinity)),
      );
    const candidates = contentGaps({
      competitorKeywords,
      queryPages,
      trackedPositions,
      siteRoot: siteRoot(run.siteUrl),
      context: scoringContext({
        keyPages,
        ga4:
          ga4Connection && ga4Rows
            ? { rows: ga4Rows, currency: ga4Connection.propertyCurrencyCode }
            : null,
        keywordDifficulty: new Map(),
        truncated: run.truncated,
        revenue: null,
      }),
    })
      .slice(0, 50)
      .map((candidate) => withAiCitations(candidate, ai));
    run.opportunityCount = candidates.length;
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    if (
      !(await OpportunityRepository.completeRun({
        run,
        claimKey,
        candidates: await withIdentityKeys(projectId, run.siteUrl, candidates),
      }))
    )
      throw new AppError(
        "CONFLICT",
        "Analysis claim expired or property changed.",
      );
    await DataRefreshClaimRepository.finish(claimKey, token, DAY_MS).catch(() =>
      console.warn("Content gaps saved, but the cooldown update failed."),
    );
    return {
      outcome: "completed",
      run,
      message: candidates.length
        ? `Saved ${candidates.length} content gap topics from ${competitorKeywords.length} competitor keywords.`
        : "No topic met the content gap rule. Competitor data is saved for 30 days, so a new run with the same competitors is free.",
    };
  } catch (error) {
    const message =
      error instanceof AppError && error.code === "INSUFFICIENT_CREDITS"
        ? "Not enough credits for the next competitor. Nothing more was bought, and data already bought is saved for 30 days."
        : "Content gaps could not finish. Data already bought is saved for 30 days. Retry in five minutes.";
    await OpportunityRepository.failRun(projectId, run.id, message);
    await DataRefreshClaimRepository.finish(claimKey, token, 300_000);
    return {
      outcome: "failed",
      run: { ...run, status: "failed", error: message },
      message,
    };
  }
}

export const ContentGapService = { estimate, detect };
