import { generateText, NoObjectGeneratedError, Output } from "ai";
import { sortBy } from "remeda";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { billResearchSpend } from "@/server/billing/researchSpend";
import { checkUsageCreditsDepleted } from "@/server/billing/subscription";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { requireOpenRouterCostUsd } from "@/server/lib/chatAgent";
import { AppError } from "@/server/lib/errors";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import {
  BRIEF_OPPORTUNITY_TYPES,
  type ContentBrief,
} from "@/types/schemas/contentBriefs";
import type { OpportunityDetail } from "@/types/schemas/opportunities";
import { ContentBriefRepository } from "../repositories/ContentBriefRepository";
import {
  BRIEF_PROMPT,
  BRIEF_PROMPT_VERSION,
  briefOutputSchema,
  checkBrief,
  renderBrief,
  type BriefKeyword,
  type BriefOutput,
} from "./contentBriefOutput";
import { authorize, get, type OpportunityContext } from "./opportunityAccess";
import { TICKET_STATUSES } from "./opportunityTicket";

// RFC-0004 phase 3: content briefs for new pages and refreshes.
const PER_PROJECT_PER_DAY = 20;
const KEYWORD_LIMIT = 15;
const CONTEXT_LIMIT = 2_000;
const CONTEXT_KEYS = [
  "business_overview",
  "current_goal",
  "positioning",
  "writing_preferences",
];
const REJECTED_MESSAGE =
  "Relay could not write a safe brief. Try again, or write the brief yourself.";

/** Content gaps use paid keyword data; refreshes use the page's queries. */
function briefKeywords(detail: OpportunityDetail): BriefKeyword[] {
  const { opportunity } = detail;
  const latest = <T extends { runId: string }>(rows: T[]) =>
    rows.filter((row) => row.runId === opportunity.evidenceRunId);
  if (opportunity.type === "content_gap")
    return sortBy(latest(detail.keywordEvidence), [
      (row) => row.searchVolume,
      "desc",
    ])
      .slice(0, KEYWORD_LIMIT)
      .map((row) => ({ keyword: row.keyword, searchVolume: row.searchVolume }));
  const queries = new Map<string, number>();
  if (opportunity.query) queries.set(opportunity.query, Infinity);
  for (const row of latest(detail.evidence))
    if (row.query)
      queries.set(
        row.query,
        Math.max(queries.get(row.query) ?? 0, row.impressions),
      );
  return sortBy([...queries], [([, impressions]) => impressions, "desc"])
    .slice(0, KEYWORD_LIMIT)
    .map(([keyword]) => ({ keyword, searchVolume: null }));
}

async function create(
  context: OpportunityContext & Pick<EnsuredUserContext, "userEmail">,
  input: {
    projectId: string;
    opportunityId: string;
    expectedOpportunityVersion: number;
  },
): Promise<ContentBrief> {
  const { projectId } = input;
  const detail = await get(context, projectId, input.opportunityId);
  requireOrgPermission(context, { integration: ["manage"] });
  const { opportunity } = detail;
  if (
    !(BRIEF_OPPORTUNITY_TYPES as readonly string[]).includes(opportunity.type)
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Relay writes briefs for content gaps and page refreshes only.",
    );
  if (!TICKET_STATUSES.includes(opportunity.status))
    throw new AppError(
      "VALIDATION_ERROR",
      "Approve the opportunity before you create a brief.",
    );
  if (opportunity.version !== input.expectedOpportunityVersion)
    throw new AppError("CONFLICT", "The opportunity changed. Reload it.");
  const keywords = briefKeywords(detail);
  if (!keywords.length)
    throw new AppError(
      "VALIDATION_ERROR",
      "This opportunity has no keyword data for a brief.",
    );
  if (
    (await ContentBriefRepository.countSince(
      projectId,
      new Date(Date.now() - 86_400_000).toISOString(),
    )) >= PER_PROJECT_PER_DAY
  )
    throw new AppError(
      "RATE_LIMITED",
      `This project had ${PER_PROJECT_PER_DAY} briefs in the last 24 hours. Try again tomorrow.`,
    );
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
      "You need usage credits to create a brief.",
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
    const contextText = (await ProjectContextRepository.listSections(projectId))
      .filter(
        (section) => CONTEXT_KEYS.includes(section.key) && section.content,
      )
      .map(
        (section) =>
          `${section.key}: ${section.content.slice(0, CONTEXT_LIMIT)}`,
      )
      .join("\n\n");
    const model = buildChatAgentModel(
      await getRequiredEnvValue("OPENROUTER_API_KEY"),
      await getOptionalEnvValue("OPENROUTER_MODEL"),
      "low",
    );
    let output: BriefOutput | null = null;
    let failures: string[] = [];
    let modelId = "unknown";
    let costUsd = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await generateText({
          model,
          output: Output.object({ schema: briefOutputSchema }),
          maxOutputTokens: 4_000,
          abortSignal: AbortSignal.timeout(60_000),
          system: BRIEF_PROMPT,
          prompt: [
            `Page: ${opportunity.url}\nOpportunity: ${opportunity.title}`,
            `<keywords>\n${keywords.map((item) => `${item.keyword}${item.searchVolume === null ? "" : ` (${item.searchVolume} monthly searches)`}`).join("\n")}\n</keywords>`,
            `<project_context untrusted="true">\n${contextText}\n</project_context>`,
            failures.length
              ? `Your previous brief failed these checks. Fix every one:\n- ${failures.join("\n- ")}`
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
                operation: "content_brief",
                costUsd: stepCost,
              },
            ]);
          },
        });
        modelId = result.response.modelId;
        output = result.output;
        failures = checkBrief(output, keywords, contextText);
      } catch (error) {
        if (!NoObjectGeneratedError.isInstance(error)) throw error;
        output = null;
        failures = ["The answer did not match the required JSON format."];
      }
      if (!failures.length) break;
    }
    const passed = output !== null && !failures.length;
    const volumes = new Map(
      keywords.map((item) => [item.keyword.toLowerCase(), item.searchVolume]),
    );
    const brief: ContentBrief = {
      id: crypto.randomUUID(),
      opportunityId: opportunity.id,
      status: passed ? "generated" : "rejected_by_validation",
      title: output?.title ?? "",
      audience: output?.audience ?? "",
      searchIntent: output?.searchIntent ?? "",
      outlineMarkdown: output && passed ? renderBrief(output, keywords) : "",
      model: modelId,
      promptVersion: BRIEF_PROMPT_VERSION,
      costUsd,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
      keywords:
        output && passed
          ? [
              { keyword: output.primaryKeyword, role: "primary" as const },
              ...output.secondaryKeywords.map((keyword) => ({
                keyword,
                role: "secondary" as const,
              })),
            ].map((item) => ({
              ...item,
              searchVolume: volumes.get(item.keyword.toLowerCase()) ?? null,
            }))
          : [],
    };
    await ContentBriefRepository.save(projectId, brief);
    return visible(brief);
  } finally {
    await DataRefreshClaimRepository.finish(claimKey, token, 0);
  }
}

/** A rejected brief keeps its record, but a person never sees its text. */
function visible(brief: ContentBrief): ContentBrief {
  return brief.status === "rejected_by_validation"
    ? { ...brief, title: "", audience: "", searchIntent: REJECTED_MESSAGE }
    : brief;
}

async function list(
  context: OpportunityContext,
  input: { projectId: string; opportunityId: string },
) {
  await authorize(context, input.projectId);
  return (
    await ContentBriefRepository.list(input.projectId, input.opportunityId)
  ).map(visible);
}

export const ContentBriefService = { create, list };
