import { env } from "cloudflare:workers";
import { chunk } from "remeda";
import { assertSpendRoom } from "@/server/billing/spendAdmission";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { ExperimentRepository } from "@/server/features/experiments/repositories/ExperimentRepository";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import type { DraftContext } from "@/server/features/publishing/draftAdmission";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import {
  lockRenderingCredits,
  settleRenderingLocks,
} from "@/server/lib/audit/rendering-billing";
import { AppError } from "@/server/lib/errors";
import { estimateRenderingCredits } from "@/shared/audit-rendering";
import type { AccessibilityFixCheck } from "@/types/schemas/accessibility";
import type { ExperimentInput } from "@/types/schemas/experiments";
import { AccessibilityCheckRepository } from "./accessibilityChecks";
import { loadAxe, runAxe } from "./axeRun";

// RFC-0013 5.5: after the deployment is confirmed, axe-core runs again on at
// most 10 pages where the audit found the fixed cluster. The fix passes when
// the cluster's rule no longer fails on them. Browser time is held and billed
// like audit rendering.
const PAGES_AT_ONCE = 5;

async function check(
  context: DraftContext,
  input: ExperimentInput,
): Promise<{ ok: boolean; message: string }> {
  await authorizePublishing(context, input.projectId, true);
  const detail = await ExperimentRepository.get(
    input.projectId,
    input.experimentId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const { experiment } = detail;
  const { proposal } = detail.publishing;
  if (proposal.changeKind !== "jsx_attribute")
    return { ok: false, message: "Only accessibility fixes have this check." };
  if (!experiment.deployedAt)
    return {
      ok: false,
      message:
        "Confirm the production deployment first. The check reads the live pages.",
    };
  const opportunity = await OpportunityRepository.getDetail(
    input.projectId,
    experiment.opportunityId,
  );
  const evidence = opportunity?.accessibilityEvidence.find(
    (row) => row.runId === proposal.evidenceRunId,
  );
  const urls = evidence
    ? await AccessibilityCheckRepository.affectedPages(
        input.projectId,
        evidence.auditId,
        evidence.clusterKey,
      )
    : [];
  const browser = env.BROWSER;
  if (!evidence || !urls.length || !browser)
    return {
      ok: false,
      message: "Relay has no stored pages of this cluster to check.",
    };
  const source = await loadAxe();
  if (!source)
    return {
      ok: false,
      message: "axe-core could not be loaded. Try again later.",
    };
  const key = `accessibility-check:${experiment.id}`;
  const token = await DataRefreshClaimRepository.claim(
    key,
    context.organizationId,
  );
  if (!token)
    return {
      ok: false,
      message: "A check of this fix is running. Try again in a few minutes.",
    };
  try {
    const customer = {
      organizationId: context.organizationId,
      userId: context.userId,
      userEmail: context.userEmail,
      projectId: input.projectId,
    };
    await assertSpendRoom(
      { organizationId: context.organizationId, projectId: input.projectId },
      estimateRenderingCredits(urls.length).high,
    );
    const locks = await lockRenderingCredits({
      customer,
      auditId: evidence.auditId,
      maxPages: urls.length,
    });
    const pages: AccessibilityFixCheck["pages"] = [];
    try {
      for (const group of chunk(urls, PAGES_AT_ONCE))
        pages.push(
          ...(await Promise.all(
            group.map(async (url): Promise<(typeof pages)[number]> => {
              const outcome = await runAxe(browser, url, source);
              if ("error" in outcome)
                return { url, outcome: "unchecked", detail: outcome.error };
              const failing = outcome.result.violations.find(
                (violation) => violation.id === evidence.ruleId,
              );
              return failing
                ? {
                    url,
                    outcome: "failed",
                    detail: failing.nodes[0]?.target ?? null,
                  }
                : { url, outcome: "passed", detail: null };
            }),
          )),
        );
    } finally {
      if (locks.length)
        await settleRenderingLocks({
          customer,
          auditId: evidence.auditId,
          locks,
          usage: { cloudflareAttempts: pages.length, contextCredits: 0 },
        });
    }
    await AccessibilityCheckRepository.save(
      { ...input, checkedBy: context.userId },
      {
        id: crypto.randomUUID(),
        ruleId: evidence.ruleId,
        checkedAt: new Date().toISOString(),
        pages,
      },
    );
    const count = (outcome: string) =>
      pages.filter((page) => page.outcome === outcome).length;
    const [failed, unchecked] = [count("failed"), count("unchecked")];
    return {
      ok: true,
      message: failed
        ? `Not fixed: ${evidence.ruleId} still fails on ${failed} of ${pages.length} checked pages.`
        : unchecked
          ? `${evidence.ruleId} no longer fails on ${pages.length - unchecked} pages. Relay could not check ${unchecked} pages.`
          : `The fix passed: axe-core no longer finds ${evidence.ruleId} on the ${pages.length} checked pages.`,
    };
  } finally {
    await DataRefreshClaimRepository.finish(key, token, 0);
  }
}

async function latest(context: PublishingContext, input: ExperimentInput) {
  await authorizePublishing(context, input.projectId);
  return AccessibilityCheckRepository.latest(
    input.projectId,
    input.experimentId,
  );
}

async function trend(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  return AccessibilityCheckRepository.trend(projectId);
}

async function statement(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  return AccessibilityCheckRepository.statementFacts(projectId);
}

export const AccessibilityCheckService = { check, latest, trend, statement };
