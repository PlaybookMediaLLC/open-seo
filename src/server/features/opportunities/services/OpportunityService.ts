import { sort } from "remeda";
import { hasOrgPermission } from "@/lib/org-permissions";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { previousPeriod } from "@/server/features/gsc/searchPerformanceReport";
import { GscService } from "@/server/features/gsc/services/GscService";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AppError } from "@/server/lib/errors";
import {
  GscApiError,
  GscNotConnectedError,
  GscTokenError,
} from "@/server/lib/gscErrors";
import type {
  OpportunityCandidate,
  OpportunityDetectionResult,
  OpportunityListInput,
  OpportunityReviewInput,
  OpportunityRun,
  OpportunityStatus,
} from "@/types/schemas/opportunities";
import { OpportunityRepository } from "../repositories/OpportunityRepository";
import { BrandTermService } from "./BrandTermService";
import { detectOpportunities } from "./detectOpportunities";
import { requestDetectionData } from "./detectionRequests";

type Context = Pick<EnsuredUserContext, "organizationId" | "userId" | "role">;
const DAY_MS = 86_400_000;
const DIFFICULTY_MAX_AGE_DAYS = 90;
const DEADLINE_MS = 120_000;
async function authorize(context: Context, projectId: string) {
  const project = await ProjectRepository.getProjectForOrganization(
    projectId,
    context.organizationId,
  );
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  return project;
}

async function list(context: Context, input: OpportunityListInput) {
  await authorize(context, input.projectId);
  const [result, latestRun, connection, runs] = await Promise.all([
    OpportunityRepository.list(input),
    OpportunityRepository.latestRun(input.projectId),
    GscService.getConnection(input.projectId),
    OpportunityRepository.listRuns(input.projectId),
  ]);
  return {
    ...result,
    latestRun,
    runs,
    connected: Boolean(connection),
    canReview: hasOrgPermission(context.role, { integration: ["manage"] }),
  };
}

