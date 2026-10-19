import { eq } from "drizzle-orm";
import { db } from "@/db";
import { docsPageHeadings, docsPages, docsSettings } from "@/db/schema";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { previousPeriod } from "@/server/features/gsc/searchPerformanceReport";
import { GscService } from "@/server/features/gsc/services/GscService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { siteRoot } from "@/server/features/opportunities/services/detectors/shared";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { withIdentityKeys } from "@/server/features/opportunities/services/opportunityIdentity";
import { connectedGithub } from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import type {
  OpportunityDetectionResult,
  OpportunityRun,
} from "@/types/schemas/opportunities";
import {
  COMMIT_READS,
  detectDocsProblems,
  viewedDocsPages,
  type DocsPage,
} from "./docsDetectors";
import { fetchDocsGa4 } from "./docsGa4";

// RFC-0017 5.3: a docs run reads Search Console, GA4 and the docs index. Its
// opportunities belong to the project's Search Console property.
const DAY_MS = 86_400_000;
const PAGE_ROWS = 1_000;

async function indexedPages(projectId: string): Promise<DocsPage[]> {
  const [pages, headings] = await Promise.all([
    db
      .select({
        id: docsPages.id,
        filePath: docsPages.filePath,
        urlPath: docsPages.urlPath,
        title: docsPages.title,
      })
      .from(docsPages)
      .where(eq(docsPages.projectId, projectId)),
    db
      .select({ pageId: docsPageHeadings.pageId, text: docsPageHeadings.text })
      .from(docsPageHeadings)
      .where(eq(docsPageHeadings.projectId, projectId)),
  ]);
  return pages.map(({ id, ...page }) => ({
    ...page,
    headings: headings
      .filter((heading) => heading.pageId === id)
      .map((heading) => heading.text),
  }));
}

const notConnected = (message: string): OpportunityDetectionResult => ({
  outcome: "not_connected",
  run: null,
  message,
});

async function detect(
  context: OpportunityContext,
  projectId: string,
): Promise<OpportunityDetectionResult> {
  await authorize(context, projectId);
  const [[settings], connection, ga4Connection, publishing, pages] =
    await Promise.all([
      db
        .select()
        .from(docsSettings)
        .where(eq(docsSettings.projectId, projectId)),
      GscService.getConnection(projectId),
      Ga4ConnectionRepository.getByProjectId(projectId),
      PublishingRepository.getConnection(projectId),
      indexedPages(projectId),
    ]);
  if (!settings)
    return notConnected(
      "Set the docs paths in Project settings > Integrations first.",
    );
  if (!connection)
    return notConnected(
      "Connect this project's Search Console property first. Opportunities belong to that property.",
    );
  if (!pages.length)
    return notConnected(
      "The docs index is empty. Select Index now in Project settings > Integrations, then try again.",
    );
  const claimKey = `opportunities:docs:${projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    claimKey,
    context.organizationId,
  );
  if (!token)
    return {
      outcome: "busy",
      run: await OpportunityRepository.latestRun(projectId, undefined, "docs"),
      message:
        "Docs checks already ran in the last 24 hours, or a run is in progress. Saved results remain available.",
    };
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), "America/Los_Angeles"),
    -3,
  );
  const startDate = shiftGa4Date(endDate, -27);
  const previous = previousPeriod(startDate, endDate);
  const docsRoot = new URL(settings.pathPrefix, siteRoot(connection.siteUrl))
    .href;
  const docsPath = settings.pathPrefix.replace(/\/+$/, "");
  const run: OpportunityRun = {
    id: token,
    projectId,
    siteUrl: connection.siteUrl,
    kind: "docs",
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
    ga4PropertyId: ga4Connection?.propertyId ?? null,
    auditId: null,
    inspectionRequests: 0,
    requestCount: ga4Connection ? 3 : 1,
    opportunityCount: 0,
    truncated: false,
    error: null,
  };
  await OpportunityRepository.startRun(run);
  try {
    const [gsc, ga4] = await Promise.all([
      GscService.getPerformance({
        projectId,
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: PAGE_ROWS,
        type: "web",
        dataState: "final",
        filters: docsPath
          ? [{ dimension: "page", operator: "contains", expression: docsPath }]
          : undefined,
      }),
      ga4Connection
        ? fetchDocsGa4({
            connection: ga4Connection,
            range: { startDate, endDate },
            docsPath,
          })
        : null,
    ]);
    if (gsc.siteUrl !== connection.siteUrl)
      throw new AppError("CONFLICT", "The Search Console property changed.");
    const viewed = ga4 ? viewedDocsPages(pages, ga4.views) : [];
    const client =
      viewed.length && publishing
        ? await connectedGithub(
            publishing,
            AbortSignal.timeout(60_000),
            { metadata: "read", contents: "read" },
            COMMIT_READS + 5,
          )
        : null;
    const dated = [];
    for (const item of viewed)
      dated.push({
        ...item,
        lastChanged: client
          ? await client.lastCommitDate(
              item.page.filePath,
              publishing?.baseBranch ?? "",
            )
          : null,
      });
    run.requestCount += client ? dated.length : 0;
    const candidates = detectDocsProblems({
      docsRoot,
      pages,
      searches: ga4?.searches ?? null,
      gscPages: gsc.rows,
      viewed: dated,
      now: new Date(),
    });
    run.currentPageRows = gsc.rows.length;
    run.truncated = gsc.rows.length >= PAGE_ROWS;
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
      console.warn("Docs checks saved, but the cooldown update failed."),
    );
    const skipped = [
      !ga4 &&
        "GA4 is not connected, so the search gap and stale page checks were skipped.",
      ga4 &&
        !ga4.searches.length &&
        "GA4 recorded no site search terms. Turn on site search in GA4 enhanced measurement for the search gap check.",
      viewed.length &&
        !client &&
        "Connect the repository to check when popular pages last changed.",
    ].filter(Boolean);
    return {
      outcome: "completed",
      run,
      message: [
        candidates.length
          ? `Saved ${candidates.length} docs opportunities from ${pages.length} docs pages.`
          : `No docs page met a rule in ${pages.length} docs pages.`,
        ...skipped,
      ].join(" "),
    };
  } catch {
    const message =
      "Docs checks could not finish. Search Console, GA4 or GitHub may be unavailable. Retry in five minutes.";
    await OpportunityRepository.failRun(projectId, run.id, message);
    await DataRefreshClaimRepository.finish(claimKey, token, 300_000);
    return {
      outcome: "failed",
      run: { ...run, status: "failed", error: message },
      message,
    };
  }
}

export const DocsDetectionService = { detect };
