import { eq } from "drizzle-orm";
import { protectionEnrollments } from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { relayEmailConfigured } from "@/server/email/relay-email";
import { Ga4Service } from "@/server/features/ga4/services/Ga4Service";
import { GscService } from "@/server/features/gsc/services/GscService";
import { IndexNowService } from "@/server/features/indexnow/services/IndexNowService";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { AppError } from "@/server/lib/errors";
import {
  MAX_MONITORED_PAGES,
  type PROTECTION_STATUSES,
} from "@/shared/protection";
import type { saveProtectionSettingsInputSchema } from "@/types/schemas/protection";
import type { z } from "zod";
import { savePages, suggestPages } from "./monitoredPages";
import { confirmAlert, sendTestAlert } from "./protectionAlerts";
import {
  audit,
  conflict,
  fenced,
  MANAGE,
  requireEnrollment,
  reviewerCandidates,
  type ProtectionContext,
} from "./protectionAccess";
import { protectionReadiness } from "./protectionReadiness";
import {
  ProtectionRepository,
  type ProtectionEnrollment,
} from "./repositories/ProtectionRepository";

// RFC-0026 phase A (IRFC-0001): a project's protected-site scope, its
// reviewer and its readiness.

type ProtectionStatus = (typeof PROTECTION_STATUSES)[number];

/** The origin when the project's GSC property covers it. */
function searchConsoleCovers(siteUrl: string, origin: string): boolean {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = new URL(origin).hostname;
    return host === domain || host.endsWith(`.${domain}`);
  }
  return URL.parse(siteUrl)?.origin === origin;
}

async function productionOriginFor(
  domain: string | null,
  input: string,
): Promise<string> {
  if (!domain)
    throw new AppError(
      "VALIDATION_ERROR",
      "Add the project's website before protecting it.",
    );
  const url = URL.parse(input);
  if (
    !url ||
    ![`https://${domain}`, `https://www.${domain}`].includes(url.origin) ||
    url.href !== `${url.origin}/`
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "The production origin must be the project's website over https, with or without www.",
    );
  await normalizeAndValidateStartUrl(url.origin);
  return url.origin;
}

async function readinessOf(
  context: ProtectionContext,
  enrollment: ProtectionEnrollment | null,
  pages: ReadonlyArray<{ excludedReason: string | null }>,
  candidates: ReadonlyArray<{ userId: string }>,
) {
  const projectId = context.project.id;
  const [searchConsole, analytics, repository] = await Promise.all([
    GscService.getConnection(projectId),
    Ga4Service.getConnection(projectId),
    PublishingRepository.getConnection(projectId),
  ]);
  const reviewerUserId = enrollment?.reviewerUserId ?? null;
  return protectionReadiness({
    originVerified: Boolean(enrollment?.originVerifiedAt),
    allowRepairProposals: enrollment?.allowRepairProposals ?? false,
    allowPullRequests: enrollment?.allowPullRequests ?? false,
    repositoryConnected: Boolean(repository?.productionEnvironment.trim()),
    checkedPageCount: pages.filter((page) => !page.excludedReason).length,
    maxPages: MAX_MONITORED_PAGES,
    reviewerChosen: reviewerUserId !== null,
    reviewerIsMember: candidates.some(
      (candidate) => candidate.userId === reviewerUserId,
    ),
    alertConfirmed: Boolean(enrollment?.alertConfirmedAt),
    searchConsoleConnected: Boolean(searchConsole),
    analyticsConnected: Boolean(analytics),
  });
}

async function get(context: ProtectionContext) {
  const enrollment = await ProtectionRepository.getEnrollment(
    context.project.id,
  );
  const [pages, candidates] = await Promise.all([
    enrollment ? ProtectionRepository.listPages(enrollment.id) : [],
    reviewerCandidates(context, enrollment?.reviewerUserId ?? null),
  ]);
  return {
    domain: context.project.domain,
    canManage: hasOrgPermission(context.role, MANAGE),
    isReviewer:
      enrollment !== null && enrollment.reviewerUserId === context.userId,
    emailConfigured: relayEmailConfigured(),
    enrollment,
    pages,
    reviewerCandidates: candidates,
    readiness: await readinessOf(context, enrollment, pages, candidates),
  };
}