async function get(context: Context, projectId: string, opportunityId: string) {
  await authorize(context, projectId);
  const detail = await OpportunityRepository.getDetail(
    projectId,
    opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND", "Opportunity not found.");
  return detail;
}

function failureMessage(error: unknown): string {
  // Never persist provider bodies, OAuth secrets or arbitrary error text.
  if (
    error instanceof GscNotConnectedError ||
    error instanceof GscTokenError ||
    (error instanceof GscApiError && [401, 403, 404].includes(error.status))
  ) {
    return "Search Console access is unavailable. Reconnect the project property in Integrations, then retry.";
  }
  if (error instanceof GscApiError && error.status === 429) {
    return "Search Console rate limit reached. Wait five minutes before retrying.";
  }
  if (error instanceof AppError && error.code === "CONFLICT") {
    return "The connection or run ownership changed during analysis. No opportunities were published. Retry after the cooldown.";
  }
  return "Analysis could not finish. Existing opportunities are unchanged. Wait five minutes and retry, or check the Search Console connection.";
}

async function identityKey(
  projectId: string,
  siteUrl: string,
  candidate: OpportunityCandidate,
) {
  // Structured tuple prevents ambiguous delimiters. This is an identity hash,
  // not a store of relational data; evidence lives in separate normalized rows.
  // Single-URL types keep the original tuple, so their hashes never change.
  const tuple =
    candidate.type === "cannibalization"
      ? [
          projectId,
          siteUrl,
          candidate.type,
          sort(
            candidate.urls.map((item) => item.url),
            (a, b) => (a < b ? -1 : a > b ? 1 : 0),
          ),
        ]
      : [projectId, siteUrl, candidate.type, candidate.url, candidate.query];
  const bytes = new TextEncoder().encode(JSON.stringify(tuple));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function detect(
  context: Context,
  projectId: string,
): Promise<OpportunityDetectionResult> {
  const project = await authorize(context, projectId);
  const connection = await GscService.getConnection(projectId);
  if (!connection)
    return {
      outcome: "not_connected",
      run: null,
      message:
        "Connect this project's Search Console property in Integrations to discover opportunities.",
    };
  const latest = await OpportunityRepository.latestRun(
    projectId,
    connection.siteUrl,
  );
  if (
    latest?.status === "completed" &&
    Date.now() - Date.parse(latest.startedAt) < DAY_MS
  ) {
    return {
      outcome: "cached",
      run: latest,
      message:
        "Using the saved analysis from the last 24 hours. No provider calls were made.",
    };
  }

  // One project-wide claim also prevents bypassing the cooldown by switching
  // properties. No paid provider or model is part of this workflow.
  const claimKey = `opportunities:gsc:${projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    claimKey,
    context.organizationId,
  );
  if (!token)
    return {
      outcome: "busy",
      run: latest,
      message:
        "Analysis is already running or cooling down. Saved results remain available. Retry in a few minutes.",
    };

  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), "America/Los_Angeles"),
    -3,
  );
  const startDate = shiftGa4Date(endDate, -27);
  const previous = previousPeriod(startDate, endDate);
  const run: OpportunityRun = {
    id: token,
    projectId,
    siteUrl: connection.siteUrl,
    kind: "search_console",
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
    requestCount: 0,
    opportunityCount: 0,
    truncated: false,
    error: null,
  };
  await OpportunityRepository.startRun(run);
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(DEADLINE_MS),
  ]);
  let rejectTimeout: (() => void) | undefined;
  try {
    const [keyPages, brandTerms, ga4Connection, keywordDifficulty] =
      await Promise.all([
        ProjectContextRepository.listKeyPages(projectId),
        BrandTermService.get(projectId),
        Ga4ConnectionRepository.getByProjectId(projectId),
        OpportunityRepository.cachedKeywordDifficulty({
          projectId,
          locationCode: project.locationCode,
          languageCode: project.languageCode,
          since: new Date(
            Date.now() - DIFFICULTY_MAX_AGE_DAYS * DAY_MS,
          ).toISOString(),
        }),
      ]);
    // Reserve the entire bounded request allowance before starting network work:
    // five Search Console reports, plus one GA4 report when GA4 is connected.
    run.requestCount = ga4Connection ? 6 : 5;
    run.ga4PropertyId = ga4Connection?.propertyId ?? null;
    await OpportunityRepository.setRequestCount(
      projectId,
      run.id,
      run.requestCount,
    );
    // Attach the rejection only when the race is ready to handle it. Database
    // setup may take time, so check cancellation before starting any query.
    signal.throwIfAborted();
    const timeout = new Promise<never>((_, reject) => {
      rejectTimeout = () =>
        reject(new Error("Opportunity analysis deadline reached"));
      signal.addEventListener("abort", rejectTimeout, { once: true });
    });
    const data = await Promise.race([
      requestDetectionData({
        projectId,
        siteUrl: run.siteUrl,
        current: { startDate, endDate },
        previous,
        ga4Connection,
        signal,
      }),
      timeout,
    ]);
    const { ga4Rows, ...searchConsole } = data;
    run.queryRows = data.queryPages.length;
    run.currentPageRows = data.currentPages.length;
    run.previousPageRows = data.previousPages.length;
    run.yearAgoPageRows =
      data.yearAgoPages.length + data.yearAgoPreviousPages.length;
    run.truncated = data.truncated;
    if (!ga4Rows) run.ga4PropertyId = null;
    const candidates = detectOpportunities({
      ...searchConsole,
      keyPages,
      brandTerms: brandTerms.terms,
      ga4:
        ga4Connection && ga4Rows
          ? { rows: ga4Rows, currency: ga4Connection.propertyCurrencyCode }
          : null,
      keywordDifficulty,
    });
    const identified = await Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        identityKey: await identityKey(projectId, run.siteUrl, candidate),
      })),
    );
    run.opportunityCount = candidates.length;
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    // Atomic repository commit checks both claim ownership and property mapping.
    if (
      !(await OpportunityRepository.completeRun({
        run,
        claimKey,
        candidates: identified,
      }))
    ) {
      throw new AppError(
        "CONFLICT",
        "Analysis claim expired or property changed.",
      );
    }
    await DataRefreshClaimRepository.finish(claimKey, token, DAY_MS).catch(
      () => {
        // The completed run is already the cache authority. A cooldown-write
        // failure must not relabel an atomically committed success as a failure.
        console.warn(
          "Opportunity analysis saved, but refresh cooldown update failed.",
        );
      },
    );
    const ga4Note = !ga4Connection
      ? " GA4 is not connected, so commercial value uses page roles only."
      : !ga4Rows
        ? " The GA4 report failed, so commercial value uses page roles only."
        : "";
    return {
      outcome: "completed",
      run,
      message:
        (candidates.length > 0
          ? `Saved ${candidates.length} evidence-backed investigation opportunities. No website changes were made.`
          : "No qualifying opportunities were found in the returned data. This is not a complete assessment of the site.") +
        ga4Note,
    };
  } catch (error) {
    const message = failureMessage(error);
    await OpportunityRepository.failRun(projectId, run.id, message);
    await DataRefreshClaimRepository.finish(claimKey, token, 300_000);
    return {
      outcome: "failed",
      run: {
        ...run,
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
      },
      message,
    };
  } finally {
    if (rejectTimeout) signal.removeEventListener("abort", rejectTimeout);
    controller.abort();
  }
}

async function review(context: Context, input: OpportunityReviewInput) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND", "Opportunity not found.");
  const opportunity = detail.opportunity;
  if (opportunity.version !== input.expectedVersion)
    throw new AppError(
      "CONFLICT",
      "Opportunity changed. Reload before reviewing.",
    );
  const allowed: Record<
    OpportunityReviewInput["decision"],
    OpportunityStatus[]
  > = {
    reviewed: ["discovered", "reviewed", "approved", "rejected"],
    approved: ["reviewed"],
    rejected: ["discovered", "reviewed"],
    deferred: ["discovered", "reviewed"],
  };
  if (!allowed[input.decision].includes(opportunity.status)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "This review transition is not allowed.",
    );
  }
  if (input.decision === "approved") {
    const reviewedCurrentEvidence = detail.decisions.some(
      (decision) =>
        decision.decision === "reviewed" &&
        decision.evidenceRunId === opportunity.evidenceRunId,
    );
    if (!reviewedCurrentEvidence)
      throw new AppError(
        "CONFLICT",
        "Review the current evidence before approving proposal preparation.",
      );
    const connection = await GscService.getConnection(input.projectId);
    if (
      connection?.siteUrl !== opportunity.siteUrl ||
      Date.now() - Date.parse(opportunity.lastDetectedAt) > 14 * DAY_MS
    ) {
      throw new AppError(
        "CONFLICT",
        "Reconnect and refresh evidence before approving proposal preparation.",
      );
    }
  }
  const changed = await OpportunityRepository.review({
    ...input,
    actorUserId: context.userId,
    fromStatus: opportunity.status,
    toStatus:
      input.decision === "deferred" ? opportunity.status : input.decision,
    deferredUntil:
      input.decision === "deferred"
        ? new Date(Date.now() + 7 * DAY_MS).toISOString()
        : null,
  });
  if (!changed)
    throw new AppError(
      "CONFLICT",
      "Opportunity changed. Reload before reviewing.",
    );
  return get(context, input.projectId, input.opportunityId);
}

export const OpportunityService = { list, get, detect, review };
