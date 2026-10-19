import { loadPerformanceSignals } from "@/server/features/performance/performanceSignals";
import { loadRevenueScores } from "@/server/features/revenue/RevenueReportService";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { GscService } from "@/server/features/gsc/services/GscService";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import type {
  InspectionEvidence,
  OpportunityCandidate,
} from "@/types/schemas/opportunities";
import { OpportunityRepository } from "../repositories/OpportunityRepository";
import { ContentGapRepository } from "../repositories/contentGapRepository";
import { OpportunitySignalRepository } from "../repositories/opportunitySignals";
import { BrandTermService } from "./BrandTermService";
import {
  isIndexingIssue,
  TECHNICAL_ISSUE_TYPES,
} from "./detectors/technicalBlocker";
import { urlJoinKey } from "./detectors/shared";

const DAY_MS = 86_400_000;
const DIFFICULTY_MAX_AGE_DAYS = 90;
const AUDIT_MAX_AGE_DAYS = 30;
const RANK_HISTORY_DAYS = 30;
const AI_CITATION_DAYS = 30;
const SERP_CHECK_HOURS = 24;
const INSPECTIONS_PER_RUN = 10;
// Google allows about 2,000 inspections a day per property. This cap keeps
// retried runs of one project far below that.
const DAILY_INSPECTION_CAP = 50;

const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS).toISOString();

/** Free first-party reads that detection needs before any network call. */
export async function loadDetectionSignals(project: {
  id: string;
  locationCode: number;
  languageCode: string;
}) {
  const projectId = project.id;
  const [
    keyPages,
    brandTerms,
    ga4Connection,
    keywordDifficulty,
    audit,
    rankHistory,
    inspectionsToday,
    aiCitations,
    serpChecks,
    performance,
    revenue,
  ] = await Promise.all([
    ProjectContextRepository.listKeyPages(projectId),
    BrandTermService.get(projectId),
    Ga4ConnectionRepository.getByProjectId(projectId),
    OpportunityRepository.cachedKeywordDifficulty({
      projectId,
      locationCode: project.locationCode,
      languageCode: project.languageCode,
      since: daysAgo(DIFFICULTY_MAX_AGE_DAYS),
    }),
    OpportunitySignalRepository.latestAudit(
      projectId,
      daysAgo(AUDIT_MAX_AGE_DAYS),
      TECHNICAL_ISSUE_TYPES,
    ),
    OpportunitySignalRepository.rankHistory(
      projectId,
      daysAgo(RANK_HISTORY_DAYS),
    ),
    OpportunitySignalRepository.inspectionRequestsSince(
      projectId,
      new Date().toISOString().slice(0, 10),
    ),
    ContentGapRepository.aiCitations(projectId, daysAgo(AI_CITATION_DAYS)),
    ContentGapRepository.recentSerpChecks(
      projectId,
      daysAgo(SERP_CHECK_HOURS / 24),
    ),
    loadPerformanceSignals(projectId),
    loadRevenueScores(projectId),
  ]);
  return {
    ga4Connection,
    audit,
    // The free inputs that detection takes as they are.
    inputs: {
      keyPages,
      brandTerms: brandTerms.terms,
      keywordDifficulty,
      audit,
      rankHistory,
      aiCitations,
      serpChecks,
      performance,
      revenue,
    },
    // Inspections only check audit issues, so a run without an audit needs none.
    inspectionBudget: audit
      ? Math.max(
          0,
          Math.min(
            INSPECTIONS_PER_RUN,
            DAILY_INSPECTION_CAP - inspectionsToday,
          ),
        )
      : 0,
  };
}

/**
 * URL inspection for the highest-priority technical candidates that can stop
 * indexing. Inspection is free but limited by Google, so it only confirms;
 * a failure leaves the candidates as they are.
 */
export async function inspectTopBlockers(
  projectId: string,
  candidates: OpportunityCandidate[],
  budget: number,
): Promise<Map<string, InspectionEvidence>> {
  const urls = [
    ...new Set(
      candidates
        .filter(
          (candidate) =>
            candidate.audit && isIndexingIssue(candidate.audit.issueType),
        )
        .map((candidate) => candidate.url),
    ),
  ].slice(0, budget);
  const inspections = new Map<string, InspectionEvidence>();
  if (!urls.length) return inspections;
  try {
    const { results } = await GscService.inspectUrls({ projectId, urls });
    const inspectedAt = new Date().toISOString();
    for (const { url, result } of results) {
      const status = result?.indexStatusResult;
      const key = urlJoinKey(url);
      if (!status || !key) continue;
      inspections.set(key, {
        url,
        verdict: status.verdict ?? null,
        coverageState: status.coverageState ?? null,
        indexingState: status.indexingState ?? null,
        robotsTxtState: status.robotsTxtState ?? null,
        pageFetchState: status.pageFetchState ?? null,
        googleCanonical: status.googleCanonical ?? null,
        userCanonical: status.userCanonical ?? null,
        lastCrawlTime: status.lastCrawlTime ?? null,
        inspectedAt,
      });
    }
  } catch (error) {
    console.warn("URL inspection skipped", {
      projectId,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
  return inspections;
}

/** Plain notes about signals and types that a run could not use. */
export function detectionNotes(input: {
  ga4Connected: boolean;
  revenue: boolean;
  ga4Failed: boolean;
  audit: { inlinks: Map<string, Set<string>> } | null;
  inspectionSkipped: boolean;
}): string {
  return [
    !input.ga4Connected &&
      !input.revenue &&
      "GA4 is not connected, so commercial value uses page roles only.",
    input.ga4Failed &&
      "The GA4 report failed, so commercial value uses page roles only.",
    !input.audit &&
      "No recent site audit. Run an audit to check technical blockers and internal links.",
    input.audit &&
      !input.audit.inlinks.size &&
      "The latest audit has no internal-link data. Mark money or hub key pages, then run a new audit.",
    input.inspectionSkipped &&
      "URL inspection was skipped, because this project used its daily limit.",
  ]
    .filter(Boolean)
    .map((note) => ` ${note}`)
    .join("");
}
