import { generateText, NoObjectGeneratedError, Output } from "ai";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { billResearchSpend } from "@/server/billing/researchSpend";
import { checkUsageCreditsDepleted } from "@/server/billing/subscription";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { requireOpenRouterCostUsd } from "@/server/lib/chatAgent";
import { AppError } from "@/server/lib/errors";
import { buildChatAgentModel } from "@/server/lib/openrouter";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import type {
  DraftProposalTextInput,
  ProposalDraft,
} from "@/types/schemas/proposalDrafts";
import { checkDraft, draftOutputSchema, type DraftOutput } from "./draftChecks";
import {
  draftEvidence,
  gatherDraftInputs,
  promptFor,
  READ_ONLY,
  SYSTEM_PROMPT,
} from "./draftInputs";
import { locateMetadataFile, type LocateResult } from "./fileLocator";
import {
  authorizePublishing,
  connectedGithub,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { ProposalDraftRepository } from "./repositories/ProposalDraftRepository";
import { PublishingRepository } from "./repositories/PublishingRepository";

type DraftContext = PublishingContext & Pick<EnsuredUserContext, "userEmail">;

const DESCRIPTION_PROMPT_VERSION = "description-v1";
const ATTEMPTS = 2;
const PER_OPPORTUNITY_PER_DAY = 3;
const PER_PROJECT_PER_DAY = 30;
const REJECTED_MESSAGE =
  "Relay could not write a safe draft. Write the description yourself.";

async function digest(value: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** RFC-0004 5.2: find the page file before any draft or proposal. */
async function locate(
  context: PublishingContext,
  input: { projectId: string; opportunityId: string },
): Promise<LocateResult> {
  await authorizePublishing(context, input.projectId);
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const connection = await PublishingRepository.getConnection(input.projectId);
  if (!connection)
    return {
      status: "not_found",
      message: "Connect GitHub publishing to find the page file.",
    };
  return withPublishingClaim(
    context,
    input.projectId,
    async (_token, signal) => {
      const client = await connectedGithub(connection, signal, READ_ONLY);
      return locateMetadataFile(
        client.request,
        connection,
        detail.opportunity.url,
      );
    },
  );
}

/**
 * RFC-0004 5.3: a checked description draft for an approved opportunity. Two
 * attempts at most; a draft that fails the checks is stored, never shown.
 */
async function draft(
  context: DraftContext,
  input: DraftProposalTextInput,
): Promise<ProposalDraft> {
  await authorizePublishing(context, input.projectId, true);
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const { opportunity } = detail;
  if (opportunity.status !== "approved")
    throw new AppError(
      "VALIDATION_ERROR",
      "Approve the opportunity before you draft its description.",
    );
  if (opportunity.version !== input.expectedOpportunityVersion)
    throw new AppError("CONFLICT", "The opportunity changed. Reload it.");
  const used = await ProposalDraftRepository.countSince(
    input.projectId,
    opportunity.id,
    new Date(Date.now() - 86_400_000).toISOString(),
  );
  if (used.opportunity >= PER_OPPORTUNITY_PER_DAY)
    throw new AppError(
      "RATE_LIMITED",
      `This opportunity had ${PER_OPPORTUNITY_PER_DAY} drafts in the last 24 hours. Edit one of them, or try again tomorrow.`,
    );
  if (used.project >= PER_PROJECT_PER_DAY)
    throw new AppError(
      "RATE_LIMITED",
      `This project had ${PER_PROJECT_PER_DAY} drafts in the last 24 hours. Try again tomorrow.`,
    );
  const customer = {
    organizationId: context.organizationId,
    userId: context.userId,
    userEmail: context.userEmail,
    projectId: input.projectId,
  };
  // The per-project lease of one draft at a time bounds the small overdraft
  // race of checking before and billing after (RFC-0009 replaces it).
  if (
    (await isHostedServerAuthMode()) &&
    (await checkUsageCreditsDepleted(customer)).depleted
  )
    throw new AppError(
      "INSUFFICIENT_CREDITS",
      "You need usage credits to draft a description.",
    );
  // An agent may leave the path out; the app always sends what it shows.
  const located = input.filePath ? null : await locate(context, input);
  const filePath =
    input.filePath ??
    (located?.status === "found" ? located.filePath : undefined);
  const claimKey = `drafts:${input.projectId}`;
  const token = await DataRefreshClaimRepository.claim(
    claimKey,
    context.organizationId,
  );
  if (!token)
    throw new AppError(
      "CONFLICT",
      "Another draft is being written for this project. Try again in a minute.",
    );
  let costTotal = 0;
  try {
    const { inputs, sections } = await gatherDraftInputs(
      context,
      input.projectId,
      detail,
      filePath,
    );
    const model = buildChatAgentModel(
      await getRequiredEnvValue("OPENROUTER_API_KEY"),
      await getOptionalEnvValue("OPENROUTER_MODEL"),
      "low",
    );
    let output: DraftOutput | null = null;
    let failures: string[] = [];
    let modelId = "unknown";
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        const result = await generateText({
          model,
          output: Output.object({ schema: draftOutputSchema }),
          // The answer is short; the headroom is for the model's reasoning.
          maxOutputTokens: 1_000,
          abortSignal: AbortSignal.timeout(30_000),
          system: SYSTEM_PROMPT,
          prompt: promptFor(inputs, sections, failures),
          // Admitted above, so settle the actual cost even if credits ran out since.
          onStepFinish: async (step) => {
            const costUsd = requireOpenRouterCostUsd(step.providerMetadata);
            costTotal += costUsd;
            await billResearchSpend(customer, [
              {
                provider: "openrouter",
                creditFeature: "agent",
                operation: "proposal_draft",
                costUsd,
              },
            ]);
          },
        });
        modelId = result.response.modelId;
        output = result.output;
        failures = checkDraft(output, inputs);
      } catch (error) {
        if (!NoObjectGeneratedError.isInstance(error)) throw error;
        modelId = error.response?.modelId ?? modelId;
        output = null;
        failures = ["The answer did not match the required JSON format."];
      }
      if (!failures.length) break;
    }
    const passed = output !== null && !failures.length;
    const { sources, claims } = draftEvidence(
      inputs,
      sections,
      output ?? { description: "", rationale: "", usedQueries: [], claims: [] },
      passed,
    );
    const record: ProposalDraft = {
      id: crypto.randomUUID(),
      opportunityId: opportunity.id,
      opportunityVersion: opportunity.version,
      evidenceRunId: opportunity.evidenceRunId,
      kind: "meta_description",
      status: passed ? "generated" : "rejected_by_validation",
      targetUrl: opportunity.url,
      filePath: filePath ?? null,
      valueBefore: inputs.currentDescription,
      valueAfter: output?.description.trim() ?? "",
      rationale: output?.rationale ?? "",
      validationSummary: passed
        ? "Passed the length, character, change, number, quote, claim and query checks."
        : `Rejected: ${failures.join(" ")}`,
      model: modelId,
      promptVersion: DESCRIPTION_PROMPT_VERSION,
      inputDigest: await digest([DESCRIPTION_PROMPT_VERSION, inputs, sections]),
      costUsd: costTotal,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
      sources,
      claims,
    };
    await ProposalDraftRepository.save(input.projectId, record);
    return visible(record);
  } finally {
    await DataRefreshClaimRepository.finish(claimKey, token, 0);
  }
}

/** A rejected draft keeps its record, but a person never sees its text. */
function visible(record: ProposalDraft): ProposalDraft {
  return record.status === "rejected_by_validation"
    ? { ...record, valueAfter: "", rationale: REJECTED_MESSAGE }
    : record;
}

async function list(
  context: PublishingContext,
  input: { projectId: string; opportunityId: string },
) {
  await authorizePublishing(context, input.projectId);
  return (
    await ProposalDraftRepository.list(input.projectId, input.opportunityId)
  ).map(visible);
}

async function discard(
  context: PublishingContext,
  input: { projectId: string; draftId: string },
) {
  await authorizePublishing(context, input.projectId, true);
  await ProposalDraftRepository.discard(input.projectId, input.draftId);
}

export const ProposalDraftService = { locate, draft, list, discard };
