import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { billResearchSpend } from "@/server/billing/researchSpend";
import { checkUsageCreditsDepleted } from "@/server/billing/subscription";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { GscService } from "@/server/features/gsc/services/GscService";
import { checkGroundedText } from "@/server/features/publishing/draftChecks";
import { requireOpenRouterCostUsd } from "@/server/lib/chatAgent";
import { AppError } from "@/server/lib/errors";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import type {
  InvestigationFinding,
  OpportunityInvestigation,
} from "@/types/schemas/investigations";
import { InvestigationRepository } from "../repositories/InvestigationRepository";
import { OpportunitySignalRepository } from "../repositories/opportunitySignals";
import {
  auditFindings,
  indexStateFindings,
  queryLossFindings,
  rankFindings,
} from "./investigationFindings";
import { authorize, get, type OpportunityContext } from "./opportunityAccess";

// RFC-0004 phase 3: investigate a declining page with deterministic checks,
// then optionally summarize the stored findings with a model.
const SUMMARY_MAX = 600;
const MANAGE: { integration: ["manage"] } = { integration: ["manage"] };
const SUMMARY_PROMPT = [
  "You summarize the findings of an investigation into why one web page lost search traffic.",
  "Use only the findings. Name the most likely main cause first, then the next steps a person can check.",
  "Do not add numbers, causes or facts that the findings do not state. Say when the findings are not enough to know the cause.",
  `Write one plain paragraph of at most ${SUMMARY_MAX} characters, without line breaks.`,
].join("\n");

type Finding = Omit<InvestigationFinding, "id">;
const unavailable = (check: string): Finding => ({
  kind: "check_unavailable",
  severity: "info",
  summary: `${check} was unavailable.`,
  metricBefore: null,
  metricAfter: null,
});

/**
 * Four checks on the page: the query mix of the two compared periods, URL
 * Inspection, the latest site audit and tracked-keyword rank history. A
 * check that fails becomes a finding; the others still run.
 */
async function investigate(
  context: OpportunityContext,
  input: { projectId: string; opportunityId: string },
): Promise<OpportunityInvestigation> {
  const { projectId } = input;
  const { opportunity } = await get(context, projectId, input.opportunityId);
  requireOrgPermission(context, MANAGE);
  if (opportunity.type !== "declining_page")
    throw new AppError(
      "VALIDATION_ERROR",
      "Relay investigates declining pages only.",
    );
  const run = await InvestigationRepository.getRun(
    projectId,
    opportunity.evidenceRunId,
  );
  if (!run) throw new AppError("NOT_FOUND", "The evidence run was not found.");
  const queries = (startDate: string, endDate: string) =>
    GscService.getPerformance({
      projectId,
      startDate,
      endDate,
      dimensions: ["query"],
      filters: [
        { dimension: "page", operator: "equals", expression: opportunity.url },
      ],
      rowLimit: 250,
      type: "web",
      dataState: "final",
    }).then((result) => result.rows);
  // ponytail: one URL Inspection per investigation, not counted against the
  // detection budget; add a daily cap if people investigate in bulk.
  const [mix, inspection, audit, ranks] = await Promise.allSettled([
    Promise.all([
      queries(run.startDate, run.endDate),
      queries(run.previousStartDate, run.previousEndDate),
    ]),
    GscService.inspectUrls({ projectId, urls: [opportunity.url] }),
    InvestigationRepository.auditIssuesFor(projectId, opportunity.url),
    OpportunitySignalRepository.rankHistory(projectId, run.previousStartDate),
  ]);
  const pageQueries =
    mix.status === "fulfilled"
      ? mix.value.flat().flatMap((row) => row.keys?.slice(0, 1) ?? [])
      : [opportunity.query ?? ""].filter(Boolean);
  const findings: Finding[] = [
    ...(mix.status === "fulfilled"
      ? queryLossFindings(mix.value[0], mix.value[1])
      : [unavailable("Search Console query data")]),
    ...(inspection.status === "fulfilled"
      ? indexStateFindings(
          inspection.value.results[0]?.result?.indexStatusResult,
        )
      : [unavailable("URL Inspection")]),
    ...(audit.status === "rejected"
      ? [unavailable("The site audit")]
      : !audit.value
        ? [unavailable("A completed site audit")]
        : audit.value.issues.length
          ? auditFindings(audit.value.issues, audit.value.completedAt)
          : [
              {
                ...unavailable(""),
                kind: "audit_issue" as const,
                summary: `The site audit of ${audit.value.completedAt.slice(0, 10)} found no issues on the page.`,
              },
            ]),
    ...(ranks.status === "fulfilled"
      ? rankFindings(ranks.value, pageQueries)
      : [unavailable("Rank history")]),
  ];
  const investigation: OpportunityInvestigation = {
    id: crypto.randomUUID(),
    opportunityId: opportunity.id,
    runId: opportunity.evidenceRunId,
    status: "completed",
    createdBy: context.userId,
    createdAt: new Date().toISOString(),
    summary: null,
    summaryModel: null,
    summaryCostUsd: null,
    summarizedAt: null,
    findings: findings.map((finding) => ({
      ...finding,
      id: crypto.randomUUID(),
    })),
  };
  await InvestigationRepository.save(projectId, investigation);
  return InvestigationRepository.get(projectId, investigation.id);
}