async function saveSettings(
  context: ProtectionContext,
  input: Omit<z.infer<typeof saveProtectionSettingsInputSchema>, "projectId">,
): Promise<void> {
  requireOrgPermission(context, MANAGE);
  const projectId = context.project.id;
  const productionOrigin = await productionOriginFor(
    context.project.domain,
    input.productionOrigin,
  );
  const enrollment = await ProtectionRepository.getEnrollment(projectId);
  const reviewerChanged =
    input.reviewerUserId !== (enrollment?.reviewerUserId ?? null);
  if (
    reviewerChanged &&
    input.reviewerUserId !== null &&
    !(await reviewerCandidates(context, null)).some(
      (candidate) => candidate.userId === input.reviewerUserId,
    )
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "The reviewer must be a member of this organization.",
    );
  const settings = {
    productionOrigin,
    checkHourUtc: input.checkHourUtc,
    reviewerUserId: input.reviewerUserId,
    notes: input.notes || null,
    allowRepairProposals: input.allowRepairProposals,
    allowPullRequests: input.allowPullRequests,
  };
  const now = new Date().toISOString();

  if (!enrollment) {
    const id = crypto.randomUUID();
    await fenced(projectId, null, () =>
      ProtectionRepository.createEnrollment({
        enrollment: {
          id,
          projectId,
          ...settings,
          createdBy: context.userId,
          createdAt: now,
          updatedBy: context.userId,
          updatedAt: now,
        },
        audit: audit(
          context,
          id,
          "protection.settings_changed",
          `Started protecting ${productionOrigin}`,
        ),
      }),
    );
    return;
  }

  const originChanged = productionOrigin !== enrollment.productionOrigin;
  if (
    originChanged &&
    enrollment.status !== "setup" &&
    enrollment.status !== "paused"
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Pause protection before changing the production origin.",
    );
  if (
    !originChanged &&
    !reviewerChanged &&
    settings.checkHourUtc === enrollment.checkHourUtc &&
    settings.notes === enrollment.notes &&
    settings.allowRepairProposals === enrollment.allowRepairProposals &&
    settings.allowPullRequests === enrollment.allowPullRequests
  )
    return;
  const change = () =>
    ProtectionRepository.updateEnrollment({
      enrollmentId: enrollment.id,
      userId: context.userId,
      set: {
        ...settings,
        ...(originChanged
          ? { originVerifiedAt: null, originVerifiedBy: null }
          : {}),
        ...(reviewerChanged
          ? { alertTestedAt: null, alertConfirmedAt: null }
          : {}),
      },
      scopeVersion: originChanged ? enrollment.scopeVersion + 1 : undefined,
      audit: audit(
        context,
        enrollment.id,
        "protection.settings_changed",
        originChanged
          ? `Changed the production origin to ${productionOrigin}`
          : "Changed protection settings",
      ),
    });
  if (originChanged) await fenced(projectId, enrollment, change);
  else await change();
}

async function verifyOrigin(context: ProtectionContext) {
  requireOrgPermission(context, MANAGE);
  const enrollment = await requireEnrollment(context.project.id);
  const origin = enrollment.productionOrigin;
  const searchConsole = await GscService.getConnection(context.project.id);
  let method: "search_console" | "indexnow_key" | null =
    searchConsole && searchConsoleCovers(searchConsole.siteUrl, origin)
      ? "search_console"
      : null;
  if (!method) {
    const { hosts } = await IndexNowService.checkKeyFiles({
      projectId: context.project.id,
      organizationId: context.organizationId,
    });
    const host = new URL(origin).hostname;
    if (hosts.some((file) => file.host === host && file.status === "found"))
      method = "indexnow_key";
  }
  if (!method) return { verified: false as const };
  if (enrollment.originVerifiedAt && enrollment.originVerifiedBy === method)
    return { verified: true as const, method };
  const landed = await ProtectionRepository.updateEnrollment({
    enrollmentId: enrollment.id,
    userId: context.userId,
    set: {
      originVerifiedAt: new Date().toISOString(),
      originVerifiedBy: method,
    },
    where: eq(protectionEnrollments.productionOrigin, origin),
    audit: audit(
      context,
      enrollment.id,
      "protection.origin_verified",
      `Verified ownership of ${origin} through ${method === "search_console" ? "Search Console" : "the IndexNow key file"}`,
    ),
  });
  if (!landed) throw conflict();
  return { verified: true as const, method };
}

async function setStatus(
  context: ProtectionContext,
  status: ProtectionStatus,
): Promise<void> {
  requireOrgPermission(context, MANAGE);
  const projectId = context.project.id;
  const enrollment = await requireEnrollment(projectId);
  const from = enrollment.status;
  if (from === status) return;
  const now = new Date().toISOString();
  const refused = () =>
    new AppError(
      "VALIDATION_ERROR",
      `Protection cannot go from ${from} to ${status}.`,
    );
  const change = (
    set: Parameters<typeof ProtectionRepository.updateEnrollment>[0]["set"],
    summary: string,
  ) =>
    ProtectionRepository.updateEnrollment({
      enrollmentId: enrollment.id,
      userId: context.userId,
      set: { status, ...set },
      where: eq(protectionEnrollments.status, from),
      audit: audit(
        context,
        enrollment.id,
        "protection.status_changed",
        summary,
      ),
    });
  let landed: boolean;
  switch (status) {
    case "active": {
      if (from !== "setup" && from !== "paused") throw refused();
      const pages = await ProtectionRepository.listPages(enrollment.id);
      const readiness = await readinessOf(
        context,
        enrollment,
        pages,
        await reviewerCandidates(context, enrollment.reviewerUserId),
      );
      if (!(from === "setup" ? readiness.canActivate : readiness.canResume))
        throw new AppError(
          "VALIDATION_ERROR",
          "Every required readiness item must pass first.",
        );
      landed =
        from === "setup"
          ? await change({ activatedAt: now }, "Activated protection")
          : await change({ pausedAt: null }, "Resumed protection");
      break;
    }
    case "paused":
      if (from !== "active") throw refused();
      landed = await change({ pausedAt: now }, "Paused protection");
      break;
    case "ended":
      landed = await change({ endedAt: now }, "Ended protection");
      break;
    case "setup":
      if (from !== "ended") throw refused();
      // A restart starts a new scope version; the fence orders it.
      await fenced(projectId, enrollment, () =>
        ProtectionRepository.updateEnrollment({
          enrollmentId: enrollment.id,
          userId: context.userId,
          set: { status, activatedAt: null, pausedAt: null, endedAt: null },
          scopeVersion: enrollment.scopeVersion + 1,
          audit: audit(
            context,
            enrollment.id,
            "protection.status_changed",
            "Restarted protection setup",
          ),
        }),
      );
      return;
  }
  if (!landed) throw conflict();
}

export const ProtectionService = {
  get,
  saveSettings,
  verifyOrigin,
  suggestPages,
  savePages,
  sendTestAlert,
  confirmAlert,
  setStatus,
};
