import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { previousPeriod } from "@/server/features/gsc/searchPerformanceReport";
import { GscService } from "@/server/features/gsc/services/GscService";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { urlJoinKey } from "@/server/features/opportunities/services/detectors/shared";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { withIdentityKeys } from "@/server/features/opportunities/services/opportunityIdentity";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { AppError } from "@/server/lib/errors";
import type {
  OpportunityDetectionResult,
  OpportunityRun,
} from "@/types/schemas/opportunities";
import { readGate } from "./ConversionGateService";
import { detectConversionProblems } from "./conversionDetectors";
import { fetchConversionPages } from "./conversionGa4";

// RFC-0012 5.3: a conversion run reads GA4 only. Its opportunities belong to
// the project's Search Console property, like every other run.
const DAY_MS = 86_400_000;

async function detect(
  context: OpportunityContext,
  projectId: string,
): Promise<OpportunityDetectionResult> {
  await authorize(context, projectId);
  const { conversion, gate } = await readGate(projectId);
  if (gate.status !== "passed" || !conversion)
    return {
      outcome: "not_connected",
      run: null,
      message:
        gate.status === "failed"
          ? `The tracking gate did not pass: ${gate.checks.flatMap((check) => check.fix ?? []).join(" ")}`
          : gate.status === "error"
            ? gate.message
            : "Connect Google Analytics and choose the conversion in Project settings > Conversion first.",
    };
  const [connection, ga4Connection] = await Promise.all([
    GscService.getConnection(projectId),
    Ga4ConnectionRepository.getByProjectId(projectId),
  ]);
  if (!connection || !ga4Connection)
    return {
      outcome: "not_connected",
      run: null,
      message:
        "Connect this project's Search Console property first. Opportunities belong to that property.",
    };
  const claimKey = `opportunities:conversion:${projectId}`;
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
        "conversion",
      ),
      message:
        "Conversion checks already ran in the last 24 hours, or a run is in progress. Saved results remain available.",
    };
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), ga4Connection.propertyTimeZone),
    -1,
  );
  const startDate = shiftGa4Date(endDate, -27);
  const previous = previousPeriod(startDate, endDate);
  const run: OpportunityRun = {
    id: token,
    projectId,
    siteUrl: connection.siteUrl,
    kind: "conversion",
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
    ga4PropertyId: ga4Connection.propertyId,
    auditId: null,
    inspectionRequests: 0,
    requestCount: gate.formsMeasured ? 2 : 1,
    opportunityCount: 0,
    truncated: false,
    error: null,
  };
  await OpportunityRepository.startRun(run);
  try {
    const [pages, keyPages] = await Promise.all([
      fetchConversionPages({
        connection: ga4Connection,
        range: { startDate, endDate },
        eventName: conversion.eventName,
        channel: conversion.channel,
        formsMeasured: gate.formsMeasured,
      }),
      ProjectContextRepository.listKeyPages(projectId),
    ]);
    const candidates = detectConversionProblems({
      pages,
      roles: new Map(
        keyPages.flatMap((page) => {
          const key = urlJoinKey(page.url);
          return key ? [[key, page.role]] : [];
        }),
      ),
      eventName: conversion.eventName,
      valueMinor: conversion.valueMinor,
      currency: conversion.currency ?? ga4Connection.propertyCurrencyCode,
      channel: conversion.channel,
      formsMeasured: gate.formsMeasured,
    });
    run.currentPageRows = pages.length;
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
      console.warn("Conversion checks saved, but the cooldown update failed."),
    );
    const skipped = gate.formsMeasured
      ? ""
      : " The form check was skipped, because GA4 enhanced measurement does not record form interactions.";
    return {
      outcome: "completed",
      run,
      message: `${candidates.length ? `Saved ${candidates.length} conversion opportunities from ${pages.length} landing pages.` : `No page met a conversion rule in ${pages.length} landing pages.`}${skipped}`,
    };
  } catch {
    const message =
      "Conversion checks could not finish. Google Analytics may be unavailable. Retry in five minutes.";
    await OpportunityRepository.failRun(projectId, run.id, message);
    await DataRefreshClaimRepository.finish(claimKey, token, 300_000);
    return {
      outcome: "failed",
      run: { ...run, status: "failed", error: message },
      message,
    };
  }
}

export const ConversionDetectionService = { detect };