async function listInvestigations(
  context: OpportunityContext,
  input: { projectId: string; opportunityId: string },
) {
  await authorize(context, input.projectId);
  return InvestigationRepository.list(input.projectId, input.opportunityId);
}

/**
 * A short model summary of the stored findings, with the same checks and
 * billing as description drafts. The model sees the findings and nothing else.
 */
async function summarizeInvestigation(
  context: OpportunityContext & Pick<EnsuredUserContext, "userEmail">,
  input: { projectId: string; investigationId: string },
): Promise<OpportunityInvestigation> {
  const { projectId } = input;
  await authorize(context, projectId);
  requireOrgPermission(context, MANAGE);
  const investigation = await InvestigationRepository.get(
    projectId,
    input.investigationId,
  );
  if (!investigation) throw new AppError("NOT_FOUND");
  if (investigation.summary)
    throw new AppError("CONFLICT", "This investigation has a summary already.");
  const customer = {
    organizationId: context.organizationId,
    userId: context.userId,
    userEmail: context.userEmail,
    projectId,
  };
  if (
    (await isHostedServerAuthMode()) &&
    (await checkUsageCreditsDepleted(customer)).depleted
  )
    throw new AppError(
      "INSUFFICIENT_CREDITS",
      "You need usage credits to summarize an investigation.",
    );
  // One model call at a time per project, shared with description drafts.
  const claimKey = `drafts:${projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    claimKey,
    context.organizationId,
  );
  if (!token)
    throw new AppError(
      "CONFLICT",
      "Relay is writing another draft for this project. Try again in a minute.",
    );
  try {
    const source = investigation.findings
      .map((finding) => `- [${finding.severity}] ${finding.summary}`)
      .join("\n");
    const model = buildChatAgentModel(
      await getRequiredEnvValue("OPENROUTER_API_KEY"),
      await getOptionalEnvValue("OPENROUTER_MODEL"),
      "low",
    );
    let costUsd = 0;
    let modelId = "unknown";
    let failures: string[] = [];
    let summary = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await generateText({
          model,
          output: Output.object({
            schema: z.object({ summary: z.string().min(1).max(1_200) }),
          }),
          maxOutputTokens: 1_000,
          abortSignal: AbortSignal.timeout(30_000),
          system: SUMMARY_PROMPT,
          prompt: [
            `<findings>\n${source}\n</findings>`,
            failures.length
              ? `Your previous summary failed these checks. Fix every one:\n- ${failures.join("\n- ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          onStepFinish: async (step) => {
            const stepCost = requireOpenRouterCostUsd(step.providerMetadata);
            costUsd += stepCost;
            await billResearchSpend(customer, [
              {
                provider: "openrouter",
                creditFeature: "agent",
                operation: "investigation_summary",
                costUsd: stepCost,
              },
            ]);
          },
        });
        modelId = result.response.modelId;
        summary = result.output.summary.trim();
        failures = checkGroundedText(summary, source, SUMMARY_MAX);
      } catch (error) {
        if (!NoObjectGeneratedError.isInstance(error)) throw error;
        failures = ["The answer did not match the required JSON format."];
      }
      if (!failures.length) break;
    }
    if (failures.length)
      throw new AppError(
        "VALIDATION_ERROR",
        "Relay could not write a safe summary. Read the findings instead.",
      );
    await InvestigationRepository.saveSummary(projectId, investigation.id, {
      summary,
      model: modelId,
      costUsd,
    });
    return InvestigationRepository.get(projectId, investigation.id);
  } finally {
    await DataRefreshClaimRepository.finish(claimKey, token, 0);
  }
}

export const OpportunityInvestigationService = {
  investigate,
  listInvestigations,
  summarizeInvestigation,
};
